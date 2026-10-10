ALTER TABLE users ADD COLUMN meeting_emails INTEGER NOT NULL DEFAULT 1 CHECK(meeting_emails IN (0,1));
CREATE TABLE meeting_invitations (
 meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','sent','failed','skipped')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 attempted_at TEXT, sent_at TEXT, provider_id TEXT, error_code TEXT,
 PRIMARY KEY(meeting_id,user_id)
);
CREATE INDEX meeting_invitations_status ON meeting_invitations(meeting_id,status);
CREATE TABLE meeting_rsvps (
 meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 response TEXT NOT NULL CHECK(response IN ('yes','no')),
 updated_at TEXT NOT NULL,
 PRIMARY KEY(meeting_id,user_id)
);
