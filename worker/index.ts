import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { bodyLimit } from "hono/body-limit";
import type { AppEnv } from "./env";
import { auth } from "./routes/auth";
import { catalog, books, nextMeetingWhere } from "./routes/catalog";
import { requireUser, requireMember, requireAdmin } from "./auth/guards";
import { getIdentity } from "./auth/sessions";
import { admin } from "./routes/admin";
import { rsvp } from "./routes/rsvp";
import { questions, questionsAdmin } from "./routes/questions";
import { attendance, attendanceAdmin } from "./routes/attendance";
import { scheduledEmails } from "./routes/scheduled-emails";
import { files } from "./routes/files";
import { maxFileBytes } from "./lib/files";
export function createApp() {
  const app = new Hono<AppEnv>();
  app.use("/api/*", async (c, next) => {
    c.header("Cache-Control", "private, no-store");
    c.header("X-Content-Type-Options", "nosniff");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(c.req.method) &&
      c.req.header("origin") !== c.env.APP_ORIGIN
    )
      return c.json({ error: "Origem não permitida." }, 403);
    await next();
  });
  const formLimit = bodyLimit({
    maxSize: 64000,
    onError: (c) => c.json({ error: "Formulário muito grande." }, 413),
  });
  // Room for the file plus the multipart envelope; the route checks the file.
  const uploadLimit = bodyLimit({
    maxSize: maxFileBytes + 64000,
    onError: (c) => c.json({ error: "O arquivo passa de 20 MB." }, 413),
  });
  app.use("/api/*", (c, next) =>
    (c.req.path === "/api/admin/files" ? uploadLimit : formLimit)(c, next),
  );
  app.get("/api/health", (c) => c.json({ ok: true }));
  app.get("/api/me", async (c) => c.json(await getIdentity(c.req.raw, c.env)));
  app.get("/api/public/home", async (c) => {
    const list = await books(c.env.DB);
    const cycle = await c.env.DB.prepare(
      "SELECT book_id FROM reading_cycles WHERE is_current=1",
    ).first<{ book_id: string }>();
    const settings = await c.env.DB.prepare(
      "SELECT club_name,description,instagram_url,linkedin_url,youtube_url,x_url FROM settings WHERE id=1",
    ).first();
    const memberCount = await c.env.DB.prepare(
      "SELECT COUNT(*) AS total FROM applications a JOIN users u ON u.email=a.email WHERE a.status='approved' AND u.role='member'",
    ).first<number>("total");
    // Public announcement only: never select links, agenda or notes here.
    const nextMeeting = await c.env.DB.prepare(
      "SELECT m.id,m.title,m.chapters,m.starts_at,m.duration_minutes,m.status,b.title book_title FROM meetings m JOIN reading_cycles cy ON cy.id=m.cycle_id JOIN books b ON b.id=cy.book_id WHERE " +
        nextMeetingWhere +
        " ORDER BY m.starts_at LIMIT 1",
    )
      .bind(new Date().toISOString())
      .first();
    return c.json({
      memberCount: memberCount ?? 0,
      nextMeeting,
      books: list,
      currentBook: list.find((b) => b.id === cycle?.book_id) || null,
      settings,
      turnstileSiteKey: c.env.TURNSTILE_SITE_KEY || "",
    });
  });
  app.route("/api/auth", auth);
  app.route("/api/rsvp", rsvp);
  app.use("/api/admin/*", requireUser, requireMember, requireAdmin);
  app.route("/api/admin", admin);
  app.route("/api/admin", questionsAdmin);
  app.route("/api/admin", attendanceAdmin);
  app.route("/api/admin", scheduledEmails);
  app.use("/api/attendance", requireUser, requireMember);
  app.route("/api/attendance", attendance);
  app.use("/api/books/*", requireUser, requireMember);
  app.use("/api/books", requireUser, requireMember);
  app.use("/api/meetings/*", requireUser, requireMember);
  app.use("/api/meetings", requireUser, requireMember);
  app.use("/api/files/*", requireUser, requireMember);
  app.route("/api/files", files);
  app.use("/api/community", requireUser, requireMember);
  app.use("/api/community/*", requireUser, requireMember);
  app.route("/api", catalog);
  app.route("/api", questions);
  app.notFound((c) => c.json({ error: "Não encontramos este endereço." }, 404));
  app.onError((err, c) => {
    if (err instanceof HTTPException)
      return c.json({ error: err.message }, err.status);
    console.error(JSON.stringify({ event: "request_failed", name: err.name }));
    return c.json(
      { error: "Não foi possível concluir. Tente novamente." },
      500,
    );
  });
  return app;
}
export default createApp();
