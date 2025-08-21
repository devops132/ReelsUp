# syntax=docker/dockerfile:1
FROM node:20-alpine
WORKDIR /app

# copy manifest(s) first for better layer caching
COPY gateway/package*.json ./

# install deps; works with or without a lockfile
RUN npm i --omit=dev --no-audit --no-fund

# copy the rest of the app
COPY gateway/. .

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node","server.js"]
