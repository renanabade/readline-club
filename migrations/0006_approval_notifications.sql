CREATE TABLE approval_notifications (
  application_id TEXT PRIMARY KEY REFERENCES applications(id),
  status TEXT NOT NULL CHECK(status IN ('sending','sent','failed')),
  attempted_at TEXT NOT NULL,
  sent_at TEXT,
  provider_id TEXT,
  error_code TEXT
);
