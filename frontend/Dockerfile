
FROM node:18
WORKDIR /app
COPY package.json ./
RUN npm install --silent
COPY . .
ENV PORT=3000
ENV HOST=0.0.0.0
EXPOSE 3000
CMD ["npm", "start"]
