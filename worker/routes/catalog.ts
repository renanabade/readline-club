import { Hono } from "hono";
import type { AppEnv, Env } from "../env";
import type {
  Book,
  Category,
  Meeting,
  Resource,
  Cycle,
  Settings,
} from "../../shared/contracts";
import { missing } from "../errors";
import { meetingToIcs } from "../lib/calendar";
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
export const meetingQuery = `SELECT m.*,b.title book_title,b.id book_id,r.youtube_id FROM meetings m JOIN reading_cycles cy ON cy.id=m.cycle_id JOIN books b ON b.id=cy.book_id LEFT JOIN recordings r ON r.meeting_id=m.id AND r.published=1`;
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
  return c.json({ book, cycles: cycles.results, meetings: meetings.results });
});
catalog.get("/meetings", async (c) => {
  const rows = await c.env.DB.prepare(
    meetingQuery +
      " WHERE b.status!='archived' ORDER BY m.starts_at IS NULL,m.starts_at",
  ).all<Meeting>();
  return c.json(rows.results);
});
catalog.get("/meetings/:id", async (c) => {
  const meeting = await c.env.DB.prepare(
    meetingQuery + " WHERE m.id=? AND b.status!='archived'",
  )
    .bind(c.req.param("id"))
    .first<Meeting>();
  if (!meeting) return missing();
  const resources = await c.env.DB.prepare(
    "SELECT * FROM resources WHERE meeting_id=?",
  )
    .bind(meeting.id)
    .all<Resource>();
  return c.json({ meeting, resources: resources.results });
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
  return c.body(meetingToIcs(m));
});
const onboardingVersion = "community-v1";
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
  const book = await c.env.DB.prepare(
    "SELECT b.title FROM books b JOIN reading_cycles cy ON cy.book_id=b.id WHERE cy.is_current=1",
  ).first<string>("title");
  const nextMeeting = await c.env.DB.prepare(
    "SELECT title,chapters,starts_at,duration_minutes FROM meetings WHERE status='scheduled' AND starts_at>=? ORDER BY starts_at LIMIT 1",
  )
    .bind(new Date().toISOString())
    .first();
  return c.json({
    ...settings,
    whatsapp_url: onboardingRequired ? "" : settings?.whatsapp_url,
    discord_url: onboardingRequired ? "" : settings?.discord_url,
    onboardingRequired,
    onboardingVersion,
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
export { catalog };
