package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/mail"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	minio "github.com/minio/minio-go/v7"
)

// buildAvatarURL returns a public URL for the user's avatar based on stored path.
// If avatarPath starts with '/', it's a public asset path served by frontend (e.g., /avatars/x.svg).
// Otherwise, it's treated as a MinIO object key and served via our API endpoint.
func buildAvatarURL(userID int, avatarPath sql.NullString) string {
	if !avatarPath.Valid || strings.TrimSpace(avatarPath.String) == "" {
		return ""
	}
	path := avatarPath.String
	if strings.HasPrefix(path, "/") { // public asset
		return path
	}
	return fmt.Sprintf("/api/users/%d/avatar", userID)
}

// GetCurrentUserHandler returns the authenticated user's profile info.
func GetCurrentUserHandler(w http.ResponseWriter, r *http.Request) {
	uid, ok := r.Context().Value(ctxKeyUserID).(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	var email, name, role string
	var avatarPath sql.NullString
	if err := db.QueryRow("SELECT email, COALESCE(name,''), role, avatar_path FROM users WHERE id=$1", uid).Scan(&email, &name, &role, &avatarPath); err != nil {
		http.Error(w, "Пользователь не найден", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"id":         uid,
		"email":      strings.ToLower(email),
		"name":       name,
		"role":       role,
		"avatar_url": buildAvatarURL(uid, avatarPath),
	})
}

// UploadAvatarHandler accepts multipart/form-data with field "file" and stores avatar in MinIO.
func UploadAvatarHandler(w http.ResponseWriter, r *http.Request) {
	uid, ok := r.Context().Value(ctxKeyUserID).(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	maxMB := 10
	if err := r.ParseMultipartForm(int64(maxMB) << 20); err != nil {
		http.Error(w, "Слишком большой запрос", http.StatusBadRequest)
		return
	}
	file, hdr, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Файл не найден", http.StatusBadRequest)
		return
	}
	defer file.Close()

	ct := hdr.Header.Get("Content-Type")
	if !strings.HasPrefix(ct, "image/") {
		http.Error(w, "Только изображения", http.StatusBadRequest)
		return
	}

	// Generate key and upload
	key := fmt.Sprintf("avatars/%d_%d%s", uid, time.Now().Unix(), strings.ToLower(filepath.Ext(hdr.Filename)))
	bucket := os.Getenv("MINIO_BUCKET")
	if bucket == "" {
		bucket = "videos"
	}
	// We need the size for PutObject; stream into a temp buffer/file if size unknown
	pr, pw := io.Pipe()
	go func() {
		defer pw.Close()
		_, _ = io.Copy(pw, file)
	}()
	_, err = minioClient.PutObject(r.Context(), bucket, key, pr, -1, minio.PutObjectOptions{ContentType: ct})
	if err != nil {
		http.Error(w, "Ошибка сохранения аватара", http.StatusInternalServerError)
		return
	}
	if _, err := db.Exec("UPDATE users SET avatar_path=$1 WHERE id=$2", key, uid); err != nil {
		http.Error(w, "Ошибка БД", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"avatar_url": "/api/users/" + strconv.Itoa(uid) + "/avatar"})
}

// SetPresetAvatarHandler sets one of the public preset avatars located under frontend's /public/avatars
// Body: { "path": "/avatars/animal01.svg" }
func SetPresetAvatarHandler(w http.ResponseWriter, r *http.Request) {
	uid, ok := r.Context().Value(ctxKeyUserID).(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	var req struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Некорректный запрос", http.StatusBadRequest)
		return
	}
	path := strings.TrimSpace(req.Path)
	if !strings.HasPrefix(path, "/avatars/") {
		http.Error(w, "Недопустимый путь пресета", http.StatusBadRequest)
		return
	}
	if _, err := db.Exec("UPDATE users SET avatar_path=$1 WHERE id=$2", path, uid); err != nil {
		http.Error(w, "Ошибка БД", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"avatar_url": path})
}

// UpdateProfileHandler updates current user's name and/or email.
// Body: { name?: string, email?: string, password_confirm: string }
func UpdateProfileHandler(w http.ResponseWriter, r *http.Request) {
	uid, ok := r.Context().Value(ctxKeyUserID).(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	var req struct {
		Name            *string `json:"name"`
		Email           *string `json:"email"`
		PasswordConfirm string  `json:"password_confirm"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Некорректный запрос", http.StatusBadRequest)
		return
	}
	// Fetch current password hash and email
	var curHash, curEmail, curName string
	if err := db.QueryRow("SELECT password_hash, email, COALESCE(name,'') FROM users WHERE id=$1", uid).Scan(&curHash, &curEmail, &curName); err != nil {
		http.Error(w, "Пользователь не найден", http.StatusNotFound)
		return
	}
	// Confirm with current password
	if strings.TrimSpace(req.PasswordConfirm) == "" || !CheckPassword(curHash, req.PasswordConfirm) {
		http.Error(w, "Неверный текущий пароль", http.StatusUnauthorized)
		return
	}
	// Prepare updates
	newName := curName
	newEmail := curEmail
	if req.Name != nil {
		newName = strings.TrimSpace(*req.Name)
	}
	if req.Email != nil {
		email := strings.ToLower(strings.TrimSpace(*req.Email))
		if email == "" {
			http.Error(w, "Email не может быть пустым", http.StatusBadRequest)
			return
		}
		if _, err := mail.ParseAddress(email); err != nil {
			http.Error(w, "Некорректный email", http.StatusBadRequest)
			return
		}
		newEmail = email
	}
	// Apply update
	if _, err := db.Exec("UPDATE users SET name=$1, email=$2 WHERE id=$3", newName, newEmail, uid); err != nil {
		http.Error(w, "Ошибка БД", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "email": newEmail, "name": newName})
}

// UpdatePasswordHandler changes the current user's password.
// Body: { current_password: string, new_password: string }
func UpdatePasswordHandler(w http.ResponseWriter, r *http.Request) {
	uid, ok := r.Context().Value(ctxKeyUserID).(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	var req struct {
		Current string `json:"current_password"`
		New     string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Некорректный запрос", http.StatusBadRequest)
		return
	}
	req.Current = strings.TrimSpace(req.Current)
	req.New = strings.TrimSpace(req.New)
	if req.Current == "" || req.New == "" {
		http.Error(w, "Укажите текущий и новый пароль", http.StatusBadRequest)
		return
	}
	// Load current hash
	var curHash string
	if err := db.QueryRow("SELECT password_hash FROM users WHERE id=$1", uid).Scan(&curHash); err != nil {
		http.Error(w, "Пользователь не найден", http.StatusNotFound)
		return
	}
	if !CheckPassword(curHash, req.Current) {
		http.Error(w, "Неверный текущий пароль", http.StatusUnauthorized)
		return
	}
	if len(req.New) < 8 {
		http.Error(w, "Пароль должен быть не менее 8 символов", http.StatusBadRequest)
		return
	}
	hash, err := HashPassword(req.New)
	if err != nil {
		http.Error(w, "Ошибка сервера", http.StatusInternalServerError)
		return
	}
	if _, err := db.Exec("UPDATE users SET password_hash=$1 WHERE id=$2", hash, uid); err != nil {
		http.Error(w, "Ошибка БД", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
}

// UserAvatarContentHandler serves avatar content for a user when stored in MinIO (non-public path).
func UserAvatarContentHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.Atoi(vars["id"])
	var avatarPath sql.NullString
	if err := db.QueryRow("SELECT avatar_path FROM users WHERE id=$1", id).Scan(&avatarPath); err != nil || !avatarPath.Valid || strings.TrimSpace(avatarPath.String) == "" {
		http.Error(w, "Аватар не найден", http.StatusNotFound)
		return
	}
	if strings.HasPrefix(avatarPath.String, "/") {
		// Public asset, redirect
		http.Redirect(w, r, avatarPath.String, http.StatusTemporaryRedirect)
		return
	}
	// MinIO fetch
	bucket := os.Getenv("MINIO_BUCKET")
	if bucket == "" {
		bucket = "videos"
	}
	obj, err := minioClient.GetObject(r.Context(), bucket, avatarPath.String, minio.GetObjectOptions{})
	if err != nil {
		http.Error(w, "Файл не найден", http.StatusNotFound)
		return
	}
	defer obj.Close()
	info, statErr := obj.Stat()
	if statErr != nil {
		http.Error(w, "Файл не найден", http.StatusNotFound)
		return
	}
	if info.ContentType != "" {
		w.Header().Set("Content-Type", info.ContentType)
	} else {
		w.Header().Set("Content-Type", "image/*")
	}
	if info.Size >= 0 {
		w.Header().Set("Content-Length", strconv.FormatInt(info.Size, 10))
	}
	_, _ = io.Copy(w, obj)
}
