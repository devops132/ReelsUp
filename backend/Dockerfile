# Backend Dockerfile (Debian-based to support ffmpeg)
FROM node:20-bullseye-slim

WORKDIR /app

# install ffmpeg and curl (for s3 health checks)
RUN apt-get update && apt-get install -y ffmpeg ca-certificates curl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
#RUN npm install --no-audit --no-fund
RUN npm install --no-audit --no-fund && npm install -D @types/pg @types/fluent-ffmpeg

COPY tsconfig.json ./
COPY src ./src
# COPY sql ./sql
# RUN ls -lha
RUN npm run build

RUN mkdir -p /tmp/uploads

ENV NODE_ENV=production
EXPOSE 4000

CMD ["npm", "start"]
