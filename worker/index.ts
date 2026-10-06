import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { bodyLimit } from "hono/body-limit";
import type { AppEnv } from "./env";
import { auth } from "./routes/auth";
import { catalog, books } from "./routes/catalog";
import { requireUser, requireMember, requireAdmin } from "./auth/guards";
import { getIdentity } from "./auth/sessions";
import { admin } from "./routes/admin";
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
  app.use(
    "/api/*",
    bodyLimit({
      maxSize: 64000,
      onError: (c) => c.json({ error: "Formulário muito grande." }, 413),
    }),
  );
  app.get("/api/health", (c) => c.json({ ok: true }));
  app.get("/api/me", async (c) => c.json(await getIdentity(c.req.raw, c.env)));
  app.get("/api/public/home", async (c) => {
    const list = await books(c.env.DB);
    const cycle = await c.env.DB.prepare(
      "SELECT book_id FROM reading_cycles WHERE is_current=1",
    ).first<{ book_id: string }>();
    const settings = await c.env.DB.prepare(
      "SELECT club_name,description FROM settings WHERE id=1",
    ).first();
    const memberCount = await c.env.DB.prepare(
      "SELECT COUNT(*) AS total FROM applications a JOIN users u ON u.email=a.email WHERE a.status='approved' AND u.role='member'",
    ).first<number>("total");
    // Public announcement only: never select links, agenda or notes here.
    const nextMeeting = await c.env.DB.prepare(
      "SELECT m.id,m.title,m.chapters,m.starts_at,m.duration_minutes,m.status,b.title book_title FROM meetings m JOIN reading_cycles cy ON cy.id=m.cycle_id JOIN books b ON b.id=cy.book_id WHERE m.status='scheduled' AND m.starts_at>=? AND b.status!='archived' ORDER BY m.starts_at LIMIT 1",
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
  app.use("/api/admin/*", requireUser, requireMember, requireAdmin);
  app.route("/api/admin", admin);
  app.use("/api/books/*", requireUser, requireMember);
  app.use("/api/books", requireUser, requireMember);
  app.use("/api/meetings/*", requireUser, requireMember);
  app.use("/api/meetings", requireUser, requireMember);
  app.use("/api/community", requireUser, requireMember);
  app.use("/api/community/*", requireUser, requireMember);
  app.route("/api", catalog);
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
