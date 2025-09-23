# --------- BUILD ---------
FROM golang:1.25.1 AS builder
WORKDIR /app

# deps cache
COPY go.mod ./
RUN go mod download

# source + tidy
COPY . .
RUN go mod tidy && go mod download

# static build
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o app .

# --------- RUNTIME ---------
FROM alpine:3.20

# ffmpeg (+ ffprobe) и сертификаты
RUN apk add --no-cache ffmpeg ca-certificates tzdata

# непривилегированный пользователь
RUN adduser -D -u 65532 appuser

WORKDIR /app
COPY --from=builder /app/app ./app

EXPOSE 8080
USER appuser
ENTRYPOINT ["./app"]
