package main

import (
	"encoding/json"
	"net/http"
)

func CategoriesHandler(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id, name, parent_id FROM categories ORDER BY name ASC")
	if err != nil {
		http.Error(w, "Ошибка получения категорий", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	type cat struct {
		ID       int    `json:"id"`
		Name     string `json:"name"`
		ParentID *int   `json:"parent_id"`
	}
	list := []cat{}
	for rows.Next() {
		var c cat
		var pid *int
		if err := rows.Scan(&c.ID, &c.Name, &pid); err != nil {
			http.Error(w, "Ошибка БД", http.StatusInternalServerError)
			return
		}
		c.ParentID = pid
		list = append(list, c)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
}
