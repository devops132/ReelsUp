
# Video Marketplace MVP (Go + React, Docker Compose)

Инструкция по запуску:

1) Скопируйте `.env.example` в `.env` и при необходимости измените значения.
2) Запустите проект:
   ```bash
   docker-compose up --build
   ```
3) Откройте в браузере: http://localhost

Доступы по умолчанию:
- Админ: `admin@example.com` / `admin123`
- Бизнес: `business@example.com` / `business123`

Сервисы:
- Nginx (gateway) — порт 80
- Backend (Go) — сервис `backend`
- Frontend (React) — сервис `frontend`
- PostgreSQL — сервис `postgres`
- MinIO — сервис `minio` (консоль http://localhost:9001, логин/пароль из .env)

Тесты:
- Backend: `docker-compose exec backend go test ./...`
- Frontend: `docker-compose exec frontend npm test -- --watchAll=false`
