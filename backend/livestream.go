package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
)

type LiveStream struct {
	ID           int        `json:"id"`
	Title        string     `json:"title"`
	Description  string     `json:"description"`
	StreamURL    string     `json:"stream_url"`
	ThumbnailURL string     `json:"thumbnail_url"`
	Status       string     `json:"status"`
	ScheduledAt  *time.Time `json:"scheduled_at,omitempty"`
	StartedAt    *time.Time `json:"started_at,omitempty"`
	EndedAt      *time.Time `json:"ended_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UserID       int        `json:"user_id"`
	UserName     string     `json:"user_name"`
}

func scanLiveStreams(rows *sql.Rows) ([]LiveStream, error) {
	defer rows.Close()
	items := []LiveStream{}
	for rows.Next() {
		var ls LiveStream
		var scheduled, started, ended sql.NullTime
		if err := rows.Scan(&ls.ID, &ls.Title, &ls.Description, &ls.StreamURL, &ls.ThumbnailURL, &ls.Status,
			&scheduled, &started, &ended, &ls.CreatedAt, &ls.UserID, &ls.UserName); err != nil {
			return nil, err
		}
		if scheduled.Valid {
			t := scheduled.Time
			ls.ScheduledAt = &t
		}
		if started.Valid {
			t := started.Time
			ls.StartedAt = &t
		}
		if ended.Valid {
			t := ended.Time
			ls.EndedAt = &t
		}
		items = append(items, ls)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func getLiveStreamByID(id int) (*LiveStream, error) {
	var ls LiveStream
	var scheduled, started, ended sql.NullTime
	err := db.QueryRow(`SELECT l.id, l.title, l.description, l.stream_url, l.thumbnail_url, l.status,
            l.scheduled_at, l.started_at, l.ended_at, l.created_at, l.user_id, COALESCE(u.name,'')
        FROM live_streams l
        JOIN users u ON u.id = l.user_id
        WHERE l.id = $1`, id).Scan(&ls.ID, &ls.Title, &ls.Description, &ls.StreamURL, &ls.ThumbnailURL, &ls.Status,
		&scheduled, &started, &ended, &ls.CreatedAt, &ls.UserID, &ls.UserName)
	if err != nil {
		return nil, err
	}
	if scheduled.Valid {
		t := scheduled.Time
		ls.ScheduledAt = &t
	}
	if started.Valid {
		t := started.Time
		ls.StartedAt = &t
	}
	if ended.Valid {
		t := ended.Time
		ls.EndedAt = &t
	}
	return &ls, nil
}

func normalizeLiveStreamStatus(status string) (string, bool) {
	s := strings.ToLower(strings.TrimSpace(status))
	if s == "" {
		return "", false
	}
	switch s {
	case "live", "scheduled", "ended":
		return s, true
	default:
		return "", false
	}
}

func ListLiveStreamsHandler(w http.ResponseWriter, r *http.Request) {
	status := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("status")))
	limit := 20
	if l := strings.TrimSpace(r.URL.Query().Get("limit")); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 {
			if v > 100 {
				v = 100
			}
			limit = v
		}
	}
	query := `SELECT l.id, l.title, l.description, l.stream_url, l.thumbnail_url, l.status,
            l.scheduled_at, l.started_at, l.ended_at, l.created_at, l.user_id, COALESCE(u.name,'')
        FROM live_streams l
        JOIN users u ON u.id = l.user_id`
	conds := []string{}
	switch status {
	case "", "live":
		conds = append(conds, "l.status='live'")
	case "scheduled":
		conds = append(conds, "l.status='scheduled'")
	case "ended":
		conds = append(conds, "l.status='ended'")
	case "all":
		// no extra condition
	default:
		http.Error(w, "Недопустимый статус", http.StatusBadRequest)
		return
	}
	if len(conds) > 0 {
		query += " WHERE " + strings.Join(conds, " AND ")
	}
	switch status {
	case "scheduled":
		query += " ORDER BY COALESCE(l.scheduled_at, l.created_at) ASC"
	case "ended":
		query += " ORDER BY COALESCE(l.ended_at, l.created_at) DESC"
	default:
		query += " ORDER BY COALESCE(l.started_at, l.created_at) DESC"
	}
	// Use a literal LIMIT to avoid driver-specific issues with parameterized LIMIT
	query += fmt.Sprintf(" LIMIT %d", limit)
	rows, err := db.Query(query)
	if err != nil {
		log.Printf("ListLiveStreamsHandler: query error: %v", err)
		http.Error(w, "Ошибка получения трансляций", http.StatusInternalServerError)
		return
	}
	streams, err := scanLiveStreams(rows)
	if err != nil {
		log.Printf("ListLiveStreamsHandler: scan error: %v", err)
		http.Error(w, "Ошибка данных", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(streams)
}

func GetLiveStreamHandler(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(mux.Vars(r)["id"])
	stream, err := getLiveStreamByID(id)
	if err == sql.ErrNoRows {
		http.Error(w, "Трансляция не найдена", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "Ошибка получения трансляции", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stream)
}

func ListMyLiveStreamsHandler(w http.ResponseWriter, r *http.Request) {
	uid := r.Context().Value(ctxKeyUserID).(int)
	status := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("status")))
	query := `SELECT l.id, l.title, l.description, l.stream_url, l.thumbnail_url, l.status,
            l.scheduled_at, l.started_at, l.ended_at, l.created_at, l.user_id, COALESCE(u.name,'')
        FROM live_streams l
        JOIN users u ON u.id = l.user_id
        WHERE l.user_id = $1`
	params := []any{uid}
	switch status {
	case "", "all":
		// keep all statuses
	case "live", "scheduled", "ended":
		params = append(params, status)
		query += fmt.Sprintf(" AND l.status=$%d", len(params))
	default:
		http.Error(w, "Недопустимый статус", http.StatusBadRequest)
		return
	}
	query += " ORDER BY COALESCE(l.started_at, l.scheduled_at, l.created_at) DESC"
	rows, err := db.Query(query, params...)
	if err != nil {
		http.Error(w, "Ошибка получения трансляций", http.StatusInternalServerError)
		return
	}
	streams, err := scanLiveStreams(rows)
	if err != nil {
		http.Error(w, "Ошибка данных", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(streams)
}

func CreateLiveStreamHandler(w http.ResponseWriter, r *http.Request) {
	uid := r.Context().Value(ctxKeyUserID).(int)
	var req struct {
		Title        string  `json:"title"`
		Description  string  `json:"description"`
		StreamURL    string  `json:"stream_url"`
		ThumbnailURL string  `json:"thumbnail_url"`
		ScheduledAt  *string `json:"scheduled_at"`
		Status       string  `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Некорректные данные", http.StatusBadRequest)
		return
	}
	title := strings.TrimSpace(req.Title)
	streamURL := strings.TrimSpace(req.StreamURL)
	if title == "" || streamURL == "" {
		http.Error(w, "Название и ссылка обязательны", http.StatusBadRequest)
		return
	}
	status := "scheduled"
	if s, ok := normalizeLiveStreamStatus(req.Status); ok {
		status = s
	} else if strings.TrimSpace(req.Status) != "" {
		http.Error(w, "Недопустимый статус", http.StatusBadRequest)
		return
	}
	var scheduled sql.NullTime
	if req.ScheduledAt != nil && strings.TrimSpace(*req.ScheduledAt) != "" {
		if t, err := time.Parse(time.RFC3339, *req.ScheduledAt); err == nil {
			scheduled = sql.NullTime{Valid: true, Time: t}
		} else {
			http.Error(w, "Некорректная дата начала", http.StatusBadRequest)
			return
		}
	}
	started := sql.NullTime{}
	if status == "live" {
		started = sql.NullTime{Valid: true, Time: time.Now()}
	}
	var id int
	err := db.QueryRow(`INSERT INTO live_streams (user_id, title, description, stream_url, thumbnail_url, status, scheduled_at, started_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
		uid, title, strings.TrimSpace(req.Description), streamURL, strings.TrimSpace(req.ThumbnailURL), status, scheduled, started).Scan(&id)
	if err != nil {
		http.Error(w, "Не удалось создать трансляцию", http.StatusInternalServerError)
		return
	}
	stream, err := getLiveStreamByID(id)
	if err != nil {
		http.Error(w, "Ошибка получения трансляции", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stream)
}

func UpdateLiveStreamHandler(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(mux.Vars(r)["id"])
	uid := r.Context().Value(ctxKeyUserID).(int)
	role := r.Context().Value(ctxKeyUserRole).(string)
	var owner int
	if err := db.QueryRow("SELECT user_id FROM live_streams WHERE id=$1", id).Scan(&owner); err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Трансляция не найдена", http.StatusNotFound)
			return
		}
		http.Error(w, "Ошибка базы данных", http.StatusInternalServerError)
		return
	}
	if owner != uid && role != "admin" {
		http.Error(w, "Нет прав", http.StatusForbidden)
		return
	}
	var req struct {
		Title        string  `json:"title"`
		Description  string  `json:"description"`
		StreamURL    string  `json:"stream_url"`
		ThumbnailURL string  `json:"thumbnail_url"`
		ScheduledAt  *string `json:"scheduled_at"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Некорректные данные", http.StatusBadRequest)
		return
	}
	title := strings.TrimSpace(req.Title)
	streamURL := strings.TrimSpace(req.StreamURL)
	if title == "" || streamURL == "" {
		http.Error(w, "Название и ссылка обязательны", http.StatusBadRequest)
		return
	}
	var scheduled sql.NullTime
	if req.ScheduledAt != nil {
		if strings.TrimSpace(*req.ScheduledAt) == "" {
			scheduled = sql.NullTime{Valid: false}
		} else if t, err := time.Parse(time.RFC3339, *req.ScheduledAt); err == nil {
			scheduled = sql.NullTime{Valid: true, Time: t}
		} else {
			http.Error(w, "Некорректная дата начала", http.StatusBadRequest)
			return
		}
	} else {
		// keep existing value by selecting current scheduled_at
		if err := db.QueryRow("SELECT scheduled_at FROM live_streams WHERE id=$1", id).Scan(&scheduled); err != nil {
			http.Error(w, "Ошибка чтения данных", http.StatusInternalServerError)
			return
		}
	}
	_, err := db.Exec(`UPDATE live_streams SET title=$1, description=$2, stream_url=$3, thumbnail_url=$4, scheduled_at=$5 WHERE id=$6`,
		title, strings.TrimSpace(req.Description), streamURL, strings.TrimSpace(req.ThumbnailURL), scheduled, id)
	if err != nil {
		http.Error(w, "Не удалось обновить трансляцию", http.StatusInternalServerError)
		return
	}
	stream, err := getLiveStreamByID(id)
	if err != nil {
		http.Error(w, "Ошибка получения трансляции", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stream)
}

