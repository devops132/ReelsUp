package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	pq "github.com/lib/pq"
)

func CategoriesHandler(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query(`
        WITH RECURSIVE tree AS (
            SELECT id, name, parent_id, COALESCE(position, 0) AS pos,
                   1 AS depth,
                   ARRAY[COALESCE(position, 0), id] AS sort_path,
                   ARRAY[name] AS path_names
            FROM categories
            WHERE parent_id IS NULL
            UNION ALL
            SELECT c.id, c.name, c.parent_id, COALESCE(c.position, 0) AS pos,
                   tree.depth + 1,
                   tree.sort_path || COALESCE(c.position, 0) || c.id,
                   tree.path_names || c.name
            FROM categories c
            JOIN tree ON c.parent_id = tree.id
        ),
        orphans AS (
            SELECT c.id, c.name, c.parent_id, COALESCE(c.position, 0) AS pos,
                   1 AS depth,
                   ARRAY[COALESCE(c.position, 0), c.id] AS sort_path,
                   ARRAY[c.name] AS path_names
            FROM categories c
            WHERE NOT EXISTS (SELECT 1 FROM tree t WHERE t.id = c.id)
        )
        SELECT id, name, parent_id, depth, path_names
        FROM (
            SELECT id, name, parent_id, depth, path_names, sort_path FROM tree
            UNION ALL
            SELECT id, name, parent_id, depth, path_names, sort_path FROM orphans
        ) AS all_nodes
        ORDER BY sort_path;
    `)
	if err != nil {
		http.Error(w, "Ошибка получения категорий", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	list := []Category{}
	for rows.Next() {
		var c Category
		var parent sql.NullInt32
		var path pq.StringArray
		if err := rows.Scan(&c.ID, &c.Name, &parent, &c.Depth, &path); err != nil {
			http.Error(w, "Ошибка БД", http.StatusInternalServerError)
			return
		}
		if parent.Valid {
			v := int(parent.Int32)
			c.ParentID = &v
		}
		labels := []string(path)
		if len(labels) > 0 {
			c.Path = strings.Join(labels, " › ")
		} else {
			c.Path = c.Name
		}
		list = append(list, c)
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(list)
}
