
package main

import (
    "encoding/json"
    "net/http"
    "strconv"
    "strings"
    "time"

    "github.com/gorilla/mux"
)

type Comment struct {
    ID        int    `json:"id"`
    Text      string `json:"text"`
    CreatedAt string `json:"created_at"`
    User      struct {
        ID   int    `json:"id"`
        Name string `json:"name"`
    } `json:"user"`
}

func ListCommentsHandler(w http.ResponseWriter, r *http.Request) {
    vid, _ := strconv.Atoi(mux.Vars(r)["id"])
    rows, err := db.Query(`SELECT c.id, c.text, c.created_at, u.id, COALESCE(u.name,'')
                           FROM comments c JOIN users u ON u.id=c.user_id
                           WHERE c.video_id=$1 ORDER BY c.created_at ASC`, vid)
    if err != nil { http.Error(w,"Ошибка получения комментариев",http.StatusInternalServerError); return }
    defer rows.Close()
    out := []Comment{}
    for rows.Next() {
        var c Comment; var t time.Time; var uid int; var name string
        if err := rows.Scan(&c.ID,&c.Text,&t,&uid,&name); err != nil { http.Error(w,"Ошибка БД",http.StatusInternalServerError); return }
        c.CreatedAt = t.Format(time.RFC3339)
        c.User.ID = uid; c.User.Name = name
        out = append(out, c)
    }
    w.Header().Set("Content-Type","application/json")
    json.NewEncoder(w).Encode(out)
}

func CreateCommentHandler(w http.ResponseWriter, r *http.Request) {
    vid, _ := strconv.Atoi(mux.Vars(r)["id"])
    var req struct{ Text string `json:"text"` }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil { http.Error(w,"Некорректный формат",http.StatusBadRequest); return }
    if strings.TrimSpace(req.Text) == "" { http.Error(w,"Текст пуст",http.StatusBadRequest); return }
    uid := r.Context().Value(ctxKeyUserID).(int)
    var id int; var created time.Time
    if err := db.QueryRow("INSERT INTO comments (video_id,user_id,text) VALUES ($1,$2,$3) RETURNING id, created_at", vid, uid, req.Text).Scan(&id, &created); err != nil {
        http.Error(w,"Ошибка сохранения",http.StatusInternalServerError); return
    }
    var name string; _ = db.QueryRow("SELECT COALESCE(name,'') FROM users WHERE id=$1", uid).Scan(&name)
    c := Comment{ID:id, Text:req.Text, CreatedAt:created.Format(time.RFC3339)}
    c.User.ID = uid; c.User.Name = name
    w.Header().Set("Content-Type","application/json")
    json.NewEncoder(w).Encode(c)
}

func DeleteCommentHandler(w http.ResponseWriter, r *http.Request) {
    vid, _ := strconv.Atoi(mux.Vars(r)["id"])
    cid, _ := strconv.Atoi(mux.Vars(r)["commentId"])
    var author int
    if err := db.QueryRow("SELECT user_id FROM comments WHERE id=$1 AND video_id=$2", cid, vid).Scan(&author); err != nil {
        http.Error(w,"Комментарий не найден",http.StatusNotFound); return
    }
    uid := r.Context().Value(ctxKeyUserID).(int)
    role := r.Context().Value(ctxKeyUserRole).(string)
    if uid != author && role != "admin" { http.Error(w,"Нет прав",http.StatusForbidden); return }
    if _, err := db.Exec("DELETE FROM comments WHERE id=$1", cid); err != nil { http.Error(w,"Ошибка удаления",http.StatusInternalServerError); return }
    w.Header().Set("Content-Type","application/json")
    json.NewEncoder(w).Encode(map[string]string{"message":"Комментарий удален"})
}
