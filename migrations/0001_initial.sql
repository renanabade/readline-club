CREATE TABLE users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL,
 password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','admin')),
 must_change_password INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE applications (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL,
 experience TEXT NOT NULL CHECK(experience IN ('beginner','learning','experienced')),
 motivation TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','suspended')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT
);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE auth_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE password_resets (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
CREATE TABLE books (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, author TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
 edition TEXT NOT NULL DEFAULT '', level TEXT NOT NULL DEFAULT 'Iniciante', status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','reading','completed','archived')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE book_categories (book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, category_id TEXT NOT NULL REFERENCES categories(id), PRIMARY KEY(book_id,category_id));
CREATE TABLE reading_cycles (id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id), title TEXT NOT NULL, is_current INTEGER NOT NULL DEFAULT 0 CHECK(is_current IN (0,1)));
CREATE UNIQUE INDEX single_current_cycle ON reading_cycles(is_current) WHERE is_current=1;
CREATE TABLE meetings (
 id TEXT PRIMARY KEY, cycle_id TEXT NOT NULL REFERENCES reading_cycles(id), title TEXT NOT NULL,
 chapters TEXT NOT NULL DEFAULT '', starts_at TEXT, duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK(duration_minutes BETWEEN 15 AND 480),
 status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','completed','cancelled')),
 agenda TEXT NOT NULL DEFAULT '', summary TEXT NOT NULL DEFAULT '', meeting_url TEXT NOT NULL DEFAULT '',
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX meetings_cycle ON meetings(cycle_id);
CREATE TABLE recordings (id TEXT PRIMARY KEY, meeting_id TEXT NOT NULL UNIQUE REFERENCES meetings(id) ON DELETE CASCADE, youtube_id TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)));
CREATE TABLE resources (id TEXT PRIMARY KEY, meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE, title TEXT NOT NULL, url TEXT NOT NULL);
CREATE TABLE settings (id INTEGER PRIMARY KEY CHECK(id=1), club_name TEXT NOT NULL, description TEXT NOT NULL, whatsapp_url TEXT NOT NULL DEFAULT '', community_guidelines TEXT NOT NULL DEFAULT '');

