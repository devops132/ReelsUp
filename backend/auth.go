package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	pq "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

type contextKey string

var ctxKeyUserID = contextKey("userID")
var ctxKeyUserRole = contextKey("userRole")

type JWTClaims struct {
	UserID int    `json:"user_id"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

func HashPassword(password string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	return string(b), err
}

func CheckPassword(hash string, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func JWTAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			http.Error(w, "Требуется аутентификация", http.StatusUnauthorized)
			return
		}
		tokenStr := strings.TrimPrefix(auth, "Bearer ")
		claims := &JWTClaims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})
		if err != nil || !token.Valid {
			http.Error(w, "Недействительный токен", http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), ctxKeyUserID, claims.UserID)
		ctx = context.WithValue(ctx, ctxKeyUserRole, claims.Role)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func JWTOptionalMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth := strings.TrimSpace(r.Header.Get("Authorization"))
		if auth == "" {
			next.ServeHTTP(w, r)
			return
		}
		if !strings.HasPrefix(auth, "Bearer ") {
			// Treat malformed/invalid Authorization as anonymous instead of hard failing
			next.ServeHTTP(w, r)
			return
		}
		tokenStr := strings.TrimPrefix(auth, "Bearer ")
		claims := &JWTClaims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})
		if err != nil || !token.Valid {
			// On optional middleware, proceed as unauthenticated when token is invalid/expired
			next.ServeHTTP(w, r)
			return
		}
		ctx := context.WithValue(r.Context(), ctxKeyUserID, claims.UserID)
		ctx = context.WithValue(ctx, ctxKeyUserRole, claims.Role)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func AdminOnlyMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		role, _ := r.Context().Value(ctxKeyUserRole).(string)
		if role != "admin" {
			http.Error(w, "Доступ запрещен", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func RegisterHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Name     string `json:"name"`
		Business bool   `json:"business"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Некорректные данные", http.StatusBadRequest)
		return
	}
	req.Email = strings.TrimSpace(req.Email)
	if req.Email == "" || req.Password == "" {
		http.Error(w, "Email и пароль обязательны", http.StatusBadRequest)
		return
	}
	email := strings.ToLower(req.Email)
	hash, err := HashPassword(req.Password)
	if err != nil {
		http.Error(w, "Ошибка сервера", http.StatusInternalServerError)
		return
	}
	role := "user"
	if req.Business {
		role = "business"
	}
	var id int
	err = db.QueryRow("INSERT INTO users (email, password_hash, name, role) VALUES ($1,$2,$3,$4) RETURNING id",
		email, hash, req.Name, role).Scan(&id)
	if err != nil {
		if pe, ok := err.(*pq.Error); ok && pe.Code.Name() == "unique_violation" {
			http.Error(w, "Email уже зарегистрирован", http.StatusConflict)
			return
		}
		http.Error(w, "Ошибка базы данных", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"message": "Регистрация успешна", "user_id": id})
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Некорректные данные", http.StatusBadRequest)
		return
	}
	req.Email = strings.TrimSpace(req.Email)
	var id int
	var hash, name, role string
	var avatarPath sql.NullString
	err := db.QueryRow("SELECT id, password_hash, name, role, avatar_path FROM users WHERE LOWER(email)=LOWER($1)", strings.ToLower(req.Email)).Scan(&id, &hash, &name, &role, &avatarPath)
	if err != nil || !CheckPassword(hash, req.Password) {
		http.Error(w, "Неверный email или пароль", http.StatusUnauthorized)
		return
	}
	claims := JWTClaims{
		UserID: id, Role: role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString(jwtSecret)
	if err != nil {
		http.Error(w, "Ошибка генерации токена", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	avatarURL := buildAvatarURL(id, avatarPath)
	json.NewEncoder(w).Encode(map[string]any{
		"token": tokenStr,
		"user":  map[string]any{"id": id, "email": strings.ToLower(req.Email), "name": name, "role": role, "avatar_url": avatarURL},
	})
}
