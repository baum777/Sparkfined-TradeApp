-- User Settings (v1)
-- Minimal per-user settings store for feature toggles.

CREATE TABLE IF NOT EXISTS user_settings_v1 (
  user_id TEXT PRIMARY KEY,
  ai_grok_enabled INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

