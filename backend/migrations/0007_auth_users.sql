-- Auth users (v1)
-- Stores credential-backed users for /auth/register and /auth/login.

CREATE TABLE IF NOT EXISTS auth_users_v1 (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_login_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_users_v1_email
  ON auth_users_v1(email);
