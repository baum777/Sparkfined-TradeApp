-- Journal Capture Fields (v1)
-- Additive columns for onchain capture metadata and idempotent ingest.

ALTER TABLE journal_entries_v2 ADD COLUMN capture_source TEXT NULL;
ALTER TABLE journal_entries_v2 ADD COLUMN capture_key TEXT NULL;
ALTER TABLE journal_entries_v2 ADD COLUMN tx_signature TEXT NULL;
ALTER TABLE journal_entries_v2 ADD COLUMN wallet TEXT NULL;
ALTER TABLE journal_entries_v2 ADD COLUMN action_type TEXT NULL;
ALTER TABLE journal_entries_v2 ADD COLUMN asset_mint TEXT NULL;
ALTER TABLE journal_entries_v2 ADD COLUMN amount REAL NULL;
ALTER TABLE journal_entries_v2 ADD COLUMN price_hint REAL NULL;
ALTER TABLE journal_entries_v2 ADD COLUMN linked_entry_id TEXT NULL;

-- Idempotency: prevent duplicates for the same capture_key per user.
CREATE UNIQUE INDEX IF NOT EXISTS journal_entries_v2_user_capture_key_uq
  ON journal_entries_v2(user_id, capture_key)
  WHERE capture_key IS NOT NULL;

-- Lookup helper for auto-archive matching.
CREATE INDEX IF NOT EXISTS journal_entries_v2_user_status_asset_ts_idx
  ON journal_entries_v2(user_id, status, asset_mint, timestamp DESC)
  WHERE asset_mint IS NOT NULL;

