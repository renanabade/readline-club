CREATE TABLE admin_digest_notifications (
  slot TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK(status IN ('sending','sent','failed')),
  pending_count INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  attempted_at TEXT NOT NULL,
  sent_at TEXT,
  provider_id TEXT,
  error_code TEXT
);
