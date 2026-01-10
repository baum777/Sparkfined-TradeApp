-- Journal Market Capture Fields
-- Stores tier-gated market snapshots, delta snapshots, and order pressure data

-- Market snapshots (at-trade) - tier >= standard
CREATE TABLE IF NOT EXISTS journal_market_snapshots_v1 (
  user_id TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  market_snapshot_json TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  PRIMARY KEY (user_id, entry_id),
  FOREIGN KEY (user_id, entry_id) REFERENCES journal_entries_v2(user_id, id) ON DELETE CASCADE
);

-- Delta snapshots (post-trade) - tier >= pro
CREATE TABLE IF NOT EXISTS journal_delta_snapshots_v1 (
  user_id TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  window TEXT NOT NULL CHECK (window IN ('+15m', '+1h', '+4h')),
  delta_snapshot_json TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  PRIMARY KEY (user_id, entry_id, window),
  FOREIGN KEY (user_id, entry_id) REFERENCES journal_entries_v2(user_id, id) ON DELETE CASCADE
);

-- Order pressure data - tier >= high
CREATE TABLE IF NOT EXISTS journal_order_pressure_v1 (
  user_id TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  order_pressure_json TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  PRIMARY KEY (user_id, entry_id),
  FOREIGN KEY (user_id, entry_id) REFERENCES journal_entries_v2(user_id, id) ON DELETE CASCADE
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS journal_market_snapshots_v1_user_entry_idx
  ON journal_market_snapshots_v1(user_id, entry_id);

CREATE INDEX IF NOT EXISTS journal_delta_snapshots_v1_user_entry_idx
  ON journal_delta_snapshots_v1(user_id, entry_id);

CREATE INDEX IF NOT EXISTS journal_order_pressure_v1_user_entry_idx
  ON journal_order_pressure_v1(user_id, entry_id);

