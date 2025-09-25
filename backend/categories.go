package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
)

type CategoryTreeNode struct {
	ID       int                 `json:"id"`
	Name     string              `json:"name"`
	ParentID *int                `json:"parent_id,omitempty"`
	Depth    int                 `json:"depth"`
	Children []*CategoryTreeNode `json:"children,omitempty"`
}

func CategoriesHandler(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id, name, parent_id FROM categories ORDER BY parent_id NULLS FIRST, position ASC, name ASC")
	if err != nil {
		http.Error(w, "Ошибка получения категорий", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type orderedNode struct {
		node      *CategoryTreeNode
		parentID  int
		hasParent bool
	}

	nodes := make(map[int]*CategoryTreeNode)
	ordered := make([]orderedNode, 0)

	for rows.Next() {
		var id int
		var name string
		var parent sql.NullInt32
		if err := rows.Scan(&id, &name, &parent); err != nil {
			http.Error(w, "Ошибка БД", http.StatusInternalServerError)
			return
		}

		node := &CategoryTreeNode{ID: id, Name: name}
		if parent.Valid {
			pid := int(parent.Int32)
			node.ParentID = &pid
			ordered = append(ordered, orderedNode{node: node, parentID: pid, hasParent: true})
		} else {
			ordered = append(ordered, orderedNode{node: node})
		}
		nodes[id] = node
	}
	if err := rows.Err(); err != nil {
		http.Error(w, "Ошибка чтения категорий", http.StatusInternalServerError)
		return
	}

	roots := make([]*CategoryTreeNode, 0)
	for _, item := range ordered {
		if item.hasParent {
			parentNode, ok := nodes[item.parentID]
			if ok {
				parentNode.Children = append(parentNode.Children, item.node)
			} else {
				item.node.ParentID = nil
				roots = append(roots, item.node)
			}
			continue
		}
		roots = append(roots, item.node)
	}

	type queueItem struct {
		node  *CategoryTreeNode
		depth int
	}
	queue := make([]queueItem, 0, len(roots))
	for _, root := range roots {
		queue = append(queue, queueItem{node: root, depth: 1})
	}
	for len(queue) > 0 {
		item := queue[0]
		queue = queue[1:]
		item.node.Depth = item.depth
		for _, child := range item.node.Children {
			queue = append(queue, queueItem{node: child, depth: item.depth + 1})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(roots)
}
