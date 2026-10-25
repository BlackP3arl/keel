-- Authorized Google accounts and their desk role. ALLOWED_EMAILS remains a bootstrap admin fallback.
CREATE TABLE IF NOT EXISTS keel_users (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin', 'viewer')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
