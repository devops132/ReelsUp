
package main

import (
    "database/sql"
    "encoding/json"
    "net/http"
    "strconv"
    "strings"

    "github.com/gorilla/mux"
)

func AdminListVideosHandler(w http.ResponseWriter, r *http.Request) {
    rows, err := db.Query(`SELECT v.id, v.title, v.description, v.tags, v.product_links, v.thumbnail_path, v.video_path,
                v.created_at, v.user_id, COALESCE(u.name,''),
                v.category_id, COALESCE(c.name,''),
                (SELECT COUNT(*) FROM likes l WHERE l.video_id=v.id) as likes,
                (SELECT COUNT(*) FROM comments m WHERE m.video_id=v.id) as comments,
                v.is_approved
         FROM videos v JOIN users u ON u.id=v.user_id
         LEFT JOIN categories c ON c.id=v.category_id
         ORDER BY v.created_at DESC`)
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

func AdminApproveVideoHandler(w http.ResponseWriter, r *http.Request) {
    id, _ := strconv.Atoi(mux.Vars(r)["id"])
    res, err := db.Exec("UPDATE videos SET is_approved=TRUE WHERE id=$1", id)
    if err != nil { http.Error(w,"Ошибка обновления",http.StatusInternalServerError); return }
    if n, _ := res.RowsAffected(); n == 0 { http.Error(w,"Видео не найдено",http.StatusNotFound); return }
    w.Header().Set("Content-Type","application/json")
    json.NewEncoder(w).Encode(map[string]string{"message":"Видео одобрено"})
}

func AdminDeleteVideoHandler(w http.ResponseWriter, r *http.Request) {
    DeleteVideoHandler(w, r)
}

func AdminListUsersHandler(w http.ResponseWriter, r *http.Request) {
    rows, err := db.Query("SELECT id, email, COALESCE(name,''), role FROM users ORDER BY id ASC")
    if err != nil { http.Error(w,"Ошибка получения пользователей",http.StatusInternalServerError); return }
    defer rows.Close()
    out := []map[string]any{}
    for rows.Next() {
        var id int; var email, name, role string
        if err := rows.Scan(&id,&email,&name,&role); err != nil { http.Error(w,"Ошибка данных",http.StatusInternalServerError); return }
        out = append(out, map[string]any{"id":id,"email":email,"name":name,"role":role})
    }
    w.Header().Set("Content-Type","application/json")
    json.NewEncoder(w).Encode(out)
}

func AdminUpdateUserRoleHandler(w http.ResponseWriter, r *http.Request) {
    uid, _ := strconv.Atoi(mux.Vars(r)["id"])
    var req struct{ Role string `json:"role"` }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil { http.Error(w,"Некорректный запрос",http.StatusBadRequest); return }
    role := strings.ToLower(req.Role)
    if role != "user" && role != "business" && role != "admin" { http.Error(w,"Недопустимая роль",http.StatusBadRequest); return }
    var id int; var email, name, newRole string
    if err := db.QueryRow("UPDATE users SET role=$1 WHERE id=$2 RETURNING id, email, COALESCE(name,''), role", role, uid).Scan(&id,&email,&name,&newRole); err != nil {
        http.Error(w,"Ошибка обновления",http.StatusInternalServerError); return
    }
    w.Header().Set("Content-Type","application/json")
    json.NewEncoder(w).Encode(map[string]any{"id":id,"email":email,"name":name,"role":newRole})
}
