
-- Add columns for transcoded variants
ALTER TABLE IF EXISTS videos
  ADD COLUMN IF NOT EXISTS video_path_720 TEXT,
  ADD COLUMN IF NOT EXISTS video_path_480 TEXT;

-- Ratings (1..7), one per user/video
CREATE TABLE IF NOT EXISTS ratings (
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_id INT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    value INT NOT NULL CHECK (value BETWEEN 1 AND 7),
    PRIMARY KEY (user_id, video_id)
);
