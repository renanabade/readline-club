CREATE TABLE meeting_reminders (
 meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('d1','h1')),
 status TEXT NOT NULL DEFAULT 'sending' CHECK(status IN ('sending','sent','failed')),
 attempted_at TEXT NOT NULL,
 sent_at TEXT, provider_id TEXT, error_code TEXT, rsvp_token_hash TEXT,
 UNIQUE(meeting_id,user_id,kind)
);
CREATE UNIQUE INDEX meeting_reminders_rsvp_token ON meeting_reminders(rsvp_token_hash) WHERE rsvp_token_hash IS NOT NULL;
