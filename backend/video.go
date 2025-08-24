
package main

import (
    "database/sql"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "os"
    "strconv"
    "strings"
    "time"

    "github.com/gorilla/mux"
    minio "github.com/minio/minio-go/v7"
)

type Video struct {
    ID            int       `json:"id"`
    Title         string    `json:"title"`
    Description   string    `json:"description"`
    Tags          string    `json:"tags,omitempty"`
    ProductLinks  string    `json:"product_links,omitempty"`
    Thumbnail     string    `json:"thumbnail_path,omitempty"`
    VideoPath     string    `json:"video_path,omitempty"`
    CreatedAt     time.Time `json:"created_at"`
    UserID        int       `json:"user_id"`
    UserName      string    `json:"user_name"`
    CategoryID    int       `json:"category_id,omitempty"`
    CategoryName  string    `json:"category_name,omitempty"`
    LikesCount    int       `json:"likes_count"`
    CommentsCount int       `json:"comments_count"`
    IsApproved    bool      `json:"is_approved"`
    LikedByUser   bool      `json:"liked_by_user"`
}

func ListVideosHandler(w http.ResponseWriter, r *http.Request) {
    q := r.URL.Query().Get("q")
    cat := r.URL.Query().Get("category")
    query := `SELECT v.id, v.title, v.description, v.tags, v.product_links, v.thumbnail_path, v.video_path,
                     v.created_at, v.user_id, COALESCE(u.name,''),
                     v.category_id, COALESCE(c.name,''),
                     (SELECT COUNT(*) FROM likes l WHERE l.video_id=v.id) as likes,
                     (SELECT COUNT(*) FROM comments m WHERE m.video_id=v.id) as comments,
                     v.is_approved
              FROM videos v JOIN users u ON u.id=v.user_id
              LEFT JOIN categories c ON c.id=v.category_id
              WHERE v.is_approved=TRUE`
    params := []any{}
    if q != "" {
        like := "%" + q + "%"
        query += " AND (v.title ILIKE $" + strconv.Itoa(len(params)+1)
        params = append(params, like)
        query += " OR v.description ILIKE $" + strconv.Itoa(len(params)+1)
        params = append(params, like)
        query += " OR v.tags ILIKE $" + strconv.Itoa(len(params)+1) + ")"
        params = append(params, like)
    }
    if cat != "" {
        if cid, err := strconv.Atoi(cat); err == nil {
            query += " AND v.category_id=$" + strconv.Itoa(len(params)+1)
            params = append(params, cid)
        }
    }
    query += " ORDER BY v.created_at DESC"
    rows, err := db.Query(query, params...)
    if err != nil { http.Error(w, "Ошибка запроса видео", http.StatusInternalServerError); return }
    defer rows.Close()
    out := []Video{}
    for rows.Next() {
        var v Video
        var catID sql.NullInt32
        if err := rows.Scan(&v.ID,&v.Title,&v.Description,&v.Tags,&v.ProductLinks,&v.Thumbnail,&v.VideoPath,
            &v.CreatedAt,&v.UserID,&v.UserName,&catID,&v.CategoryName,&v.LikesCount,&v.CommentsCount,&v.IsApproved); err != nil {
            http.Error(w,"Ошибка данных",http.StatusInternalServerError); return
        }
        if catID.Valid { v.CategoryID = int(catID.Int32) }
        out = append(out, v)
    }
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(out)
}

func GetVideoHandler(w http.ResponseWriter, r *http.Request) {
    id, _ := strconv.Atoi(mux.Vars(r)["id"])
    var v Video
    var catID sql.NullInt32
    err := db.QueryRow(`SELECT v.id, v.title, v.description, v.tags, v.product_links, v.thumbnail_path, v.video_path,
                v.created_at, v.user_id, COALESCE(u.name,''),
                v.category_id, COALESCE(c.name,''),
                (SELECT COUNT(*) FROM likes l WHERE l.video_id=v.id) as likes,
                (SELECT COUNT(*) FROM comments m WHERE m.video_id=v.id) as comments,
                v.is_approved
         FROM videos v JOIN users u ON u.id=v.user_id
         LEFT JOIN categories c ON c.id=v.category_id
         WHERE v.id=$1`, id).Scan(&v.ID,&v.Title,&v.Description,&v.Tags,&v.ProductLinks,&v.Thumbnail,&v.VideoPath,
            &v.CreatedAt,&v.UserID,&v.UserName,&catID,&v.CategoryName,&v.LikesCount,&v.CommentsCount,&v.IsApproved)
    if err != nil { http.Error(w, "Видео не найдено", http.StatusNotFound); return }
    if catID.Valid { v.CategoryID = int(catID.Int32) }
    if !v.IsApproved {
        uid, uidOk := r.Context().Value(ctxKeyUserID).(int)
        role, roleOk := r.Context().Value(ctxKeyUserRole).(string)
        if !(uidOk && roleOk && (role == "admin" || uid == v.UserID)) {
            http.Error(w, "Видео ожидает модерации", http.StatusForbidden); return
        }
    }
    liked := false
    if uid, ok := r.Context().Value(ctxKeyUserID).(int); ok {
        var x int
        if err := db.QueryRow("SELECT 1 FROM likes WHERE user_id=$1 AND video_id=$2", uid, v.ID).Scan(&x); err == nil { liked = true }
    }
    v.LikedByUser = liked
    w.Header().Set("Content-Type","application/json")
    json.NewEncoder(w).Encode(v)
}

