package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gorilla/mux"
	_ "github.com/lib/pq"
	minio "github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

var db *sql.DB
var minioClient *minio.Client
var jwtSecret []byte

// seedAdmin ensures there is an admin user. It can also reset the admin password if ADMIN_PASSWORD is provided.
func seedAdmin() {
	adminEmail := strings.ToLower(strings.TrimSpace(os.Getenv("ADMIN_EMAIL")))
	adminPass := os.Getenv("ADMIN_PASSWORD")
	if adminEmail == "" {
		adminEmail = "admin@example.com"
	}
	adminEmail = strings.ToLower(strings.TrimSpace(adminEmail))
	if adminPass == "" {
		// If empty, do not overwrite existing password; only create if missing with default 'admin123'
		adminPass = "admin123"
	}
	// Does user exist?
	var id int
	var role string
	err := db.QueryRow("SELECT id, role FROM users WHERE LOWER(email)=LOWER($1)", adminEmail).Scan(&id, &role)
	if err == sql.ErrNoRows {
		// Create admin
		hash, herr := HashPassword(adminPass)
		if herr != nil {
			log.Println("seedAdmin: hash error:", herr)
			return
		}
		err = db.QueryRow("INSERT INTO users (email, password_hash, name, role) VALUES ($1,$2,$3,$4) RETURNING id",
			adminEmail, hash, "Admin", "admin").Scan(&id)
		if err != nil {
			log.Println("seedAdmin: create admin error:", err)
			return
		}
		log.Println("seedAdmin: admin user created:", adminEmail)
		return
	} else if err != nil {
		log.Println("seedAdmin: select error:", err)
		return
	}
	// Ensure role admin
	if role != "admin" {
		if _, uerr := db.Exec("UPDATE users SET role='admin' WHERE id=$1", id); uerr != nil {
			log.Println("seedAdmin: update role error:", uerr)
		} else {
			log.Println("seedAdmin: elevated user to admin:", adminEmail)
		}
	}
	// If ADMIN_PASSWORD provided via env, reset password hash
	if os.Getenv("ADMIN_PASSWORD") != "" {
		hash, herr := HashPassword(os.Getenv("ADMIN_PASSWORD"))
		if herr != nil {
			log.Println("seedAdmin: hash error:", herr)
			return
		}
		if _, uerr := db.Exec("UPDATE users SET password_hash=$1 WHERE id=$2", hash, id); uerr != nil {
			log.Println("seedAdmin: update password error:", uerr)
		} else {
			log.Println("seedAdmin: admin password updated from env for", adminEmail)
		}
	}
}

func waitForDB(connStr string, timeoutSec int) (*sql.DB, error) {
	deadline := time.Now().Add(time.Duration(timeoutSec) * time.Second)
	var lastErr error
	for time.Now().Before(deadline) {
		db, err := sql.Open("postgres", connStr)
		if err == nil {
			if pingErr := db.Ping(); pingErr == nil {
				return db, nil
			} else {
				lastErr = pingErr
				db.Close()
			}
		} else {
			lastErr = err
		}
		log.Println("Жду PostgreSQL...", lastErr)
		time.Sleep(2 * time.Second)
	}
	return nil, fmt.Errorf("DB ping timeout: %w", lastErr)
}

func waitForMinIO(endpoint, access, secret, bucket string, timeoutSec int) (*minio.Client, error) {
	deadline := time.Now().Add(time.Duration(timeoutSec) * time.Second)
	var cli *minio.Client
	var lastErr error
	for time.Now().Before(deadline) {
		c, err := minio.New(endpoint, &minio.Options{
			Creds:  credentials.NewStaticV4(access, secret, ""),
			Secure: false,
		})
		if err == nil {
			ctx := context.Background()
			exists, e2 := c.BucketExists(ctx, bucket)
			if e2 == nil {
				if !exists {
					if mkErr := c.MakeBucket(ctx, bucket, minio.MakeBucketOptions{Region: "us-east-1"}); mkErr != nil {
						lastErr = mkErr
					} else {
						cli = c
						return cli, nil
					}
				} else {
					cli = c
					return cli, nil
				}
			} else {
				lastErr = e2
			}
		} else {
			lastErr = err
		}
		log.Println("Жду MinIO...", lastErr)
		time.Sleep(2 * time.Second)
	}
	return nil, fmt.Errorf("MinIO timeout: %w", lastErr)
}

