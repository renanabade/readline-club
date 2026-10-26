CREATE TABLE meeting_attendance (
 meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 recorded_at TEXT NOT NULL,
 PRIMARY KEY(meeting_id,user_id)
);
CREATE INDEX meeting_attendance_user ON meeting_attendance(user_id);
