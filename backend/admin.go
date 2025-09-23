package main

import (
    "database/sql"
    "encoding/json"
    "net/http"
    "strconv"
    "strings"

    "github.com/gorilla/mux"
    pq "github.com/lib/pq"
)

func AdminListVideosHandler(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query(
		`SELECT
			v.id, v.title, v.description, v.tags, v.product_links, v.thumbnail_path, v.video_path,
			v.created_at, v.user_id, COALESCE(u.name,''),
			v.category_id, COALESCE(c.name,''),
            (SELECT COUNT(*) FROM likes l WHERE l.video_id = v.id)            AS likes_count,
            (SELECT COUNT(*) FROM dislikes d WHERE d.video_id = v.id)         AS dislikes_count,
			(SELECT COUNT(*) FROM comments m WHERE m.video_id = v.id)         AS comments_count,
			COALESCE((SELECT AVG(value) FROM ratings r WHERE r.video_id = v.id),0) AS avg_rating,
			v.is_approved,
			(v.video_path_720 IS NOT NULL AND v.video_path_720 <> '') AS has_720,
            (v.video_path_480 IS NOT NULL AND v.video_path_480 <> '') AS has_480,
            v.views_count
                FROM videos v
                JOIN users u ON u.id = v.user_id
                LEFT JOIN categories c ON c.id = v.category_id
                WHERE v.is_approved = FALSE
                ORDER BY v.created_at DESC`)
	if err != nil {
		http.Error(w, "Ошибка получения видео", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	videos := []Video{}
	for rows.Next() {
		var v Video
		var categoryName string
		var categoryId sql.NullInt32
        if err := rows.Scan(
			&v.ID, &v.Title, &v.Description, &v.Tags, &v.ProductLinks, &v.Thumbnail, &v.VideoPath,
			&v.CreatedAt, &v.UserID, &v.UserName,
            &categoryId, &categoryName,
            &v.LikesCount, &v.DislikesCount, &v.CommentsCount,
            &v.AvgRating,
            &v.IsApproved, &v.Has720, &v.Has480,
            &v.ViewsCount,
		); err != nil {
			http.Error(w, "Ошибка данных", http.StatusInternalServerError)
			return
		}
		if categoryId.Valid {
			v.CategoryID = int(categoryId.Int32)
		}
		v.CategoryName = categoryName
		videos = append(videos, v)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(videos)
}

func AdminApproveVideoHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.Atoi(vars["id"])
	res, err := db.Exec("UPDATE videos SET is_approved=TRUE WHERE id=$1", id)
	if err != nil {
		http.Error(w, "Ошибка обновления", http.StatusInternalServerError)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		http.Error(w, "Видео не найдено", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "Видео одобрено"})
}

func AdminDeleteVideoHandler(w http.ResponseWriter, r *http.Request) {
	// используем уже готовую логику удаления
	DeleteVideoHandler(w, r)
}

func AdminListUsersHandler(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id, email, COALESCE(name,''), role FROM users ORDER BY id ASC")
	if err != nil {
		http.Error(w, "Ошибка получения пользователей", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	users := []map[string]interface{}{}
	for rows.Next() {
		var id int
		var email, name, role string
		if err := rows.Scan(&id, &email, &name, &role); err != nil {
			http.Error(w, "Ошибка данных", http.StatusInternalServerError)
			return
		}
		users = append(users, map[string]interface{}{
			"id": id, "email": email, "name": name, "role": role,
		})
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(users)
}

func AdminUpdateUserRoleHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	uid, _ := strconv.Atoi(vars["id"])

	var req struct {
		Role string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Некорректный запрос", http.StatusBadRequest)
		return
	}
	role := strings.ToLower(strings.TrimSpace(req.Role))
	if role != "user" && role != "business" && role != "admin" {
		http.Error(w, "Недопустимая роль", http.StatusBadRequest)
		return
	}

	var id int
	var email, name, newRole string
	if err := db.QueryRow(
		"UPDATE users SET role=$1 WHERE id=$2 RETURNING id, email, COALESCE(name,''), role",
		role, uid,
	).Scan(&id, &email, &name, &newRole); err != nil {
		http.Error(w, "Ошибка обновления", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"id": id, "email": email, "name": name, "role": newRole,
	})
}

// AdminListCategoriesHandler returns categories with computed depth (1..5) and parent references
func AdminListCategoriesHandler(w http.ResponseWriter, r *http.Request) {
    rows, err := db.Query(`
        WITH RECURSIVE cte AS (
            SELECT id, name, parent_id, 1 AS depth
            FROM categories
            WHERE parent_id IS NULL
            UNION ALL
            SELECT c.id, c.name, c.parent_id, cte.depth + 1
            FROM categories c
            JOIN cte ON c.parent_id = cte.id
        )
        SELECT id, name, parent_id, depth FROM cte ORDER BY depth, name;
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
        if err := rows.Scan(&c.ID, &c.Name, &parent, &c.Depth); err != nil {
            http.Error(w, "Ошибка БД", http.StatusInternalServerError)
            return
        }
        if parent.Valid {
            v := int(parent.Int32)
            c.ParentID = &v
        }
        list = append(list, c)
    }
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(list)
}

// AdminCreateCategoryHandler creates a new category with optional parent and enforces max depth 5
func AdminCreateCategoryHandler(w http.ResponseWriter, r *http.Request) {
    var req struct {
        Name     string `json:"name"`
        ParentID *int   `json:"parent_id"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Некорректный запрос", http.StatusBadRequest)
        return
    }
    name := strings.TrimSpace(req.Name)
    if name == "" {
        http.Error(w, "Имя категории обязательно", http.StatusBadRequest)
        return
    }

    // Validate depth
    var parentDepth int
    if req.ParentID != nil {
        // compute depth of parent by walking up the tree
        q := `WITH RECURSIVE up AS (
                SELECT id, parent_id, 1 AS depth FROM categories WHERE id=$1
                UNION ALL
                SELECT c.id, c.parent_id, up.depth + 1 FROM categories c JOIN up ON c.id = up.parent_id
            ) SELECT MAX(depth) FROM up;`
        err := db.QueryRow(q, *req.ParentID).Scan(&parentDepth)
        if err == sql.ErrNoRows {
            http.Error(w, "Родительская категория не найдена", http.StatusBadRequest)
            return
        }
        if err != nil {
            http.Error(w, "Ошибка БД", http.StatusInternalServerError)
            return
        }
        if parentDepth >= 5 {
            http.Error(w, "Максимальная глубина вложенности 5", http.StatusBadRequest)
            return
        }
    } else {
        parentDepth = 0
    }

    var id int
    err := db.QueryRow("INSERT INTO categories (name, parent_id) VALUES ($1, $2) RETURNING id", name, req.ParentID).Scan(&id)
    if err != nil {
        if pe, ok := err.(*pq.Error); ok && pe.Code.Name() == "unique_violation" {
            http.Error(w, "Категория с таким именем уже существует", http.StatusConflict)
            return
        }
        http.Error(w, "Ошибка создания категории", http.StatusInternalServerError)
        return
    }

    created := Category{ID: id, Name: name, Depth: parentDepth + 1}
    if req.ParentID != nil {
        created.ParentID = req.ParentID
    }
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusCreated)
    _ = json.NewEncoder(w).Encode(created)
}
