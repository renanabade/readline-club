import { Hono } from "hono";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../env";
import { input, missing } from "../errors";
import {
  bookSchema,
  cycleSchema,
  meetingSchema,
  settingsSchema,
  httpsUrl,
} from "../../shared/validation";
import { books, meetingQuery } from "./catalog";
import { parseYouTubeId } from "../lib/youtube";
import { digest, randomToken } from "../auth/password";
import { notifyApproval } from "../lib/approval-email";
const admin = new Hono<AppEnv>();
admin.get("/overview", async (c) => {
  const [
    applications,
    list,
    cycles,
    meetings,
    categories,
    resources,
    recordings,
    settings,
  ] = await Promise.all([
    c.env.DB.prepare(
      "SELECT a.*,u.id user_id,n.status approval_email_status,n.sent_at approval_email_sent_at,n.error_code approval_email_error FROM applications a LEFT JOIN users u ON u.email=a.email LEFT JOIN approval_notifications n ON n.application_id=a.id ORDER BY CASE a.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 WHEN 'suspended' THEN 2 ELSE 3 END, CASE WHEN a.status='pending' THEN a.created_at END ASC, a.created_at DESC,a.id",
    ).all(),
    books(c.env.DB, true),
    c.env.DB.prepare("SELECT * FROM reading_cycles").all(),
    c.env.DB.prepare(
      meetingQuery + " ORDER BY m.starts_at IS NULL,m.starts_at",
    ).all(),
    c.env.DB.prepare("SELECT * FROM categories ORDER BY name").all(),
    c.env.DB.prepare("SELECT * FROM resources").all(),
    c.env.DB.prepare("SELECT * FROM recordings").all(),
    c.env.DB.prepare("SELECT * FROM settings WHERE id=1").first(),
  ]);
  return c.json({
    applications: applications.results,
    books: list,
    cycles: cycles.results,
    meetings: meetings.results,
    categories: categories.results,
    resources: resources.results,
    recordings: recordings.results,
    settings,
  });
});
admin.post("/applications/approve-all", async (c) => {
  const { ids } = await input(
    c,
    z.object({ ids: z.array(z.string().min(1).max(100)).min(1).max(20) }),
  );
  // Only the pending snapshot confirmed in the browser is eligible. A changed
  // status or a signup that arrived later cannot be swept into this operation.
  const changed = await c.env.DB.prepare(
    `UPDATE applications SET status='approved',updated_at=?
    WHERE status='pending' AND id IN (SELECT value FROM json_each(?))
    AND EXISTS (SELECT 1 FROM users u WHERE u.email=applications.email AND u.role='member') RETURNING id`,
  )
    .bind(new Date().toISOString(), JSON.stringify([...new Set(ids)]))
    .all<{ id: string }>();
  let notified = 0;
  for (const { id } of changed.results) {
    if ((await notifyApproval(c.env, id)).emailStatus === "sent") notified++;
  }
  return c.json({
    approved: changed.results.length,
    notified,
    notificationFailures: changed.results.length - notified,
  });
});
admin.patch("/applications/:id", async (c) => {
  const { status } = await input(
    c,
    z.object({
      status: z.enum(["pending", "approved", "rejected", "suspended"]),
    }),
  );
  const row = await c.env.DB.prepare(
    "UPDATE applications SET status=?,updated_at=? WHERE id=? RETURNING id",
  )
    .bind(status, new Date().toISOString(), c.req.param("id"))
    .first();
  if (!row) return missing();
  if (status === "approved")
    return c.json({
      ok: true,
      ...(await notifyApproval(c.env, c.req.param("id"))),
    });
  return c.json({ ok: true });
});
admin.post("/applications/:id/notify", async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT id FROM applications WHERE id=? AND status='approved'",
  )
    .bind(c.req.param("id"))
    .first();
  if (!row) return missing();
  return c.json({
    ok: true,
    ...(await notifyApproval(c.env, c.req.param("id"))),
  });
});
admin.post("/members/:id/reset", async (c) => {
  const user = await c.env.DB.prepare(
    "SELECT id FROM users WHERE id=? AND role='member'",
  )
    .bind(c.req.param("id"))
    .first<{ id: string }>();
  if (!user) return missing();
  const token = randomToken();
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM password_resets WHERE user_id=?").bind(
      user.id,
    ),
    c.env.DB.prepare(
      "INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES(?,?,?)",
    ).bind(digest(token), user.id, Date.now() + 30 * 60000),
  ]);
  return c.json({ url: c.env.APP_ORIGIN + "/redefinir-senha#" + token }, 201);
});
const entities = {
  books: {
    schema: bookSchema,
    fields: ["title", "author", "description", "edition", "level", "status"],
  },
  cycles: { schema: cycleSchema, fields: ["book_id", "title", "is_current"] },
  meetings: {
    schema: meetingSchema,
    fields: [
      "cycle_id",
      "title",
      "chapters",
      "starts_at",
      "duration_minutes",
      "status",
      "agenda",
      "summary",
      "meeting_url",
    ],
  },
  categories: {
    schema: z.object({ name: z.string().trim().min(1).max(100) }),
    fields: ["name"],
  },
  resources: {
    schema: z.object({
      meeting_id: z.string().min(1).max(100),
      title: z.string().trim().min(1).max(200),
      url: httpsUrl.refine((v) => !!v),
    }),
    fields: ["meeting_id", "title", "url"],
  },
};
for (const [route, config] of Object.entries(entities)) {
  const table = route === "cycles" ? "reading_cycles" : route;
  for (const method of ["post", "patch"] as const)
    admin[method](
      "/" + route + (method === "patch" ? "/:id" : ""),
      async (c) => {
        const data = await input(
          c,
          config.schema as z.ZodType<Record<string, unknown>>,
        );
        const id =
          method === "patch" ? c.req.param("id")! : crypto.randomUUID();
        if (
          method === "patch" &&
          !(await c.env.DB.prepare("SELECT id FROM " + table + " WHERE id=?")
            .bind(id)
            .first())
        )
          return missing();
        for (const [field, target] of [
          ["book_id", "books"],
          ["cycle_id", "reading_cycles"],
          ["meeting_id", "meetings"],
        ] as const) {
          if (
            field in data &&
            !(await c.env.DB.prepare("SELECT id FROM " + target + " WHERE id=?")
              .bind(data[field])
              .first())
          )
            throw new HTTPException(400, {
              message: "O conteúdo relacionado não existe.",
            });
        }
        const categoryIds = [...new Set((data.category_ids || []) as string[])];
        for (const cat of categoryIds)
          if (
            !(await c.env.DB.prepare("SELECT id FROM categories WHERE id=?")
              .bind(cat)
              .first())
          )
            throw new HTTPException(400, { message: "Categoria inválida." });
        const batch: D1PreparedStatement[] = [];
        if (route === "cycles" && data.is_current === 1)
          batch.push(
            c.env.DB.prepare(
              "UPDATE reading_cycles SET is_current=0 WHERE is_current=1",
            ),
          );
        if (method === "post")
          batch.push(
            c.env.DB.prepare(
              "INSERT INTO " +
                table +
                "(id," +
                config.fields.join(",") +
                ") VALUES(" +
                ["?", ...config.fields.map(() => "?")].join(",") +
                ")",
            ).bind(id, ...config.fields.map((k) => data[k])),
          );
        else
          batch.push(
            c.env.DB.prepare(
              "UPDATE " +
                table +
                " SET " +
                config.fields.map((k) => k + "=?").join(",") +
                (route === "meetings" ? ",updated_at=?" : "") +
                " WHERE id=?",
            ).bind(
              ...config.fields.map((k) => data[k]),
              ...(route === "meetings" ? [new Date().toISOString()] : []),
              id,
            ),
          );
        if (route === "books") {
          batch.push(
            c.env.DB.prepare(
              "DELETE FROM book_categories WHERE book_id=?",
            ).bind(id),
          );
          for (const cat of categoryIds)
            batch.push(
              c.env.DB.prepare(
                "INSERT INTO book_categories(book_id,category_id) VALUES(?,?)",
              ).bind(id, cat),
            );
        }
        try {
          await c.env.DB.batch(batch);
        } catch {
          throw new HTTPException(400, {
            message:
              "Não foi possível salvar. Confira referências e nomes duplicados.",
          });
        }
        return c.json({ id }, method === "post" ? 201 : 200);
      },
    );
}
admin.post("/recordings", async (c) => {
  const data = await input(
    c,
    z.object({
      meeting_id: z.string().min(1).max(100),
      url: z.string().max(2000),
      published: z.coerce.number().int().min(0).max(1),
    }),
  );
  const video = parseYouTubeId(data.url);
  if (!video)
    throw new HTTPException(400, {
      message: "Cole um link válido do YouTube.",
    });
  if (
    !(await c.env.DB.prepare("SELECT id FROM meetings WHERE id=?")
      .bind(data.meeting_id)
      .first())
  )
    throw new HTTPException(400, { message: "Encontro inválido." });
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO recordings(id,meeting_id,youtube_id,published) VALUES(?,?,?,?) ON CONFLICT(meeting_id) DO UPDATE SET youtube_id=excluded.youtube_id,published=excluded.published",
  )
    .bind(id, data.meeting_id, video, data.published)
    .run();
  return c.json({ ok: true }, 201);
});
admin.patch("/settings", async (c) => {
  const d = await input(c, settingsSchema);
  await c.env.DB.prepare(
    "UPDATE settings SET club_name=?,description=?,whatsapp_url=?,discord_url=?,community_guidelines=? WHERE id=1",
  )
    .bind(
      d.club_name,
      d.description,
      d.whatsapp_url,
      d.discord_url,
      d.community_guidelines,
    )
    .run();
  return c.json({ ok: true });
});
admin.delete("/resources/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM resources WHERE id=?")
    .bind(c.req.param("id"))
    .run();
  return c.json({ ok: true });
});
export { admin };
