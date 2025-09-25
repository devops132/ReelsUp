
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    avatar_path TEXT
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

CREATE TABLE IF NOT EXISTS live_streams (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    stream_url TEXT NOT NULL,
    thumbnail_url TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled',
    scheduled_at TIMESTAMP,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_streams_status ON live_streams(status);
CREATE INDEX IF NOT EXISTS idx_live_streams_user ON live_streams(user_id);
CREATE INDEX IF NOT EXISTS idx_live_streams_scheduled_at ON live_streams(scheduled_at);

-- ensure columns exist for legacy databases
ALTER TABLE IF EXISTS videos
    ADD COLUMN IF NOT EXISTS video_path_720 TEXT,
    ADD COLUMN IF NOT EXISTS video_path_480 TEXT,
    ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT FALSE;

-- ensure avatar column exists on users for legacy databases
ALTER TABLE IF EXISTS users
    ADD COLUMN IF NOT EXISTS avatar_path TEXT;

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
-- PK already indexes tag; extra index redundant. Keep for legacy, but safe to skip.
-- CREATE INDEX IF NOT EXISTS idx_banned_tags_tag ON banned_tags(tag);

INSERT INTO categories (name) VALUES 
('Одежда'), ('Животные'), ('Ювелирка'), ('Косметика'),
('Туризм'), ('Хоз.Товары'), ('Спорттовары')
ON CONFLICT DO NOTHING;