func main() {
	dbUser := os.Getenv("POSTGRES_USER")
	dbPassword := os.Getenv("POSTGRES_PASSWORD")
	dbName := os.Getenv("POSTGRES_DB")
	dbHost := os.Getenv("POSTGRES_HOST")
	if dbHost == "" {
		dbHost = "localhost"
	}

	if os.Getenv("JWT_SECRET") == "" {
		os.Setenv("JWT_SECRET", "secret")
	}
	jwtSecret = []byte(os.Getenv("JWT_SECRET"))

	connStr := fmt.Sprintf("host=%s user=%s password=%s dbname=%s sslmode=disable", dbHost, dbUser, dbPassword, dbName)
	var err error
	db, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("DB connect error: %v", err)
	}
	if err = db.Ping(); err != nil {
		log.Fatalf("DB ping error: %v", err)
	}
	log.Println("Connected to PostgreSQL")

	adminEmailLog := strings.ToLower(strings.TrimSpace(os.Getenv("ADMIN_EMAIL")))
	if adminEmailLog == "" {
		adminEmailLog = "admin@example.com"
	}
	adminPwdSet := ""
	if os.Getenv("ADMIN_PASSWORD") != "" {
		adminPwdSet = "yes"
	} else {
		adminPwdSet = "no"
	}
	log.Println("seedAdmin: env check -> ADMIN_EMAIL=", adminEmailLog, " ADMIN_PASSWORD set? ", adminPwdSet)
	// MinIO
	minioEndpoint := os.Getenv("MINIO_ENDPOINT")
	if minioEndpoint == "" {
		minioEndpoint = "localhost:9000"
	}
	minioAccess := os.Getenv("MINIO_ACCESS_KEY")
	minioSecretKey := os.Getenv("MINIO_SECRET_KEY")

	minioClient, err = minio.New(minioEndpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(minioAccess, minioSecretKey, ""),
		Secure: false,
	})
	if err != nil {
		log.Fatalf("MinIO init error: %v", err)
	}
	bucket := os.Getenv("MINIO_BUCKET")
	if bucket == "" {
		bucket = "videos"
	}
	exists, err := minioClient.BucketExists(context.Background(), bucket)
	if err != nil {
		log.Fatalf("MinIO bucket check error: %v", err)
	}
	if !exists {
		if err := minioClient.MakeBucket(context.Background(), bucket, minio.MakeBucketOptions{Region: "us-east-1"}); err != nil {
			log.Fatalf("MinIO make bucket error: %v", err)
		}
		log.Println("Created bucket:", bucket)
	}
	log.Println("Connected to MinIO, bucket:", bucket)

	r := mux.NewRouter()
	api := r.PathPrefix("/api").Subrouter()
	api.HandleFunc("/register", RegisterHandler).Methods("POST")
	api.HandleFunc("/login", LoginHandler).Methods("POST")
	api.HandleFunc("/videos", ListVideosHandler).Methods("GET")
	api.HandleFunc("/videos/{id:[0-9]+}", GetVideoHandler).Methods("GET")
	api.HandleFunc("/videos/{id:[0-9]+}/content", VideoContentHandler).Methods("GET")
	api.HandleFunc("/videos/{id:[0-9]+}/thumbnail", VideoThumbnailStaticHandler).Methods("GET")
	api.HandleFunc("/videos/{id:[0-9]+}/thumbnail/animated", VideoThumbnailAnimatedHandler).Methods("GET")
	api.HandleFunc("/videos/{id:[0-9]+}/comments", ListCommentsHandler).Methods("GET")
	api.HandleFunc("/categories", CategoriesHandler).Methods("GET")

	authR := api.PathPrefix("").Subrouter()
	authR.Use(JWTAuthMiddleware)
	authR.HandleFunc("/videos", UploadVideoHandler).Methods("POST")
	authR.HandleFunc("/videos/{id:[0-9]+}", DeleteVideoHandler).Methods("DELETE")
	authR.HandleFunc("/videos/{id:[0-9]+}", UpdateVideoMetaHandler).Methods("PUT")
	authR.HandleFunc("/videos/{id:[0-9]+}/comments", CreateCommentHandler).Methods("POST")
	authR.HandleFunc("/videos/{id:[0-9]+}/comments/{commentId:[0-9]+}", DeleteCommentHandler).Methods("DELETE")
	authR.HandleFunc("/videos/{id:[0-9]+}/comments/{commentId:[0-9]+}", UpdateCommentHandler).Methods("PUT")
	authR.HandleFunc("/videos/{id:[0-9]+}/rating", RateVideoHandler).Methods("POST")
	authR.HandleFunc("/videos/{id:[0-9]+}/rating", UnrateVideoHandler).Methods("DELETE")
	authR.HandleFunc("/videos/{id:[0-9]+}/like", LikeVideoHandler).Methods("POST")
	authR.HandleFunc("/videos/{id:[0-9]+}/like", UnlikeVideoHandler).Methods("DELETE")
	authR.HandleFunc("/videos/{id:[0-9]+}/dislike", DislikeVideoHandler).Methods("POST")
	authR.HandleFunc("/videos/{id:[0-9]+}/dislike", UndislikeVideoHandler).Methods("DELETE")
	authR.HandleFunc("/user/videos", ListMyVideosHandler).Methods("GET")

	admin := api.PathPrefix("/admin").Subrouter()
	admin.Use(JWTAuthMiddleware, AdminOnlyMiddleware)
	admin.HandleFunc("/videos", AdminListVideosHandler).Methods("GET")
	admin.HandleFunc("/videos/{id:[0-9]+}/approve", AdminApproveVideoHandler).Methods("PUT")
	admin.HandleFunc("/videos/{id:[0-9]+}", AdminDeleteVideoHandler).Methods("DELETE")
	admin.HandleFunc("/users", AdminListUsersHandler).Methods("GET")
	admin.HandleFunc("/users/{id:[0-9]+}/role", AdminUpdateUserRoleHandler).Methods("PUT")
	// categories
	admin.HandleFunc("/categories", AdminListCategoriesHandler).Methods("GET")
	admin.HandleFunc("/categories", AdminCreateCategoryHandler).Methods("POST")
	admin.HandleFunc("/categories/children", AdminListCategoryChildrenHandler).Methods("GET")
	admin.HandleFunc("/categories/{id:[0-9]+}", AdminUpdateCategoryHandler).Methods("PUT")
	admin.HandleFunc("/categories/{id:[0-9]+}", AdminDeleteCategoryHandler).Methods("DELETE")
	admin.HandleFunc("/categories/{id:[0-9]+}/move", AdminMoveCategoryParentHandler).Methods("PUT")
	admin.HandleFunc("/categories/{id:[0-9]+}/counts", AdminCategoryCountsHandler).Methods("GET")
	admin.HandleFunc("/categories/{id:[0-9]+}/reorder", AdminReorderCategoryHandler).Methods("PUT")
	// tags moderation
	admin.HandleFunc("/tags/banned", AdminListBannedTagsHandler).Methods("GET")
	admin.HandleFunc("/tags/ban", AdminBanTagHandler).Methods("POST")
	admin.HandleFunc("/tags/ban/{tag}", AdminUnbanTagHandler).Methods("DELETE")

	addr := ":8080"
	log.Println("HTTP server on", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatal(err)
	}
}
