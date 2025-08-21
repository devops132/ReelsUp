FROM node:20-alpine
WORKDIR /app
COPY gateway/package.json ./package.json
RUN npm ci --omit=dev
COPY gateway/. .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node","server.js"]
