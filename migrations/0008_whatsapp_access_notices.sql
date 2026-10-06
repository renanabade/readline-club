CREATE TABLE whatsapp_access_notices (
 application_id TEXT PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','sent','failed')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 attempted_at TEXT, sent_at TEXT, provider_id TEXT, error_code TEXT
);
