package main

type User struct {
	ID    int    `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
	Role  string `json:"role"`
}

type Category struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	ParentID *int   `json:"parent_id,omitempty"`
	Depth    int    `json:"depth"`
	Path     string `json:"path"`
}
