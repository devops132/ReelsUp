
package main

import (
    "context"
    "database/sql"
    "fmt"
    "log"
    "net/http"
    "os"

    "github.com/gorilla/mux"
    _ "github.com/lib/pq"
    minio "github.com/minio/minio-go/v7"
    "github.com/minio/minio-go/v7/pkg/credentials"
)

var db *sql.DB
var minioClient *minio.Client
var jwtSecret []byte

func main() {
    dbUser := os.Getenv("POSTGRES_USER")
    dbPassword := os.Getenv("POSTGRES_PASSWORD")
    dbName := os.Getenv("POSTGRES_DB")
    dbHost := os.Getenv("POSTGRES_HOST")
    if dbHost == "" { dbHost = "localhost" }

    if os.Getenv("JWT_SECRET") == "" {
        os.Setenv("JWT_SECRET", "secret")
    }
    jwtSecret = []byte(os.Getenv("JWT_SECRET"))

    connStr := fmt.Sprintf("host=%s user=%s password=%s dbname=%s sslmode=disable", dbHost, dbUser, dbPassword, dbName)
    var err error
    db, err = sql.Open("postgres", connStr)
    if err != nil { log.Fatalf("DB connect error: %v", err) }
    if err = db.Ping(); err != nil { log.Fatalf("DB ping error: %v", err) }
    log.Println("Connected to PostgreSQL")

    // MinIO
    minioEndpoint := os.Getenv("MINIO_ENDPOINT")
    if minioEndpoint == "" { minioEndpoint = "localhost:9000" }
    minioAccess := os.Getenv("MINIO_ACCESS_KEY")
    minioSecretKey := os.Getenv("MINIO_SECRET_KEY")

    minioClient, err = minio.New(minioEndpoint, &minio.Options{
        Creds:  credentials.NewStaticV4(minioAccess, minioSecretKey, ""),
        Secure: false,
    })
    if err != nil { log.Fatalf("MinIO init error: %v", err) }
    bucket := os.Getenv("MINIO_BUCKET")
    if bucket == "" { bucket = "videos" }
    exists, err := minioClient.BucketExists(context.Background(), bucket)
    if err != nil { log.Fatalf("MinIO bucket check error: %v", err) }
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
    api.HandleFunc("/videos/{id:[0-9]+}/comments", ListCommentsHandler).Methods("GET")
    api.HandleFunc("/categories", CategoriesHandler).Methods("GET")

    authR := api.PathPrefix("").Subrouter()
    authR.Use(JWTAuthMiddleware)
    authR.HandleFunc("/videos", UploadVideoHandler).Methods("POST")
    authR.HandleFunc("/videos/{id:[0-9]+}", DeleteVideoHandler).Methods("DELETE")
    authR.HandleFunc("/videos/{id:[0-9]+}/comments", CreateCommentHandler).Methods("POST")
    authR.HandleFunc("/videos/{id:[0-9]+}/comments/{commentId:[0-9]+}", DeleteCommentHandler).Methods("DELETE")
    authR.HandleFunc("/videos/{id:[0-9]+}/like", LikeVideoHandler).Methods("POST")
    authR.HandleFunc("/videos/{id:[0-9]+}/like", UnlikeVideoHandler).Methods("DELETE")
    authR.HandleFunc("/user/videos", ListMyVideosHandler).Methods("GET")

    admin := api.PathPrefix("/admin").Subrouter()
    admin.Use(JWTAuthMiddleware, AdminOnlyMiddleware)
    admin.HandleFunc("/videos", AdminListVideosHandler).Methods("GET")
    admin.HandleFunc("/videos/{id:[0-9]+}/approve", AdminApproveVideoHandler).Methods("PUT")
    admin.HandleFunc("/videos/{id:[0-9]+}", AdminDeleteVideoHandler).Methods("DELETE")
    admin.HandleFunc("/users", AdminListUsersHandler).Methods("GET")
    admin.HandleFunc("/users/{id:[0-9]+}/role", AdminUpdateUserRoleHandler).Methods("PUT")

    addr := ":8080"
    log.Println("HTTP server on", addr)
    if err := http.ListenAndServe(addr, r); err != nil {
        log.Fatal(err)
    }
}
