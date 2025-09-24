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

// Admin tags API
func AdminListBannedTagsHandler(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT tag FROM banned_tags ORDER BY tag ASC")
	if err != nil {
		http.Error(w, "Ошибка получения тегов", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	tags := []string{}
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err == nil {
			tags = append(tags, t)
		}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"tags": tags})
}

func AdminBanTagHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Tag string `json:"tag"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Tag) == "" {
		http.Error(w, "Некорректный тег", http.StatusBadRequest)
		return
	}
	t := strings.TrimSpace(req.Tag)
	if !strings.HasPrefix(t, "#") {
		t = "#" + t
	}
	t = strings.ToLower(t)
	if _, err := db.Exec("INSERT INTO banned_tags(tag) VALUES($1) ON CONFLICT DO NOTHING", t); err != nil {
		http.Error(w, "Ошибка БД", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"tag": t, "banned": true})
}

func AdminUnbanTagHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	tag := strings.ToLower(vars["tag"])
	if tag == "" {
		http.Error(w, "Тег обязателен", http.StatusBadRequest)
		return
	}
	if !strings.HasPrefix(tag, "#") {
		tag = "#" + tag
	}
	if _, err := db.Exec("DELETE FROM banned_tags WHERE tag=$1", tag); err != nil {
		http.Error(w, "Ошибка БД", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"tag": tag, "banned": false})
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

// AdminListCategoryChildrenHandler returns direct children for a given parent (or root if parent_id not provided)
func AdminListCategoryChildrenHandler(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	parentStr := strings.TrimSpace(q.Get("parent_id"))
	limitStr := strings.TrimSpace(q.Get("limit"))
	if limitStr == "" {
		limitStr = "500"
	}
	lim, err := strconv.Atoi(limitStr)
	if err != nil || lim <= 0 || lim > 2000 {
		lim = 500
	}

	var rows *sql.Rows
	if parentStr == "" { // root
		rows, err = db.Query("SELECT c.id, c.name, c.parent_id, (SELECT COUNT(*) FROM categories x WHERE x.parent_id=c.id) AS children_count FROM categories c WHERE c.parent_id IS NULL ORDER BY c.position ASC, c.name ASC LIMIT $1", lim)
	} else {
		pid, e := strconv.Atoi(parentStr)
		if e != nil {
			http.Error(w, "parent_id", http.StatusBadRequest)
			return
		}
		rows, err = db.Query("SELECT c.id, c.name, c.parent_id, (SELECT COUNT(*) FROM categories x WHERE x.parent_id=c.id) AS children_count FROM categories c WHERE c.parent_id=$1 ORDER BY c.position ASC, c.name ASC LIMIT $2", pid, lim)
	}
	if err != nil {
		http.Error(w, "Ошибка получения категорий", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	type Cat struct {
		ID            int    `json:"id"`
		Name          string `json:"name"`
		ParentID      *int   `json:"parent_id"`
		ChildrenCount int    `json:"children_count"`
	}
	out := []Cat{}
	for rows.Next() {
		var c Cat
		var p sql.NullInt32
		if err := rows.Scan(&c.ID, &c.Name, &p, &c.ChildrenCount); err != nil {
			http.Error(w, "Ошибка БД", http.StatusInternalServerError)
			return
		}
		if p.Valid {
			v := int(p.Int32)
			c.ParentID = &v
		}
		out = append(out, c)
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(out)
}

// AdminUpdateCategoryHandler renames a category
func AdminUpdateCategoryHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.Atoi(vars["id"])
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Name) == "" {
		http.Error(w, "Имя обязательно", http.StatusBadRequest)
		return
	}
	name := strings.TrimSpace(req.Name)
	var newID int
	var newName string
	var parent sql.NullInt32
	if err := db.QueryRow("UPDATE categories SET name=$1 WHERE id=$2 RETURNING id, name, parent_id", name, id).Scan(&newID, &newName, &parent); err != nil {
		http.Error(w, "Ошибка обновления", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"id": newID, "name": newName, "parent_id": func() *int {
		if parent.Valid {
			v := int(parent.Int32)
			return &v
		}
		return nil
	}()})
}

// AdminDeleteCategoryHandler deletes a category (children and videos are set parent/category NULL by FK rules)
func AdminDeleteCategoryHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.Atoi(vars["id"])
	// Set category_id NULL for videos to avoid constraint issues, rely on FK ON DELETE SET NULL, but explicit update safe
	if _, err := db.Exec("UPDATE videos SET category_id=NULL WHERE category_id=$1", id); err != nil {
		http.Error(w, "Ошибка БД", http.StatusInternalServerError)
		return
	}
	// Re-parent children to NULL
	if _, err := db.Exec("UPDATE categories SET parent_id=NULL WHERE parent_id=$1", id); err != nil {
		http.Error(w, "Ошибка БД", http.StatusInternalServerError)
		return
	}
	res, err := db.Exec("DELETE FROM categories WHERE id=$1", id)
	if err != nil {
		http.Error(w, "Ошибка удаления", http.StatusInternalServerError)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		http.Error(w, "Категория не найдена", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// AdminMoveCategoryParentHandler sets/changes parent of a category with depth and cycle checks
func AdminMoveCategoryParentHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.Atoi(vars["id"])
	var req struct {
		ParentID *int `json:"parent_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Некорректный запрос", http.StatusBadRequest)
		return
	}
	if req.ParentID != nil && *req.ParentID == id {
		http.Error(w, "Нельзя назначить родителем саму себя", http.StatusBadRequest)
		return
	}
	// Check cycle: parent must not be a descendant of id
	if req.ParentID != nil {
		var exists int
		err := db.QueryRow(`WITH RECURSIVE sub AS (
                SELECT id, parent_id FROM categories WHERE id=$1
                UNION ALL
                SELECT c.id, c.parent_id FROM categories c JOIN sub s ON c.parent_id = s.id
            ) SELECT 1 FROM sub WHERE id=$2 LIMIT 1;`, id, *req.ParentID).Scan(&exists)
		if err == nil && exists == 1 {
			http.Error(w, "Циклическая ссылка запрещена", http.StatusBadRequest)
			return
		}
	}
	// Compute parent depth (0 for root)
	parentDepth := 0
	if req.ParentID != nil {
		if err := db.QueryRow(`WITH RECURSIVE up AS (
                SELECT id, parent_id, 1 AS depth FROM categories WHERE id=$1
                UNION ALL
                SELECT c.id, c.parent_id, up.depth + 1 FROM categories c JOIN up ON c.id = up.parent_id
            ) SELECT COALESCE(MAX(depth),0) FROM up;`, *req.ParentID).Scan(&parentDepth); err != nil {
			http.Error(w, "Ошибка БД", http.StatusInternalServerError)
			return
		}
	}
	// Compute subtree height of moving node
	subHeight := 1
	if err := db.QueryRow(`WITH RECURSIVE down AS (
            SELECT id, 1 AS depth FROM categories WHERE id=$1
            UNION ALL
            SELECT c.id, down.depth + 1 FROM categories c JOIN down ON c.parent_id = down.id
        ) SELECT COALESCE(MAX(depth),1) FROM down;`, id).Scan(&subHeight); err != nil {
		http.Error(w, "Ошибка БД", http.StatusInternalServerError)
		return
	}
	if parentDepth+subHeight > 5 {
		http.Error(w, "Максимальная глубина вложенности 5", http.StatusBadRequest)
		return
	}
	// Update parent, reset position to end of list
	// compute max position among new siblings
	var maxPos int
	if req.ParentID == nil {
		_ = db.QueryRow("SELECT COALESCE(MAX(position),0) FROM categories WHERE parent_id IS NULL").Scan(&maxPos)
	} else {
		_ = db.QueryRow("SELECT COALESCE(MAX(position),0) FROM categories WHERE parent_id=$1", *req.ParentID).Scan(&maxPos)
	}
	_, err := db.Exec("UPDATE categories SET parent_id=$1, position=$2 WHERE id=$3", req.ParentID, maxPos+1, id)
	if err != nil {
		http.Error(w, "Ошибка БД", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"id": id, "parent_id": req.ParentID})
}

