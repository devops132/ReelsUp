CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  avatar VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  store_name VARCHAR(255),
  inn VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS videos (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category_id INT REFERENCES categories(id),
  brand VARCHAR(100),
  product_link VARCHAR(255),
  -- заменили на хранение ключей для MinIO
  s3_key VARCHAR(255) NOT NULL,
  thumbnail_key VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ratings (
  id SERIAL PRIMARY KEY,
  video_id INT REFERENCES videos(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  value INT CHECK (value >= 1 AND value <= 7)
);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  video_id INT REFERENCES videos(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- seed categories if empty
INSERT INTO categories (name)
SELECT c FROM (VALUES ('Одежда'),('Животные'),('Ювелирка'),('Косметика'),
('Туризм'),('Хоз.Товары'),('Спорттовары')) AS t(c)
WHERE NOT EXISTS (SELECT 1 FROM categories);

-- Admin seed note: admin user with email admin@vid.local will be created on backend startup if not exists.
