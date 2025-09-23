
FROM node:18
WORKDIR /app

# Copy manifest and patches first so postinstall can apply patches
COPY package.json package-lock.json ./
COPY patches ./patches

# Deterministic install
RUN npm ci --silent

# Copy the rest of the app and ensure patches are applied (in case patches were updated)
COPY . .
RUN npm run postinstall || true

ENV PORT=3000
ENV HOST=0.0.0.0
EXPOSE 3000
CMD ["npm", "start"]
