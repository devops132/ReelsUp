# ReelsUP MVP (Full Stack, Docker)

Запуск полностью готового проекта (frontend + backend + PostgreSQL) одной командой.

## Запуск
```bash
docker-compose up --build
```
Сервисы:
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- PostgreSQL: localhost:5432 (user/password, DB: videodb)

## Первичная инициализация БД
Бэкенд при старте сам применит SQL и создаст необходимые таблицы (idempotent). Ничего вручную делать не нужно.

## Тестовый сценарий
1. Откройте http://localhost:3000
2. Зарегистрируйте пользователя (страница /register)
3. Войдите (страница /login)
4. Загрузите видео (страница /upload) — файл сохранится локально в контейнере backend (том uploads)
5. Перейдите на главную — увидите ролик в ленте.

## Переменные окружения
- Backend: PORT, DATABASE_URL, JWT_SECRET, UPLOAD_DIR, CORS_ORIGIN
- Frontend: NEXT_PUBLIC_API_BASE

Все значения по умолчанию уже заданы в docker-compose.yml.
