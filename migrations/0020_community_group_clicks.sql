CREATE TABLE community_group_clicks (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 channel TEXT NOT NULL CHECK (channel IN ('whatsapp','discord')),
 clicked_at TEXT NOT NULL,
 PRIMARY KEY (user_id, channel)
);
