CREATE TABLE meeting_questions (
 id TEXT PRIMARY KEY,
 meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 500),
 hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0,1)),
 agenda INTEGER NOT NULL DEFAULT 0 CHECK(agenda IN (0,1)),
 created_at TEXT NOT NULL
);
CREATE INDEX meeting_questions_meeting ON meeting_questions(meeting_id,user_id);
CREATE TABLE meeting_question_votes (
 question_id TEXT NOT NULL REFERENCES meeting_questions(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL,
 PRIMARY KEY(question_id,user_id)
);
CREATE INDEX meeting_question_votes_user ON meeting_question_votes(user_id);
