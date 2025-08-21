# Gateway контейнер (порт 3000)
Запуск всего проекта одной командой:
```bash
docker compose up --build
```
Gateway собирается из `./gateway` и проксирует:
- `/api/*` → backend:4000
- `/files/<bucket>/<key>` → minio:9000
Фронтенд можно положить в `gateway/web` или проксировать через `FRONTEND_UPSTREAM`.
