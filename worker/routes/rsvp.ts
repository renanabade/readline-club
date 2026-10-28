import { Hono, type Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../env";
import type {
  MeetingRsvp,
  PublicMeeting,
  RsvpLink,
} from "../../shared/contracts";
import { input } from "../errors";
import { rsvpLinkSchema, rsvpLinkAnswerSchema } from "../../shared/validation";
import { digest } from "../auth/password";
import { rateLimit } from "../auth/limits";
// Answers a meeting invitation, reminder or scheduled email from the personal
// link in it, without a session. The token only works for that person, that
// meeting, while the person is still an approved member and the meeting has
// not started.
const rsvp = new Hono<AppEnv>();
async function invitation(c: Context<AppEnv>, token: string) {
  await rateLimit(c, "rsvp-link", 60);
  const row = await c.env.DB.prepare(
    `SELECT i.user_id,m.id,m.title,m.chapters,m.starts_at,m.duration_minutes,m.status,b.title book_title,r.response
    FROM (
      SELECT meeting_id,user_id FROM meeting_invitations WHERE rsvp_token_hash=?1
      UNION ALL SELECT meeting_id,user_id FROM meeting_reminders WHERE rsvp_token_hash=?1
      UNION ALL SELECT e.meeting_id,r.user_id FROM scheduled_email_recipients r JOIN scheduled_emails e ON e.id=r.email_id WHERE r.rsvp_token_hash=?1
    ) i
    JOIN users u ON u.id=i.user_id AND u.role='member'
    JOIN applications a ON a.email=u.email AND a.status='approved'
    JOIN meetings m ON m.id=i.meeting_id
    JOIN reading_cycles cy ON cy.id=m.cycle_id
    JOIN books b ON b.id=cy.book_id AND b.status!='archived'
    LEFT JOIN meeting_rsvps r ON r.meeting_id=m.id AND r.user_id=i.user_id`,
  )
    .bind(digest(token))
    .first<PublicMeeting & { user_id: string; response: MeetingRsvp | null }>();
  if (!row)
    throw new HTTPException(404, {
      message:
        "Este link de confirmação não vale mais. Entre na plataforma para responder.",
    });
  const { user_id, response, ...meeting } = row;
  const open =
    meeting.status === "scheduled" &&
    !!meeting.starts_at &&
    Date.parse(meeting.starts_at) > Date.now();
  return { userId: user_id, link: { meeting, rsvp: response, open } };
}
// POST keeps the token out of URLs and server logs.
rsvp.post("/lookup", async (c) => {
  const { token } = await input(c, rsvpLinkSchema);
  const { link } = await invitation(c, token);
  return c.json<RsvpLink>(link);
});
rsvp.put("/", async (c) => {
  const { token, response } = await input(c, rsvpLinkAnswerSchema);
  const { userId, link } = await invitation(c, token);
  if (!link.open)
    throw new HTTPException(409, {
      message: "A confirmação de presença está encerrada para este encontro.",
    });
  await c.env.DB.prepare(
    "INSERT INTO meeting_rsvps(meeting_id,user_id,response,updated_at) VALUES(?,?,?,?) ON CONFLICT(meeting_id,user_id) DO UPDATE SET response=excluded.response,updated_at=excluded.updated_at",
  )
    .bind(link.meeting.id, userId, response, new Date().toISOString())
    .run();
  return c.json<RsvpLink>({ ...link, rsvp: response });
});
export { rsvp };
