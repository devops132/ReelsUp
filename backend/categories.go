
package main

import (
    "encoding/json"
    "net/http"
)

func CategoriesHandler(w http.ResponseWriter, r *http.Request) {
    rows, err := db.Query("SELECT id, name FROM categories ORDER BY id ASC")
    if err != nil { http.Error(w, "Ошибка получения категорий", http.StatusInternalServerError); return }
    defer rows.Close()
    type cat struct{ ID int `json:"id"`; Name string `json:"name"` }
    list := []cat{}
    for rows.Next() {
        var c cat
        if err := rows.Scan(&c.ID, &c.Name); err != nil { http.Error(w, "Ошибка БД", http.StatusInternalServerError); return }
        list = append(list, c)
    }
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(list)
}