func UpdateLiveStreamStatusHandler(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(mux.Vars(r)["id"])
	uid := r.Context().Value(ctxKeyUserID).(int)
	role := r.Context().Value(ctxKeyUserRole).(string)
	var owner int
	if err := db.QueryRow("SELECT user_id FROM live_streams WHERE id=$1", id).Scan(&owner); err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Трансляция не найдена", http.StatusNotFound)
			return
		}
		http.Error(w, "Ошибка базы данных", http.StatusInternalServerError)
		return
	}
	if owner != uid && role != "admin" {
		http.Error(w, "Нет прав", http.StatusForbidden)
		return
	}
	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Некорректные данные", http.StatusBadRequest)
		return
	}
	status, ok := normalizeLiveStreamStatus(req.Status)
	if !ok {
		http.Error(w, "Недопустимый статус", http.StatusBadRequest)
		return
	}
	var err error
	switch status {
	case "live":
		_, err = db.Exec("UPDATE live_streams SET status='live', started_at=COALESCE(started_at, NOW()), ended_at=NULL WHERE id=$1", id)
	case "scheduled":
		_, err = db.Exec("UPDATE live_streams SET status='scheduled', started_at=NULL, ended_at=NULL WHERE id=$1", id)
	case "ended":
		_, err = db.Exec("UPDATE live_streams SET status='ended', ended_at=NOW() WHERE id=$1", id)
	}
	if err != nil {
		http.Error(w, "Не удалось обновить статус", http.StatusInternalServerError)
		return
	}
	stream, err := getLiveStreamByID(id)
	if err != nil {
		http.Error(w, "Ошибка получения трансляции", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stream)
}

func DeleteLiveStreamHandler(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(mux.Vars(r)["id"])
	uid := r.Context().Value(ctxKeyUserID).(int)
	role := r.Context().Value(ctxKeyUserRole).(string)
	var owner int
	if err := db.QueryRow("SELECT user_id FROM live_streams WHERE id=$1", id).Scan(&owner); err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Трансляция не найдена", http.StatusNotFound)
			return
		}
		http.Error(w, "Ошибка базы данных", http.StatusInternalServerError)
		return
	}
	if owner != uid && role != "admin" {
		http.Error(w, "Нет прав", http.StatusForbidden)
		return
	}
	if _, err := db.Exec("DELETE FROM live_streams WHERE id=$1", id); err != nil {
		http.Error(w, "Не удалось удалить трансляцию", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"message": "Трансляция удалена"})
}
