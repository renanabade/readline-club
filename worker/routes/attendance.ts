import { Hono, type Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../env";
import { input, missing } from "../errors";
import { attendanceSchema } from "../../shared/validation";
import type {
  AttendanceMember,
  AttendanceSummary,
  AttendedMeeting,
} from "../../shared/contracts";
// A meeting counts as held once it has started, unless it was cancelled.
const held =
  "m.status!='cancelled' AND m.starts_at IS NOT NULL AND m.starts_at<=?";
const attendanceAdmin = new Hono<AppEnv>();
attendanceAdmin.get("/attendance", async (c) => {
  const rows = await c.env.DB.prepare(
    `WITH held AS (
      SELECT m.id,m.title,m.starts_at,b.title book_title,
      LAG(m.id) OVER (ORDER BY m.starts_at) previous_id,
      LAG(m.title) OVER (ORDER BY m.starts_at) previous_title
      FROM meetings m JOIN reading_cycles cy ON cy.id=m.cycle_id JOIN books b ON b.id=cy.book_id
      WHERE ${held})
    SELECT h.id meeting_id,h.title,h.book_title,h.starts_at,h.previous_title,
    (SELECT COUNT(*) FROM meeting_attendance WHERE meeting_id=h.id) present,
    (SELECT COUNT(*) FROM meeting_attendance a JOIN meeting_attendance p ON p.user_id=a.user_id AND p.meeting_id=h.previous_id WHERE a.meeting_id=h.id) also_previous
    FROM held h ORDER BY h.starts_at DESC`,
  )
    .bind(new Date().toISOString())
    .all<AttendanceSummary>();
  return c.json(rows.results);
});
async function heldMeeting(c: Context<AppEnv>) {
  const meeting = await c.env.DB.prepare(
    "SELECT id,title,starts_at,status FROM meetings WHERE id=?",
  )
    .bind(c.req.param("id"))
    .first<{
      id: string;
      title: string;
      starts_at: string | null;
      status: string;
    }>();
  if (!meeting) return null;
  if (
    meeting.status === "cancelled" ||
    !meeting.starts_at ||
    Date.parse(meeting.starts_at) > Date.now()
  )
    throw new HTTPException(409, {
      message: "A presença é registrada depois que o encontro começa.",
    });
  return { id: meeting.id, title: meeting.title, starts_at: meeting.starts_at };
}
attendanceAdmin.get("/meetings/:id/attendance", async (c) => {
  const meeting = await heldMeeting(c);
  if (!meeting) return missing();
  // Approved members, plus anyone already marked who is no longer approved,
  // so a mark can still be undone.
  const members = await c.env.DB.prepare(
    `SELECT u.id user_id,u.name,u.email,EXISTS(SELECT 1 FROM meeting_attendance WHERE meeting_id=?1 AND user_id=u.id) present
    FROM users u JOIN applications a ON a.email=u.email
    WHERE u.role='member' AND (a.status='approved' OR u.id IN (SELECT user_id FROM meeting_attendance WHERE meeting_id=?1))
    ORDER BY u.name COLLATE NOCASE,u.id`,
  )
    .bind(meeting.id)
    .all<Omit<AttendanceMember, "present"> & { present: number }>();
  return c.json({
    meeting,
    members: members.results.map((m) => ({ ...m, present: m.present === 1 })),
  });
});
attendanceAdmin.put("/meetings/:id/attendance", async (c) => {
  const { userIds } = await input(c, attendanceSchema);
  const meeting = await heldMeeting(c);
  if (!meeting) return missing();
  const ids = JSON.stringify([...new Set(userIds)]);
  // New marks only for approved members; marks already saved are kept.
  await c.env.DB.batch([
    c.env.DB.prepare(
      "DELETE FROM meeting_attendance WHERE meeting_id=? AND user_id NOT IN (SELECT value FROM json_each(?))",
    ).bind(meeting.id, ids),
    c.env.DB.prepare(
      `INSERT INTO meeting_attendance(meeting_id,user_id,recorded_at)
      SELECT ?,u.id,? FROM users u JOIN applications a ON a.email=u.email
      WHERE u.role='member' AND a.status='approved' AND u.id IN (SELECT value FROM json_each(?))
      ON CONFLICT(meeting_id,user_id) DO NOTHING`,
    ).bind(meeting.id, new Date().toISOString(), ids),
  ]);
  const present = await c.env.DB.prepare(
    "SELECT COUNT(*) total FROM meeting_attendance WHERE meeting_id=?",
  )
    .bind(meeting.id)
    .first<number>("total");
  return c.json({ present: present ?? 0 });
});
// Members see only their own history.
const attendance = new Hono<AppEnv>();
attendance.get("/", async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT m.id,m.title,m.starts_at,b.title book_title FROM meeting_attendance a JOIN meetings m ON m.id=a.meeting_id JOIN reading_cycles cy ON cy.id=m.cycle_id JOIN books b ON b.id=cy.book_id WHERE a.user_id=? ORDER BY m.starts_at DESC",
  )
    .bind(c.get("identity").userId)
    .all<AttendedMeeting>();
  return c.json(rows.results);
});
export { attendance, attendanceAdmin };
