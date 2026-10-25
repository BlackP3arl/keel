-- One JSON desk for the signed-in allowlist. D1 is SQLite, so the payload is TEXT.
CREATE TABLE IF NOT EXISTS keel_desk (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
