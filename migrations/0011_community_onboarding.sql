ALTER TABLE settings ADD COLUMN discord_url TEXT NOT NULL DEFAULT '';
CREATE TABLE community_onboarding (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 version TEXT NOT NULL,
 accepted_at TEXT NOT NULL
);