func VideoContentHandler(w http.ResponseWriter, r *http.Request) {
    id, _ := strconv.Atoi(mux.Vars(r)["id"])
    var path string; var approved bool; var owner int
    if err := db.QueryRow("SELECT video_path, is_approved, user_id FROM videos WHERE id=$1", id).Scan(&path,&approved,&owner); err != nil {
        http.Error(w, "Видео не найдено", http.StatusNotFound); return
    }
    if !approved {
        uid, uidOk := r.Context().Value(ctxKeyUserID).(int)
        role, roleOk := r.Context().Value(ctxKeyUserRole).(string)
        if !(uidOk && roleOk && (role == "admin" || uid == owner)) {
            http.Error(w, "Видео не одобрено", http.StatusForbidden); return
        }
    }
    bucket := os.Getenv("MINIO_BUCKET"); if bucket == "" { bucket = "videos" }
    info, err := minioClient.StatObject(r.Context(), bucket, path, minio.StatObjectOptions{})
    if err != nil { http.Error(w, "Файл не найден", http.StatusNotFound); return }
    obj, err := minioClient.GetObject(r.Context(), bucket, path, minio.GetObjectOptions{})
    if err != nil { http.Error(w, "Ошибка доступа к файлу", http.StatusInternalServerError); return }
    defer obj.Close()
    if info.Size > 0 { w.Header().Set("Content-Length", fmt.Sprintf("%d", info.Size)) }
    if info.ContentType != "" { w.Header().Set("Content-Type", info.ContentType) } else { w.Header().Set("Content-Type", "application/octet-stream") }
    if _, err := io.Copy(w, obj); err != nil { fmt.Println("stream error:", err) }
}

func UploadVideoHandler(w http.ResponseWriter, r *http.Request) {
    if err := r.ParseMultipartForm(300 << 20); err != nil { http.Error(w,"Слишком большой запрос",http.StatusBadRequest); return }
    file, hdr, err := r.FormFile("file")
    if err != nil { http.Error(w,"Видео файл не найден",http.StatusBadRequest); return }
    defer file.Close()
    title := r.FormValue("title")
    if strings.TrimSpace(title) == "" { http.Error(w,"Заголовок обязателен",http.StatusBadRequest); return }
    description := r.FormValue("description")
    tags := r.FormValue("tags")
    productLinks := r.FormValue("productLinks")
    catStr := r.FormValue("category")
    uid := r.Context().Value(ctxKeyUserID).(int)
    role := r.Context().Value(ctxKeyUserRole).(string)
    if role != "business" { productLinks = "" }

    objectName := fmt.Sprintf("%d_%d_%s", uid, time.Now().Unix(), hdr.Filename)
    bucket := os.Getenv("MINIO_BUCKET"); if bucket == "" { bucket = "videos" }
    _, err = minioClient.PutObject(r.Context(), bucket, objectName, file, hdr.Size, minio.PutObjectOptions{
        ContentType: hdr.Header.Get("Content-Type"),
    })
    if err != nil { http.Error(w,"Ошибка сохранения видео",http.StatusInternalServerError); return }

    var catId *int
    if catStr != "" {
        if x, err := strconv.Atoi(catStr); err == nil { catId = &x }
    }
    var videoID int
    if catId != nil {
        err = db.QueryRow(`INSERT INTO videos (user_id, category_id, title, description, tags, product_links, video_path, thumbnail_path, is_approved)
                           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
            uid, *catId, title, description, tags, productLinks, objectName, "", false).Scan(&videoID)
    } else {
        err = db.QueryRow(`INSERT INTO videos (user_id, title, description, tags, product_links, video_path, thumbnail_path, is_approved)
                           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
            uid, title, description, tags, productLinks, objectName, "", false).Scan(&videoID)
    }
    if err != nil { http.Error(w,"Ошибка сохранения метаданных",http.StatusInternalServerError); return }
    w.Header().Set("Content-Type","application/json")
    json.NewEncoder(w).Encode(map[string]any{"message":"Видео загружено, ожидает модерации","video_id":videoID})
}

