FROM golang:1.21 AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN go mod tidy && go mod download
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o app .

# --- RUNTIME ---
FROM debian:bookworm-slim
# Чтобы TLS-сертификаты были в системе (на случай HTTPS)
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

# Создаем непривилегированного пользователя (uid 65532 = как в distroless)
RUN useradd -m -u 65532 appuser

WORKDIR /app
COPY --from=builder /app/app ./app

EXPOSE 8080
USER appuser
ENTRYPOINT ["./app"]
