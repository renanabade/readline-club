-- One-off emails about a meeting, written in the panel and sent by the
-- mailer's cron at the chosen time. The recipient row is the claim, like
-- meeting_invitations: nobody gets the same email twice.
CREATE TABLE scheduled_emails (
 id TEXT PRIMARY KEY,
 meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
 subject TEXT NOT NULL,
 body TEXT NOT NULL,
 send_at TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','sending','done','cancelled')),
 created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX scheduled_emails_due ON scheduled_emails(status,send_at);
-- 'full' goes to members with a confirmed email, 'locked' leaves out the
-- personal answer buttons and asks for the confirmation first.
CREATE TABLE scheduled_email_recipients (
 email_id TEXT NOT NULL REFERENCES scheduled_emails(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 version TEXT CHECK(version IN ('full','locked')),
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','sent','failed','skipped')),
 attempted_at TEXT, sent_at TEXT, provider_id TEXT, error_code TEXT, rsvp_token_hash TEXT,
 PRIMARY KEY(email_id,user_id)
);
CREATE INDEX scheduled_email_recipients_status ON scheduled_email_recipients(email_id,status);
CREATE UNIQUE INDEX scheduled_email_recipients_rsvp_token ON scheduled_email_recipients(rsvp_token_hash) WHERE rsvp_token_hash IS NOT NULL;
