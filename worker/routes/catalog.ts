import { Hono } from "hono";
import type { Context } from "hono";
import type { AppEnv, Env } from "../env";
import type {
  Book,
  Category,
  Meeting,
  Resource,
  Cycle,
  Settings,
  MeetingRsvp,
  CommunityAccess,
  BookMaterials,
} from "../../shared/contracts";
import { HTTPException } from "hono/http-exception";
import { input, missing } from "../errors";
import { onboardingVersion } from "../lib/community";
import { rsvpSchema, groupClickSchema } from "../../shared/validation";
import { meetingToIcs } from "../lib/calendar";
import { nextMeetingWhere } from "../lib/next-meeting";
import { lockRecording, lockResource } from "../lib/email-gate";
type CommunityMeeting = NonNullable<CommunityAccess["nextMeeting"]>;
// Groups, recordings and materials wait for the signup email to be confirmed.
const emailLocked = (c: Context<AppEnv>) =>
  c.get("identity").emailConfirmationPending;
export async function books(db: Env["DB"], all = false): Promise<Book[]> {
  const rows = await db
    .prepare(
      "SELECT * FROM books" +
        (all ? "" : " WHERE status!='archived'") +
        " ORDER BY created_at DESC",
    )
    .all<Book>();
  const cats = await db
    .prepare(
      "SELECT bc.book_id,c.id,c.name FROM book_categories bc JOIN categories c ON c.id=bc.category_id",
    )
    .all<Category & { book_id: string }>();
  return rows.results.map((b) => ({
    ...b,
    categories: cats.results
      .filter((c) => c.book_id === b.id)
      .map(({ id, name }) => ({ id, name })),
  }));
}
export { nextMeetingWhere };
export const meetingQuery = `SELECT m.*,b.title book_title,b.id book_id,r.youtube_id,(SELECT group_concat(DISTINCT kind) FROM resources WHERE meeting_id=m.id) material_kinds FROM meetings m JOIN reading_cycles cy ON cy.id=m.cycle_id JOIN books b ON b.id=cy.book_id LEFT JOIN recordings r ON r.meeting_id=m.id AND r.published=1`;
const catalog = new Hono<AppEnv>();
catalog.get("/books", async (c) => c.json(await books(c.env.DB)));
catalog.get("/books/:id", async (c) => {
  const book = (await books(c.env.DB)).find((b) => b.id === c.req.param("id"));
  if (!book) return missing();
  const cycles = await c.env.DB.prepare(
    "SELECT * FROM reading_cycles WHERE book_id=?",
  )
    .bind(book.id)
    .all<Cycle>();
  const meetings = await c.env.DB.prepare(
    meetingQuery + " WHERE b.id=? ORDER BY m.starts_at IS NULL,m.starts_at",
  )
    .bind(book.id)
    .all<Meeting>();
  return c.json({
    book,
    cycles: cycles.results,
    meetings: emailLocked(c)
      ? meetings.results.map(lockRecording)
      : meetings.results,
  });
});
catalog.get("/books/:id/materials", async (c) => {
  const book = (await books(c.env.DB)).find((b) => b.id === c.req.param("id"));
  if (!book) return missing();
  // Only what is published: recordings marked as published and the
  // materials attached to each meeting. Never the call link or the agenda.
  const meetings = await c.env.DB.prepare(
    "SELECT m.id,m.title,m.chapters,m.starts_at,r.youtube_id FROM meetings m JOIN reading_cycles cy ON cy.id=m.cycle_id LEFT JOIN recordings r ON r.meeting_id=m.id AND r.published=1 WHERE cy.book_id=? AND (r.youtube_id IS NOT NULL OR EXISTS (SELECT 1 FROM resources WHERE meeting_id=m.id)) ORDER BY m.starts_at IS NULL,m.starts_at",
  )
    .bind(book.id)
    .all<Omit<BookMaterials["meetings"][number], "resources">>();
  const resources = await c.env.DB.prepare(
    "SELECT s.id,s.meeting_id,s.title,s.url,s.kind FROM resources s JOIN meetings m ON m.id=s.meeting_id JOIN reading_cycles cy ON cy.id=m.cycle_id WHERE cy.book_id=? ORDER BY CASE s.kind WHEN 'summary_pdf' THEN 0 WHEN 'summary_epub' THEN 1 WHEN 'slides' THEN 2 WHEN 'transcript' THEN 3 ELSE 4 END,s.title",
  )
    .bind(book.id)
    .all<Resource>();
  const locked = emailLocked(c);
  return c.json<BookMaterials>({
    book: { id: book.id, title: book.title, author: book.author },
    meetings: meetings.results.map((m) => ({
      ...(locked ? lockRecording(m) : m),
      resources: resources.results
        .filter((r) => r.meeting_id === m.id)
        .map((r) => (locked ? lockResource(r) : r)),
    })),
  });
});
catalog.get("/meetings", async (c) => {
  const rows = await c.env.DB.prepare(
    meetingQuery +
      " WHERE b.status!='archived' ORDER BY m.starts_at IS NULL,m.starts_at",
  ).all<Meeting>();
  return c.json(
    emailLocked(c) ? rows.results.map(lockRecording) : rows.results,
  );
});
catalog.get("/meetings/:id", async (c) => {
  const meeting = await c.env.DB.prepare(
    meetingQuery + " WHERE m.id=? AND b.status!='archived'",
  )
    .bind(c.req.param("id"))
    .first<Meeting>();
  if (!meeting) return missing();
  const resources = await c.env.DB.prepare(
    "SELECT id,meeting_id,title,url,kind FROM resources WHERE meeting_id=? ORDER BY CASE kind WHEN 'summary_pdf' THEN 0 WHEN 'summary_epub' THEN 1 WHEN 'slides' THEN 2 WHEN 'transcript' THEN 3 ELSE 4 END,title",
  )
    .bind(meeting.id)
    .all<Resource>();
  const rsvp = await c.env.DB.prepare(
    "SELECT response FROM meeting_rsvps WHERE meeting_id=? AND user_id=?",
  )
    .bind(meeting.id, c.get("identity").userId)
    .first<MeetingRsvp>("response");
  const locked = emailLocked(c);
  return c.json({
    meeting: locked ? lockRecording(meeting) : meeting,
    resources: locked ? resources.results.map(lockResource) : resources.results,
    rsvp: rsvp ?? null,
  });
});
catalog.put("/meetings/:id/rsvp", async (c) => {
  const { response } = await input(c, rsvpSchema);
  const meeting = await c.env.DB.prepare(
    meetingQuery + " WHERE m.id=? AND b.status!='archived'",
  )
    .bind(c.req.param("id"))
    .first<Meeting>();
  if (!meeting) return missing();
  if (
    meeting.status !== "scheduled" ||
    !meeting.starts_at ||
    Date.parse(meeting.starts_at) <= Date.now()
  )
    throw new HTTPException(409, {
      message: "A confirmação de presença está encerrada para este encontro.",
    });
  await c.env.DB.prepare(
    "INSERT INTO meeting_rsvps(meeting_id,user_id,response,updated_at) VALUES(?,?,?,?) ON CONFLICT(meeting_id,user_id) DO UPDATE SET response=excluded.response,updated_at=excluded.updated_at",
  )
    .bind(
      meeting.id,
      c.get("identity").userId,
      response,
      new Date().toISOString(),
    )
    .run();
  return c.json({ rsvp: response });
});
catalog.get("/meetings/:id/calendar.ics", async (c) => {
  const m = await c.env.DB.prepare(
    meetingQuery + " WHERE m.id=? AND b.status!='archived'",
  )
    .bind(c.req.param("id"))
    .first<Meeting>();
  if (!m?.starts_at) return missing();
  c.header("Content-Type", "text/calendar; charset=utf-8");
  c.header("Content-Disposition", 'attachment; filename="encontro.ics"');
  return c.body(meetingToIcs(m, c.env.APP_ORIGIN));
});
catalog.get("/community", async (c) => {
  const settings = await c.env.DB.prepare(
    "SELECT * FROM settings WHERE id=1",
  ).first<Settings>();
  const accepted = await c.env.DB.prepare(
    "SELECT version FROM community_onboarding WHERE user_id=?",
  )
    .bind(c.get("identity").userId)
    .first<string>("version");
  const onboardingRequired = accepted !== onboardingVersion;
  const emailConfirmationRequired = emailLocked(c);
  const invitations = !onboardingRequired && !emailConfirmationRequired;
  const book = await c.env.DB.prepare(
    "SELECT b.title FROM books b JOIN reading_cycles cy ON cy.book_id=b.id WHERE cy.is_current=1",
  ).first<string>("title");
  const next = await c.env.DB.prepare(
    "SELECT m.id,m.title,m.chapters,m.starts_at,m.duration_minutes,m.meeting_url FROM meetings m JOIN reading_cycles cy ON cy.id=m.cycle_id JOIN books b ON b.id=cy.book_id WHERE " +
      nextMeetingWhere +
      " ORDER BY m.starts_at LIMIT 1",
  )
    .bind(new Date().toISOString())
    .first<CommunityMeeting & { meeting_url: string }>();
  // Only whether there is a call link: the link itself stays on the meeting page.
  const nextMeeting: CommunityMeeting | null = next && {
    id: next.id,
    title: next.title,
    chapters: next.chapters,
    starts_at: next.starts_at,
    duration_minutes: next.duration_minutes,
    has_call_link: !!next.meeting_url,
  };
  return c.json({
    ...settings,
    whatsapp_url: invitations ? settings?.whatsapp_url : "",
    discord_url: invitations ? settings?.discord_url : "",
    // Lets the page leave the optional Discord out before the invitation is
    // released, without revealing the invitation itself.
    discordAvailable: !!settings?.discord_url?.trim(),
    onboardingRequired,
    onboardingVersion,
    emailConfirmationRequired,
    currentBookTitle: book,
    nextMeeting,
  });
});
catalog.post("/community/acknowledge", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (body?.version !== onboardingVersion || body?.confirmed !== true)
    return c.json(
      { error: "Leia as informações e confirme para continuar." },
      400,
    );
  await c.env.DB.prepare(
    "INSERT INTO community_onboarding(user_id,version,accepted_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET version=excluded.version,accepted_at=excluded.accepted_at",
  )
    .bind(c.get("identity").userId, onboardingVersion, new Date().toISOString())
    .run();
  return c.json({ ok: true });
});
// Funnel only: the first click per person and group, shown as totals.
catalog.post("/community/join", async (c) => {
  const { channel } = await input(c, groupClickSchema);
  if (emailLocked(c))
    throw new HTTPException(409, {
      message: "Confirme seu e-mail para liberar os convites.",
    });
  const accepted = await c.env.DB.prepare(
    "SELECT version FROM community_onboarding WHERE user_id=?",
  )
    .bind(c.get("identity").userId)
    .first<string>("version");
  if (accepted !== onboardingVersion)
    throw new HTTPException(409, {
      message: "Confirme como o clube funciona para liberar os convites.",
    });
  await c.env.DB.prepare(
    "INSERT INTO community_group_clicks(user_id,channel,clicked_at) VALUES(?,?,?) ON CONFLICT(user_id,channel) DO NOTHING",
  )
    .bind(c.get("identity").userId, channel, new Date().toISOString())
    .run();
  return c.json({ ok: true });
});
export { catalog };
