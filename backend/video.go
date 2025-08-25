package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
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
	Has720        bool      `json:"has_720"`
	Has480        bool      `json:"has_480"`
	AvgRating     float64   `json:"avg_rating"`
	MyRating      int       `json:"my_rating"`
}

func ListVideosHandler(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	cat := r.URL.Query().Get("category")
	query := `SELECT v.id, v.title, v.description, v.tags, v.product_links, v.thumbnail_path, v.video_path,
                     v.created_at, v.user_id, COALESCE(u.name,''),
                     v.category_id, COALESCE(c.name,''),
                     (SELECT COUNT(*) FROM likes l WHERE l.video_id = v.id)            AS likes,
                     (SELECT COUNT(*) FROM comments m WHERE m.video_id = v.id)         AS comments,
                     COALESCE((SELECT AVG(value) FROM ratings r WHERE r.video_id = v.id),0) AS avg_rating,
                     v.is_approved,
                     (v.video_path_720 IS NOT NULL AND v.video_path_720 <> '') AS has_720,
                     (v.video_path_480 IS NOT NULL AND v.video_path_480 <> '') AS has_480
              FROM videos v
              JOIN users u ON u.id = v.user_id
              LEFT JOIN categories c ON c.id = v.category_id
              WHERE v.is_approved = TRUE`
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
	if err != nil {
		http.Error(w, "Ошибка запроса видео", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	out := []Video{}
	for rows.Next() {
		var v Video
		var catID sql.NullInt32
		if err := rows.Scan(&v.ID, &v.Title, &v.Description, &v.Tags, &v.ProductLinks, &v.Thumbnail, &v.VideoPath,
			&v.CreatedAt, &v.UserID, &v.UserName, &catID, &v.CategoryName, &v.LikesCount, &v.CommentsCount, &v.AvgRating, &v.IsApproved, &v.Has720, &v.Has480); err != nil {
			http.Error(w, "Ошибка данных", http.StatusInternalServerError)
			return
		}
		if catID.Valid {
			v.CategoryID = int(catID.Int32)
		}
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
                (SELECT COUNT(*) FROM likes l WHERE l.video_id = v.id)            AS likes,
                (SELECT COUNT(*) FROM comments m WHERE m.video_id = v.id)         AS comments,
                COALESCE((SELECT AVG(value) FROM ratings r WHERE r.video_id = v.id),0) AS avg_rating,
                v.is_approved,
                (v.video_path_720 IS NOT NULL AND v.video_path_720 <> '') AS has_720,
                (v.video_path_480 IS NOT NULL AND v.video_path_480 <> '') AS has_480
         FROM videos v
         JOIN users u ON u.id = v.user_id
         LEFT JOIN categories c ON c.id = v.category_id
         WHERE v.id = $1`, id).Scan(&v.ID, &v.Title, &v.Description, &v.Tags, &v.ProductLinks, &v.Thumbnail, &v.VideoPath,
		&v.CreatedAt, &v.UserID, &v.UserName, &catID, &v.CategoryName, &v.LikesCount, &v.CommentsCount, &v.AvgRating, &v.IsApproved, &v.Has720, &v.Has480)
	if err != nil {
		http.Error(w, "Видео не найдено", http.StatusNotFound)
		return
	}
	if catID.Valid {
		v.CategoryID = int(catID.Int32)
	}
	if !v.IsApproved {
		uid, uidOk := r.Context().Value(ctxKeyUserID).(int)
		role, roleOk := r.Context().Value(ctxKeyUserRole).(string)
		if !(uidOk && roleOk && (role == "admin" || uid == v.UserID)) {
			http.Error(w, "Видео ожидает модерации", http.StatusForbidden)
			return
		}
	}
	liked := false
	if uid, ok := r.Context().Value(ctxKeyUserID).(int); ok {
		var x int
		if err := db.QueryRow("SELECT 1 FROM likes WHERE user_id=$1 AND video_id=$2", uid, v.ID).Scan(&x); err == nil {
			liked = true
		}
	}
	v.LikedByUser = liked
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func VideoContentHandler(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(mux.Vars(r)["id"])
	var orig, p720, p480 string
	var approved bool
	var owner int
	if err := db.QueryRow("SELECT video_path, video_path_720, video_path_480, is_approved, user_id FROM videos WHERE id=$1", id).Scan(&orig, &p720, &p480, &approved, &owner); err != nil {
		http.Error(w, "Видео не найдено", http.StatusNotFound)
		return
	}
	quality := r.URL.Query().Get("quality")
	path := orig
	switch quality {
	case "720p":
		if p720 != "" {
			path = p720
		}
	case "480p":
		if p480 != "" {
			path = p480
		}
	}
	if !approved {
		uid, uidOk := r.Context().Value(ctxKeyUserID).(int)
		role, roleOk := r.Context().Value(ctxKeyUserRole).(string)
		if !(uidOk && roleOk && (role == "admin" || uid == owner)) {
			http.Error(w, "Видео не одобрено", http.StatusForbidden)
			return
		}
	}
	bucket := os.Getenv("MINIO_BUCKET")
	if bucket == "" {
		bucket = "videos"
	}
        info, err := minioClient.StatObject(r.Context(), bucket, path, minio.StatObjectOptions{})
        if err != nil {
                http.Error(w, "Файл не найден", http.StatusNotFound)
                return
        }
        rangeHeader := r.Header.Get("Range")
        w.Header().Set("Accept-Ranges", "bytes")
        if rangeHeader == "" {
                // stream full file
                obj, err := minioClient.GetObject(r.Context(), bucket, path, minio.GetObjectOptions{})
                if err != nil {
                        http.Error(w, "Ошибка доступа к файлу", http.StatusInternalServerError)
                        return
                }
                defer obj.Close()
                if info.Size > 0 {
                        w.Header().Set("Content-Length", fmt.Sprintf("%d", info.Size))
                }
                if info.ContentType != "" {
                        w.Header().Set("Content-Type", info.ContentType)
                } else {
                        w.Header().Set("Content-Type", "application/octet-stream")
                }
                if _, err := io.Copy(w, obj); err != nil {
                        fmt.Println("stream error:", err)
                }
                return
        }

        start, end, err := parseRangeHeader(rangeHeader, info.Size)
        if err != nil {
                w.Header().Set("Content-Range", fmt.Sprintf("bytes */%d", info.Size))
                http.Error(w, "Неверный диапазон", http.StatusRequestedRangeNotSatisfiable)
                return
        }
        opts := minio.GetObjectOptions{}
        if err := opts.SetRange(start, end); err != nil {
                http.Error(w, "Неверный диапазон", http.StatusRequestedRangeNotSatisfiable)
                return
        }
        obj, err := minioClient.GetObject(r.Context(), bucket, path, opts)
        if err != nil {
                http.Error(w, "Ошибка доступа к файлу", http.StatusInternalServerError)
                return
        }
        defer obj.Close()
        length := end - start + 1
        w.Header().Set("Content-Length", fmt.Sprintf("%d", length))
        w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, info.Size))
        if info.ContentType != "" {
                w.Header().Set("Content-Type", info.ContentType)
        } else {
                w.Header().Set("Content-Type", "application/octet-stream")
        }
        w.WriteHeader(http.StatusPartialContent)
        if _, err := io.Copy(w, obj); err != nil {
                fmt.Println("stream error:", err)
        }
}

func parseRangeHeader(header string, size int64) (int64, int64, error) {
        if !strings.HasPrefix(header, "bytes=") {
                return 0, 0, fmt.Errorf("invalid range")
        }
        spec := strings.TrimPrefix(header, "bytes=")
        if strings.HasPrefix(spec, "-") {
                // suffix bytes
                length, err := strconv.ParseInt(spec[1:], 10, 64)
                if err != nil {
                        return 0, 0, err
                }
                if length > size {
                        length = size
                }
                return size - length, size - 1, nil
        }
        parts := strings.Split(spec, "-")
        if len(parts) != 2 {
                return 0, 0, fmt.Errorf("invalid range")
        }
        start, err := strconv.ParseInt(parts[0], 10, 64)
        if err != nil {
                return 0, 0, err
        }
        var end int64
        if parts[1] == "" {
                end = size - 1
        } else {
                end, err = strconv.ParseInt(parts[1], 10, 64)
                if err != nil {
                        return 0, 0, err
                }
                if end >= size {
                        end = size - 1
                }
        }
        if start > end || start < 0 {
                return 0, 0, fmt.Errorf("invalid range")
        }
        return start, end, nil
}

func UploadVideoHandler(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(300 << 20); err != nil {
		http.Error(w, "Слишком большой запрос", http.StatusBadRequest)
		return
	}
	file, hdr, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Видео файл не найден", http.StatusBadRequest)
		return
	}
	defer file.Close()
	title := r.FormValue("title")
	if strings.TrimSpace(title) == "" {
		http.Error(w, "Заголовок обязателен", http.StatusBadRequest)
		return
	}
	description := r.FormValue("description")
	tags := r.FormValue("tags")
	productLinks := r.FormValue("productLinks")
	catStr := r.FormValue("category")
	uid := r.Context().Value(ctxKeyUserID).(int)
	role := r.Context().Value(ctxKeyUserRole).(string)
	if role != "business" {
		productLinks = ""
	}

	objectName := fmt.Sprintf("%d_%d_%s", uid, time.Now().Unix(), hdr.Filename)
	bucket := os.Getenv("MINIO_BUCKET")
	if bucket == "" {
		bucket = "videos"
	}
	_, err = minioClient.PutObject(r.Context(), bucket, objectName, file, hdr.Size, minio.PutObjectOptions{
		ContentType: hdr.Header.Get("Content-Type"),
	})
	if err != nil {
		http.Error(w, "Ошибка сохранения видео", http.StatusInternalServerError)
		return
	}

	var catId *int
	if catStr != "" {
		if x, err := strconv.Atoi(catStr); err == nil {
			catId = &x
		}
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
	if err != nil {
		http.Error(w, "Ошибка сохранения метаданных", http.StatusInternalServerError)
		return
	}

	go func() {
		ctx := context.Background()
		if thumb, err := generatePreviewGIF(ctx, bucket, objectName); err == nil {
			_, _ = db.Exec("UPDATE videos SET thumbnail_path=$1 WHERE id=$2", thumb, videoID)
		}
		if k720, k480, err := transcodeVariants(ctx, bucket, objectName); err == nil {
			_, _ = db.Exec("UPDATE videos SET video_path_720=$1, video_path_480=$2 WHERE id=$3", k720, k480, videoID)
		}
	}()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"message": "Видео загружено, ожидает модерации", "video_id": videoID})
}

func DeleteVideoHandler(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(mux.Vars(r)["id"])
	var owner int
	var path string
	if err := db.QueryRow("SELECT user_id, video_path FROM videos WHERE id=$1", id).Scan(&owner, &path); err != nil {
		http.Error(w, "Видео не найдено", http.StatusNotFound)
		return
	}
	uid := r.Context().Value(ctxKeyUserID).(int)
	role := r.Context().Value(ctxKeyUserRole).(string)
	if uid != owner && role != "admin" {
		http.Error(w, "Нет прав", http.StatusForbidden)
		return
	}
	if _, err := db.Exec("DELETE FROM videos WHERE id=$1", id); err != nil {
		http.Error(w, "Ошибка БД", http.StatusInternalServerError)
		return
	}
	bucket := os.Getenv("MINIO_BUCKET")
	if bucket == "" {
		bucket = "videos"
	}
	if err := minioClient.RemoveObject(r.Context(), bucket, path, minio.RemoveObjectOptions{}); err != nil {
		fmt.Println("MinIO remove error:", err)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Видео удалено"})
}

func LikeVideoHandler(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(mux.Vars(r)["id"])
	uid := r.Context().Value(ctxKeyUserID).(int)
	if _, err := db.Exec("INSERT INTO likes (user_id, video_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", uid, id); err != nil {
		http.Error(w, "Ошибка БД", http.StatusInternalServerError)
		return
	}
	var c int
	_ = db.QueryRow("SELECT COUNT(*) FROM likes WHERE video_id=$1", id).Scan(&c)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"video_id": id, "likes_count": c, "liked": true})
}

func UnlikeVideoHandler(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(mux.Vars(r)["id"])
	uid := r.Context().Value(ctxKeyUserID).(int)
	if _, err := db.Exec("DELETE FROM likes WHERE user_id=$1 AND video_id=$2", uid, id); err != nil {
		http.Error(w, "Ошибка БД", http.StatusInternalServerError)
		return
	}
	var c int
	_ = db.QueryRow("SELECT COUNT(*) FROM likes WHERE video_id=$1", id).Scan(&c)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"video_id": id, "likes_count": c, "liked": false})
}

func ListMyVideosHandler(w http.ResponseWriter, r *http.Request) {
	uid := r.Context().Value(ctxKeyUserID).(int)
	rows, err := db.Query(`SELECT v.id, v.title, v.description, v.tags, v.product_links, v.thumbnail_path, v.video_path,
                v.created_at, v.user_id, COALESCE(u.name,''),
                v.category_id, COALESCE(c.name,''),
                (SELECT COUNT(*) FROM likes l WHERE l.video_id=v.id) as likes,
                (SELECT COUNT(*) FROM comments m WHERE m.video_id=v.id) as comments,
                v.is_approved, (v.video_path_720 IS NOT NULL AND v.video_path_720 <> '') as has_720, (v.video_path_480 IS NOT NULL AND v.video_path_480 <> '') as has_480
         FROM videos v JOIN users u ON u.id=v.user_id
         LEFT JOIN categories c ON c.id=v.category_id
         WHERE v.user_id=$1 ORDER BY v.created_at DESC`, uid)
	if err != nil {
		http.Error(w, "Ошибка получения видео", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	out := []Video{}
	for rows.Next() {
		var v Video
		var catID sql.NullInt32
		if err := rows.Scan(&v.ID, &v.Title, &v.Description, &v.Tags, &v.ProductLinks, &v.Thumbnail, &v.VideoPath,
			&v.CreatedAt, &v.UserID, &v.UserName, &catID, &v.CategoryName, &v.LikesCount, &v.CommentsCount, &v.AvgRating, &v.IsApproved, &v.Has720, &v.Has480); err != nil {
			http.Error(w, "Ошибка данных", http.StatusInternalServerError)
			return
		}
		if catID.Valid {
			v.CategoryID = int(catID.Int32)
		}
		out = append(out, v)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(out)
}

// generatePreviewGIF creates an animated GIF preview from ~6 evenly-spaced frames of the video.
// It downloads the object to a temp file, extracts frames using ffmpeg, builds a GIF, and uploads it back to MinIO.

func generatePreviewGIF(ctx context.Context, bucket, objectKey string) (string, error) {
	dir, err := os.MkdirTemp("", "thumbgen")
	if err != nil {
		return "", err
	}
	defer os.RemoveAll(dir)

	inPath := filepath.Join(dir, "in.mp4")
	obj, err := minioClient.GetObject(ctx, bucket, objectKey, minio.GetObjectOptions{})
	if err != nil {
		return "", err
	}
	defer obj.Close()
	out, err := os.Create(inPath)
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(out, obj); err != nil {
		out.Close()
		return "", err
	}
	out.Close()

	// Duration & timestamps
	dur, err := probeDuration(inPath)
	if err != nil || dur <= 0 {
		dur = 12.0
	} // fallback
	perc := []float64{0.10, 0.25, 0.40, 0.55, 0.70, 0.85}
	times := []float64{}
	for _, p := range perc {
		t := p * dur
		if t < 0 {
			t = 0
		}
		times = append(times, t)
	}

	// Extract 6 frames with crop->scale to 480x270
	jpgs := []string{}
	for i, t := range times {
		jpg := filepath.Join(dir, fmt.Sprintf("thumb%02d.jpg", i))
		cmd := exec.Command("ffmpeg", "-y", "-loglevel", "error",
			"-ss", fmt.Sprintf("%.3f", t), "-i", inPath, "-vframes", "1",
			"-vf", "crop='min(in_w,in_h*16/9)':'min(in_h,in_w*9/16)',scale=480:270:flags=lanczos",
			jpg)
		if err := cmd.Run(); err != nil {
			return "", fmt.Errorf("ffmpeg extract frame %.3f failed: %w", t, err)
		}
		jpgs = append(jpgs, jpg)
	}

	// Build GIF ~2 fps with palette
	gifPath := filepath.Join(dir, "preview.gif")
	cmdGif := exec.Command("ffmpeg", "-y", "-loglevel", "error",
		"-framerate", "2", "-i", filepath.Join(dir, "thumb%02d.jpg"),
		"-vf", "split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=new=1",
		"-loop", "0", gifPath)
	if err := cmdGif.Run(); err != nil {
		return "", fmt.Errorf("ffmpeg gif build failed: %w", err)
	}

	// Upload GIF
	thumbKey := objectKey + ".gif"
	f, err := os.Open(gifPath)
	if err != nil {
		return "", err
	}
	defer f.Close()
	st, _ := f.Stat()
	_, err = minioClient.PutObject(ctx, bucket, thumbKey, f, st.Size(), minio.PutObjectOptions{ContentType: "image/gif"})
	if err != nil {
		return "", err
	}

	// Upload static JPG (first frame)
	staticJPG := filepath.Join(dir, "thumb00.jpg")
	if _, err := os.Stat(staticJPG); err == nil {
		jf, _ := os.Open(staticJPG)
		if jf != nil {
			defer jf.Close()
			jst, _ := jf.Stat()
			_, _ = minioClient.PutObject(ctx, bucket, thumbKey+".jpg", jf, jst.Size(), minio.PutObjectOptions{
				ContentType: "image/jpeg",
			})
		}
	}
	return thumbKey, nil
}

// VideoThumbnailHandler serves the animated GIF preview from MinIO
func VideoThumbnailHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Некорректный ID", http.StatusBadRequest)
		return
	}
	var key string
	err = db.QueryRow("SELECT thumbnail_path FROM videos WHERE id=$1", id).Scan(&key)
	if err != nil || key == "" {
		http.Error(w, "Превью не найдено", http.StatusNotFound)
		return
	}
	bucketName := os.Getenv("MINIO_BUCKET")
	if bucketName == "" {
		bucketName = "videos"
	}
	obj, err := minioClient.GetObject(r.Context(), bucketName, key, minio.GetObjectOptions{})
	if err != nil {
		http.Error(w, "Ошибка доступа к превью", http.StatusInternalServerError)
		return
	}
	defer obj.Close()
	w.Header().Set("Content-Type", "image/gif")
	if _, err := io.Copy(w, obj); err != nil {
		fmt.Println("send thumb err:", err)
	}
}

// VideoThumbnailStaticHandler serves static JPG preview (first frame); falls back to GIF if JPG not found
func VideoThumbnailStaticHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Некорректный ID", http.StatusBadRequest)
		return
	}
	var key string
	if err := db.QueryRow("SELECT thumbnail_path FROM videos WHERE id=$1", id).Scan(&key); err != nil || key == "" {
		http.Error(w, "Превью не найдено", http.StatusNotFound)
		return
	}
	bucket := os.Getenv("MINIO_BUCKET")
	if bucket == "" {
		bucket = "videos"
	}
	// Try JPG first
	jpgKey := key + ".jpg"
	obj, err := minioClient.GetObject(r.Context(), bucket, jpgKey, minio.GetObjectOptions{})
	if err == nil {
		defer obj.Close()
		w.Header().Set("Content-Type", "image/jpeg")
		if _, err := io.Copy(w, obj); err == nil {
			return
		}
	}
	// Fallback to GIF
	obj2, err2 := minioClient.GetObject(r.Context(), bucket, key, minio.GetObjectOptions{})
	if err2 != nil {
		http.Error(w, "Ошибка доступа к превью", http.StatusInternalServerError)
		return
	}
	defer obj2.Close()
	w.Header().Set("Content-Type", "image/gif")
	io.Copy(w, obj2)
}

// VideoThumbnailAnimatedHandler serves animated GIF preview
func VideoThumbnailAnimatedHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Некорректный ID", http.StatusBadRequest)
		return
	}
	var key string
	if err := db.QueryRow("SELECT thumbnail_path FROM videos WHERE id=$1", id).Scan(&key); err != nil || key == "" {
		http.Error(w, "Превью не найдено", http.StatusNotFound)
		return
	}
	bucket := os.Getenv("MINIO_BUCKET")
	if bucket == "" {
		bucket = "videos"
	}
	obj, err := minioClient.GetObject(r.Context(), bucket, key, minio.GetObjectOptions{})
	if err != nil {
		http.Error(w, "Ошибка доступа к превью", http.StatusInternalServerError)
		return
	}
	defer obj.Close()
	w.Header().Set("Content-Type", "image/gif")
	io.Copy(w, obj)
}

// probeDuration returns duration in seconds using ffprobe
func probeDuration(path string) (float64, error) {
	cmd := exec.Command("ffprobe", "-v", "error", "-show_entries", "format=duration",
		"-of", "default=noprint_wrappers=1:nokey=1", path)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return 0, fmt.Errorf("ffprobe failed: %v (%s)", err, string(out))
	}
	var dur float64
	_, scanErr := fmt.Sscanf(string(out), "%f", &dur)
	if scanErr != nil {
		return 0, scanErr
	}
	return dur, nil
}

// transcodeVariants creates 720p and 480p variants and uploads to MinIO.
func transcodeVariants(ctx context.Context, bucket, objectKey string) (string, string, error) {
	dir, err := os.MkdirTemp("", "transcode")
	if err != nil {
		return "", "", err
	}
	defer os.RemoveAll(dir)

	inPath := filepath.Join(dir, "in.mp4")
	obj, err := minioClient.GetObject(ctx, bucket, objectKey, minio.GetObjectOptions{})
	if err != nil {
		return "", "", err
	}
	defer obj.Close()
	out, err := os.Create(inPath)
	if err != nil {
		return "", "", err
	}
	if _, err := io.Copy(out, obj); err != nil {
		out.Close()
		return "", "", err
	}
	out.Close()

	out720 := filepath.Join(dir, "out_720.mp4")
	out480 := filepath.Join(dir, "out_480.mp4")
	// 720p (1280x720)
	cmd720 := exec.Command("ffmpeg", "-y", "-loglevel", "error", "-i", inPath,
		"-vf", "scale=w=1280:h=720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black",
		"-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-b:a", "128k", out720)
	if err := cmd720.Run(); err != nil {
		return "", "", fmt.Errorf("ffmpeg 720p failed: %w", err)
	}

	// 480p (854x480)
	cmd480 := exec.Command("ffmpeg", "-y", "-loglevel", "error", "-i", inPath,
		"-vf", "scale=w=854:h=480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2:color=black",
		"-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-c:a", "aac", "-b:a", "96k", out480)
	if err := cmd480.Run(); err != nil {
		return "", "", fmt.Errorf("ffmpeg 480p failed: %w", err)
	}

	// upload both
	key720 := objectKey + ".720.mp4"
	key480 := objectKey + ".480.mp4"
	if f, err := os.Open(out720); err == nil {
		st, _ := f.Stat()
		_, err = minioClient.PutObject(ctx, bucket, key720, f, st.Size(), minio.PutObjectOptions{ContentType: "video/mp4"})
		f.Close()
		if err != nil {
			return "", "", err
		}
	} else {
		return "", "", err
	}

	if f, err := os.Open(out480); err == nil {
		st, _ := f.Stat()
		_, err = minioClient.PutObject(ctx, bucket, key480, f, st.Size(), minio.PutObjectOptions{ContentType: "video/mp4"})
		f.Close()
		if err != nil {
			return "", "", err
		}
	} else {
		return "", "", err
	}

	return key720, key480, nil
}

// RateVideoHandler sets/updates a rating 1..7
func RateVideoHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.Atoi(vars["id"])
	uid := r.Context().Value(ctxKeyUserID).(int)
	var req struct {
		Value int `json:"value"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Value < 1 || req.Value > 7 {
		http.Error(w, "Оценка 1..7", http.StatusBadRequest)
		return
	}
	_, err := db.Exec("INSERT INTO ratings (user_id, video_id, value) VALUES ($1,$2,$3) ON CONFLICT (user_id,video_id) DO UPDATE SET value=EXCLUDED.value",
		uid, id, req.Value)
	if err != nil {
		http.Error(w, "Ошибка БД", http.StatusInternalServerError)
		return
	}
	var avg float64
	_ = db.QueryRow("SELECT COALESCE(AVG(value),0) FROM ratings WHERE video_id=$1", id).Scan(&avg)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"video_id": id, "my_rating": req.Value, "avg_rating": avg})
}

func UnrateVideoHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.Atoi(vars["id"])
	uid := r.Context().Value(ctxKeyUserID).(int)
	_, err := db.Exec("DELETE FROM ratings WHERE user_id=$1 AND video_id=$2", uid, id)
	if err != nil {
		http.Error(w, "Ошибка БД", http.StatusInternalServerError)
		return
	}
	var avg float64
	_ = db.QueryRow("SELECT COALESCE(AVG(value),0) FROM ratings WHERE video_id=$1", id).Scan(&avg)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"video_id": id, "my_rating": 0, "avg_rating": avg})
}

// UpdateCommentHandler - edit own comment or admin
func UpdateCommentHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	videoId, _ := strconv.Atoi(vars["id"])
	commentId, _ := strconv.Atoi(vars["commentId"])
	uid := r.Context().Value(ctxKeyUserID).(int)
	role := r.Context().Value(ctxKeyUserRole).(string)
	var author int
	if err := db.QueryRow("SELECT user_id FROM comments WHERE id=$1 AND video_id=$2", commentId, videoId).Scan(&author); err != nil {
		http.Error(w, "Комментарий не найден", http.StatusNotFound)
		return
	}
	if uid != author && role != "admin" {
		http.Error(w, "Нет прав", http.StatusForbidden)
		return
	}
	var req struct {
		Text string `json:"text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Text) == "" {
		http.Error(w, "Некорректный текст", http.StatusBadRequest)
		return
	}
	if _, err := db.Exec("UPDATE comments SET text=$1 WHERE id=$2", req.Text, commentId); err != nil {
		http.Error(w, "Ошибка БД", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"id": commentId, "text": req.Text})
}