func DeleteVideoHandler(w http.ResponseWriter, r *http.Request) {
    id, _ := strconv.Atoi(mux.Vars(r)["id"])
    var owner int; var path string
    if err := db.QueryRow("SELECT user_id, video_path FROM videos WHERE id=$1", id).Scan(&owner,&path); err != nil {
        http.Error(w,"Видео не найдено",http.StatusNotFound); return
    }
    uid := r.Context().Value(ctxKeyUserID).(int)
    role := r.Context().Value(ctxKeyUserRole).(string)
    if uid != owner && role != "admin" { http.Error(w,"Нет прав",http.StatusForbidden); return }
    if _, err := db.Exec("DELETE FROM videos WHERE id=$1", id); err != nil { http.Error(w,"Ошибка БД",http.StatusInternalServerError); return }
    bucket := os.Getenv("MINIO_BUCKET"); if bucket == "" { bucket = "videos" }
    if err := minioClient.RemoveObject(r.Context(), bucket, path, minio.RemoveObjectOptions{}); err != nil {
        fmt.Println("MinIO remove error:", err)
    }
    w.Header().Set("Content-Type","application/json")
    json.NewEncoder(w).Encode(map[string]string{"message":"Видео удалено"})
}

func LikeVideoHandler(w http.ResponseWriter, r *http.Request) {
    id, _ := strconv.Atoi(mux.Vars(r)["id"])
    uid := r.Context().Value(ctxKeyUserID).(int)
    if _, err := db.Exec("INSERT INTO likes (user_id, video_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", uid, id); err != nil {
        http.Error(w,"Ошибка БД",http.StatusInternalServerError); return
    }
    var c int; _ = db.QueryRow("SELECT COUNT(*) FROM likes WHERE video_id=$1", id).Scan(&c)
    w.Header().Set("Content-Type","application/json")
    json.NewEncoder(w).Encode(map[string]any{"video_id":id,"likes_count":c,"liked":true})
}

func UnlikeVideoHandler(w http.ResponseWriter, r *http.Request) {
    id, _ := strconv.Atoi(mux.Vars(r)["id"])
    uid := r.Context().Value(ctxKeyUserID).(int)
    if _, err := db.Exec("DELETE FROM likes WHERE user_id=$1 AND video_id=$2", uid, id); err != nil {
        http.Error(w,"Ошибка БД",http.StatusInternalServerError); return
    }
    var c int; _ = db.QueryRow("SELECT COUNT(*) FROM likes WHERE video_id=$1", id).Scan(&c)
    w.Header().Set("Content-Type","application/json")
    json.NewEncoder(w).Encode(map[string]any{"video_id":id,"likes_count":c,"liked":false})
}

func ListMyVideosHandler(w http.ResponseWriter, r *http.Request) {
    uid := r.Context().Value(ctxKeyUserID).(int)
    rows, err := db.Query(`SELECT v.id, v.title, v.description, v.tags, v.product_links, v.thumbnail_path, v.video_path,
                v.created_at, v.user_id, COALESCE(u.name,''),
                v.category_id, COALESCE(c.name,''),
                (SELECT COUNT(*) FROM likes l WHERE l.video_id=v.id) as likes,
                (SELECT COUNT(*) FROM comments m WHERE m.video_id=v.id) as comments,
                v.is_approved
         FROM videos v JOIN users u ON u.id=v.user_id
         LEFT JOIN categories c ON c.id=v.category_id
         WHERE v.user_id=$1 ORDER BY v.created_at DESC`, uid)
    if err != nil { http.Error(w,"Ошибка получения видео",http.StatusInternalServerError); return }
    defer rows.Close()
    out := []Video{}
    for rows.Next() {
        var v Video; var catID sql.NullInt32
        if err := rows.Scan(&v.ID,&v.Title,&v.Description,&v.Tags,&v.ProductLinks,&v.Thumbnail,&v.VideoPath,
            &v.CreatedAt,&v.UserID,&v.UserName,&catID,&v.CategoryName,&v.LikesCount,&v.CommentsCount,&v.IsApproved); err != nil {
            http.Error(w,"Ошибка данных",http.StatusInternalServerError); return
        }
        if catID.Valid { v.CategoryID = int(catID.Int32) }
        out = append(out, v)
    }
    w.Header().Set("Content-Type","application/json")
    json.NewEncoder(w).Encode(out)
}