// AdminReorderCategoryHandler changes position within same parent
func AdminReorderCategoryHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.Atoi(vars["id"])
	var req struct {
		BeforeID *int `json:"before_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Некорректный запрос", http.StatusBadRequest)
		return
	}
	// get target and its parent
	var parent sql.NullInt32
	if err := db.QueryRow("SELECT parent_id FROM categories WHERE id=$1", id).Scan(&parent); err != nil {
		http.Error(w, "Категория не найдена", http.StatusNotFound)
		return
	}
	// compute new position: if before_id provided, take its position; else move to end
	newPos := 0
	if req.BeforeID != nil {
		if err := db.QueryRow("SELECT position FROM categories WHERE id=$1", *req.BeforeID).Scan(&newPos); err != nil {
			http.Error(w, "before_id не найден", http.StatusBadRequest)
			return
		}
	} else {
		if parent.Valid {
			_ = db.QueryRow("SELECT COALESCE(MAX(position),0)+1 FROM categories WHERE parent_id=$1", parent.Int32).Scan(&newPos)
		} else {
			_ = db.QueryRow("SELECT COALESCE(MAX(position),0)+1 FROM categories WHERE parent_id IS NULL").Scan(&newPos)
		}
	}
	// shift items >= newPos
	if parent.Valid {
		_, _ = db.Exec("UPDATE categories SET position=position+1 WHERE parent_id=$1 AND position >= $2", parent.Int32, newPos)
	} else {
		_, _ = db.Exec("UPDATE categories SET position=position+1 WHERE parent_id IS NULL AND position >= $1", newPos)
	}
	// set position
	_, err := db.Exec("UPDATE categories SET position=$1 WHERE id=$2", newPos, id)
	if err != nil {
		http.Error(w, "Ошибка БД", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"id": id, "position": newPos})
}

// AdminCategoryCountsHandler returns counts for confirmation dialogs
func AdminCategoryCountsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.Atoi(vars["id"])
	var directChildren, videos, descendants int
	_ = db.QueryRow("SELECT COUNT(*) FROM categories WHERE parent_id=$1", id).Scan(&directChildren)
	_ = db.QueryRow("SELECT COUNT(*) FROM videos WHERE category_id=$1", id).Scan(&videos)
	_ = db.QueryRow(`WITH RECURSIVE down AS (
            SELECT id, parent_id FROM categories WHERE id=$1
            UNION ALL
            SELECT c.id, c.parent_id FROM categories c JOIN down d ON c.parent_id = d.id
        ) SELECT GREATEST(COUNT(*)-1,0) FROM down;`, id).Scan(&descendants)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]int{"children": directChildren, "descendants": descendants, "videos": videos})
}
