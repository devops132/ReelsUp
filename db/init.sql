
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'user'
);

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);

-- hierarchical categories support
ALTER TABLE IF EXISTS categories
    ADD COLUMN IF NOT EXISTS parent_id INT REFERENCES categories(id) ON DELETE SET NULL;

-- ordering support for categories siblings
ALTER TABLE IF EXISTS categories
    ADD COLUMN IF NOT EXISTS position INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);

CREATE TABLE IF NOT EXISTS videos (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id INT REFERENCES categories(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    tags TEXT,
    product_links TEXT,
    video_path TEXT NOT NULL,
    thumbnail_path TEXT,
    -- paths for transcoded variants
    video_path_720 TEXT,
    video_path_480 TEXT,
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,
    views_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ensure columns exist for legacy databases
ALTER TABLE IF EXISTS videos
    ADD COLUMN IF NOT EXISTS video_path_720 TEXT,
    ADD COLUMN IF NOT EXISTS video_path_480 TEXT,
    ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    video_id INT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS likes (
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_id INT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, video_id)
);

-- dislikes similar to likes
CREATE TABLE IF NOT EXISTS dislikes (
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_id INT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, video_id)
);

-- user ratings for videos (1..7)
CREATE TABLE IF NOT EXISTS ratings (
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_id INT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    value INT NOT NULL CHECK (value BETWEEN 1 AND 7),
    PRIMARY KEY (user_id, video_id)
);

-- Banned tags (normalized to lowercase with leading '#')
CREATE TABLE IF NOT EXISTS banned_tags (
    tag TEXT PRIMARY KEY
);
CREATE INDEX IF NOT EXISTS idx_banned_tags_tag ON banned_tags(tag);

INSERT INTO categories (name) VALUES 
('Одежда'), ('Животные'), ('Ювелирка'), ('Косметика'),
('Туризм'), ('Хоз.Товары'), ('Спорттовары')
ON CONFLICT DO NOTHING;

-- Пароли захешированы bcrypt (cost=12)
INSERT INTO users (email, password_hash, name, role) VALUES
('admin@example.com', '$2b$12$jo/qhANdAyqikVqJkAHmB.vn1/gVgjmjXHHjAd17b5vWcuMnrcjDa', 'Admin', 'admin'),
('business@example.com', '$2b$12$jo/qhANdAyqikVqJkAHmB.vn1/gVgjmjXHHjAd17b5vWcuMnrcjDa', 'Business User', 'business')
ON CONFLICT DO NOTHING;
-- (admin123) -> $2a$12$Qm1yH0y3Jx4k1t2rJ7UawOVT8a0XKfXf0YyES5Z3wXK6jYv1wM2Dm
-- (business123) -> $2a$12$h5Qz3VQkqQd9a6d2M4n4gO2w2a0YqG3l1qgYqXo0mNmwqI2d1Zr3m
