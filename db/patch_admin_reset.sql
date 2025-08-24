
-- Reset or create admin with password 'admin123'
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE email = 'admin@example.com') THEN
    UPDATE users SET password_hash = '$2b$12$jo/qhANdAyqikVqJkAHmB.vn1/gVgjmjXHHjAd17b5vWcuMnrcjDa', name='Admin', role='admin'
    WHERE email = 'admin@example.com';
  ELSE
    INSERT INTO users (email, password_hash, name, role)
    VALUES ('admin@example.com', '$2b$12$jo/qhANdAyqikVqJkAHmB.vn1/gVgjmjXHHjAd17b5vWcuMnrcjDa', 'Admin', 'admin');
  END IF;
END$$;
