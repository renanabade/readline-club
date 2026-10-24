-- Reset links sent by email. The token itself stays in password_resets, as
-- for the links the organizer generates. This row is claimed before each
-- send, so concurrent requests cannot send two emails at once.
CREATE TABLE password_reset_emails (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('sending','sent','failed')),
  attempted_at TEXT NOT NULL,
  sent_at TEXT,
  provider_id TEXT,
  error_code TEXT
);
