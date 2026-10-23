-- Confirmation of the signup email. NULL means not confirmed yet, which is
-- also the state of every account created before this migration.
ALTER TABLE applications ADD COLUMN email_verified_at TEXT;
-- One pending confirmation link per account. Only the hash of the token is
-- stored, and the row is claimed before sending, like approval_notifications.
CREATE TABLE email_verifications (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE,
  expires_at INTEGER,
  status TEXT NOT NULL CHECK(status IN ('sending','sent','failed')),
  attempted_at TEXT NOT NULL,
  sent_at TEXT,
  provider_id TEXT,
  error_code TEXT
);
