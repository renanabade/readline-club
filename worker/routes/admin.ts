import { Hono, type Context } from "hono";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../env";
import { input, missing } from "../errors";
import {
  bookSchema,
  cycleSchema,
  meetingSchema,
  patchSchema,
  settingsSchema,
  httpsUrl,
  resourceKinds,
  uploadSchema,
} from "../../shared/validation";
import { expireDepartures } from "./auth";
import { books, meetingQuery, onboardingVersion } from "./catalog";
import { parseYouTubeId } from "../lib/youtube";
import {
  detectFileType,
  fileContentType,
  fileKey,
  filePath,
  maxFileBytes,
} from "../lib/files";
import { digest, randomToken } from "../auth/password";
import { notifyApproval } from "../lib/approval-email";
const admin = new Hono<AppEnv>();
admin.get("/overview", async (c) => {
  await expireDepartures(c.env.DB).run();
  const [
    applications,
    list,
    cycles,
    meetings,
    categories,
    resources,
    recordings,
    settings,
    invitations,
    rsvps,
    departures,
    communityFunnel,
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
    // Totals only: the panel shows how many confirmed, never who.
    // An unknown outcome stays 'sending' with an error code; it is not in
    // progress, so it is reported apart.
    c.env.DB.prepare(
      "SELECT meeting_id,CASE WHEN status='sending' AND error_code IS NOT NULL THEN 'unknown' ELSE status END AS status,COUNT(*) AS total FROM meeting_invitations GROUP BY 1,2",
    ).all(),
    // Answers among approved members; scheduled meetings also count the
    // members who have not answered yet ('none').
    c.env.DB.prepare(
      "WITH members AS (SELECT u.id FROM users u JOIN applications a ON a.email=u.email WHERE a.status='approved' AND u.role='member') SELECT meeting_id,response,COUNT(*) AS total FROM meeting_rsvps WHERE user_id IN members GROUP BY meeting_id,response UNION ALL SELECT m.id,'none',COUNT(*) FROM meetings m JOIN members u LEFT JOIN meeting_rsvps r ON r.meeting_id=m.id AND r.user_id=u.id WHERE m.status='scheduled' AND r.user_id IS NULL GROUP BY m.id",
    ).all(),
    c.env.DB.prepare(
      "SELECT id,name,phone,left_at FROM member_departures ORDER BY left_at",
    ).all(),
    // Totals among approved members, like the public member count.
    c.env.DB.prepare(
      "WITH members AS (SELECT u.id FROM users u JOIN applications a ON a.email=u.email WHERE a.status='approved' AND u.role='member') SELECT (SELECT COUNT(*) FROM community_onboarding WHERE version=? AND user_id IN members) AS acknowledged,(SELECT COUNT(*) FROM community_group_clicks WHERE channel='whatsapp' AND user_id IN members) AS whatsapp,(SELECT COUNT(*) FROM community_group_clicks WHERE channel='discord' AND user_id IN members) AS discord",
    )
      .bind(onboardingVersion)
      .first(),
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
    invitations: invitations.results,
    rsvps: rsvps.results,
    departures: departures.results,
    communityFunnel,
  });
});
// The organization confirms the person left the groups: nothing is kept.
admin.delete("/departures/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM member_departures WHERE id=?")
    .bind(c.req.param("id"))
    .run();
  return c.json({ ok: true });
});
admin.post("/applications/approve-all", async (c) => {
  const { ids } = await input(
    c,
    z.object({ ids: z.array(z.string().min(1).max(100)).min(1).max(20) }),
  );
  // Only the pending snapshot confirmed in the browser is eligible. A changed
  // status or a signup that arrived later cannot be swept into this operation.
  // Unconfirmed emails are approved one by one, after checking them.
  const changed = await c.env.DB.prepare(
    `UPDATE applications SET status='approved',updated_at=?
    WHERE status='pending' AND email_verified_at IS NOT NULL AND id IN (SELECT value FROM json_each(?))
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
async function invitableMeeting(c: Context<AppEnv>) {
  const meeting = await c.env.DB.prepare(
    "SELECT id,status,starts_at FROM meetings WHERE id=?",
  )
    .bind(c.req.param("id"))
    .first<{ id: string; status: string; starts_at: string | null }>();
  if (!meeting) return missing();
  if (
    meeting.status !== "scheduled" ||
    !meeting.starts_at ||
    Date.parse(meeting.starts_at) <= Date.now()
  )
    throw new HTTPException(409, {
      message:
        "Só é possível convidar para encontros agendados que ainda não aconteceram.",
    });
  return meeting.id;
}
admin.post("/meetings/:id/invitations", async (c) => {
  const id = await invitableMeeting(c);
  // Approved members who accept meeting emails and were not invited yet. The
  // mailer's cron sends the queue in the background. Known failures and skipped invitations get another chance; sent and
  // unknown outcomes are never queued again.
  const [inserted] = await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO meeting_invitations(meeting_id,user_id)
      SELECT ?,u.id FROM users u JOIN applications a ON a.email=u.email
      WHERE a.status='approved' AND u.role='member' AND u.meeting_emails=1
      ON CONFLICT(meeting_id,user_id) DO NOTHING`,
    ).bind(id),
    c.env.DB.prepare(
      "UPDATE meeting_invitations SET status='queued',error_code=NULL WHERE meeting_id=? AND status IN ('failed','skipped')",
    ).bind(id),
  ]);
  const queued = await c.env.DB.prepare(
    "SELECT COUNT(*) AS total FROM meeting_invitations WHERE meeting_id=? AND status='queued'",
  )
    .bind(id)
    .first<number>("total");
  return c.json({ added: inserted?.meta.changes ?? 0, queued: queued ?? 0 });
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
      url: httpsUrl.refine((v) => !!v, "Envie um arquivo ou cole um link."),
      kind: z.enum(resourceKinds).default("link"),
    }),
    fields: ["meeting_id", "title", "url", "kind"],
  },
};
for (const [route, config] of Object.entries(entities)) {
  const table = route === "cycles" ? "reading_cycles" : route;
  const schemas = { post: config.schema, patch: patchSchema(config.schema) };
  for (const method of ["post", "patch"] as const)
    admin[method](
      "/" + route + (method === "patch" ? "/:id" : ""),
      async (c) => {
        const data = await input(
          c,
          schemas[method] as z.ZodType<Record<string, unknown>>,
        );
        // A PATCH only touches the columns present in the body.
        const fields = config.fields.filter(
          (k) => method === "post" || k in data,
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
                fields.join(",") +
                ") VALUES(" +
                ["?", ...fields.map(() => "?")].join(",") +
                ")",
            ).bind(id, ...fields.map((k) => data[k])),
          );
        else if (fields.length)
          batch.push(
            c.env.DB.prepare(
              "UPDATE " +
                table +
                " SET " +
                fields.map((k) => k + "=?").join(",") +
                (route === "meetings" ? ",updated_at=?" : "") +
                " WHERE id=?",
            ).bind(
              ...fields.map((k) => data[k]),
              ...(route === "meetings" ? [new Date().toISOString()] : []),
              id,
            ),
          );
        if (route === "books" && "category_ids" in data) {
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
    "UPDATE settings SET club_name=?,description=?,whatsapp_url=?,discord_url=?,community_guidelines=?,instagram_url=?,linkedin_url=?,youtube_url=?,x_url=? WHERE id=1",
  )
    .bind(
      d.club_name,
      d.description,
      d.whatsapp_url,
      d.discord_url,
      d.community_guidelines,
      d.instagram_url,
      d.linkedin_url,
      d.youtube_url,
      d.x_url,
    )
    .run();
  return c.json({ ok: true });
});
admin.post("/files", async (c) => {
  if (!c.env.FILES)
    throw new HTTPException(503, {
      message: "O envio de arquivos não está configurado.",
    });
  let form: Record<string, string | File>;
  try {
    form = await c.req.parseBody();
  } catch {
    throw new HTTPException(400, { message: "Envie um formulário válido." });
  }
  const parsed = uploadSchema.safeParse(form);
  if (!parsed.success)
    throw new HTTPException(400, {
      message: parsed.error.issues[0]?.message || "Confira os campos.",
    });
  const file = form.file;
  if (!(file instanceof File) || !file.size)
    throw new HTTPException(400, { message: "Escolha um arquivo." });
  if (file.size > maxFileBytes)
    throw new HTTPException(413, {
      message: "O arquivo passa de 20 MB.",
    });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectFileType(bytes);
  if (!type)
    throw new HTTPException(400, {
      message: "Envie um arquivo PDF ou EPUB.",
    });
  const data = parsed.data;
  if (
    !(await c.env.DB.prepare("SELECT id FROM meetings WHERE id=?")
      .bind(data.meeting_id)
      .first())
  )
    throw new HTTPException(400, { message: "Encontro inválido." });
  const key = crypto.randomUUID();
  await c.env.FILES.put(key, bytes, {
    httpMetadata: { contentType: fileContentType(type) },
    customMetadata: { type },
  });
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO resources(id,meeting_id,title,url,kind) VALUES(?,?,?,?,?)",
  )
    .bind(
      id,
      data.meeting_id,
      data.title,
      c.env.APP_ORIGIN + filePath + key,
      data.kind,
    )
    .run();
  return c.json({ id }, 201);
});
admin.delete("/resources/:id", async (c) => {
  const resource = await c.env.DB.prepare(
    "DELETE FROM resources WHERE id=? RETURNING url",
  )
    .bind(c.req.param("id"))
    .first<{ url: string }>();
  const key = resource && fileKey(resource.url, c.env.APP_ORIGIN);
  if (key) await c.env.FILES?.delete(key);
  return c.json({ ok: true });
});
export { admin };
