import { Hono, type Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../env";
import { input, missing } from "../errors";
import {
  scheduledEmailDraftSchema,
  scheduledEmailSchema,
} from "../../shared/validation";
import type {
  ScheduledEmail,
  ScheduledEmailPreview,
} from "../../shared/contracts";
import { emailConfirmedSql } from "../lib/email-gate";
import {
  isUpcomingMeeting,
  scheduledEmailMeeting,
  scheduledEmailMessage,
  testToken,
  type ScheduledEmailDraft,
} from "../lib/scheduled-email";
// One-off emails about a meeting, sent by the mailer's cron at the chosen
// time. Mounted under the admin guard.
const scheduledEmails = new Hono<AppEnv>();
async function upcomingMeeting(c: Context<AppEnv>, meetingId: string) {
  const meeting = await scheduledEmailMeeting(c.env.DB, meetingId);
  if (!meeting) throw missing();
  if (!isUpcomingMeeting(meeting))
    throw new HTTPException(409, {
      message:
        "Só é possível escrever para encontros agendados que ainda não aconteceram.",
    });
  return meeting;
}
scheduledEmails.get("/meetings/:id/emails", async (c) => {
  const [emails, totals] = await c.env.DB.batch([
    c.env.DB.prepare(
      "SELECT id,meeting_id,subject,body,send_at,status,created_at FROM scheduled_emails WHERE meeting_id=? ORDER BY send_at DESC",
    ).bind(c.req.param("id")),
    // An unknown outcome stays 'sending' with an error code: reported apart.
    c.env.DB.prepare(
      `SELECT r.email_id,r.version,CASE WHEN r.status='sending' AND r.error_code IS NOT NULL THEN 'unknown' ELSE r.status END AS status,COUNT(*) AS total
      FROM scheduled_email_recipients r JOIN scheduled_emails e ON e.id=r.email_id WHERE e.meeting_id=? GROUP BY 1,2,3`,
    ).bind(c.req.param("id")),
  ]);
  const byEmail = (totals.results as ({ email_id: string } & object)[]).reduce(
    (map, { email_id, ...row }) =>
      map.set(email_id, [...(map.get(email_id) ?? []), row]),
    new Map<string, object[]>(),
  );
  return c.json<ScheduledEmail[]>(
    (emails.results as Omit<ScheduledEmail, "totals">[]).map((e) => ({
      ...e,
      totals: (byEmail.get(e.id) ?? []) as ScheduledEmail["totals"],
    })),
  );
});
scheduledEmails.post("/emails/preview", async (c) => {
  const draft = await input(c, scheduledEmailDraftSchema);
  const meeting = await upcomingMeeting(c, draft.meetingId);
  const counts = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(${emailConfirmedSql}),0) AS full,COALESCE(SUM(NOT (${emailConfirmedSql})),0) AS locked
    FROM users u JOIN applications a ON a.email=u.email WHERE a.status='approved' AND u.role='member' AND u.meeting_emails=1`,
  ).first<{ full: number; locked: number }>();
  const identity = c.get("identity");
  const copy = (version: "full" | "locked") => {
    const message = scheduledEmailMessage(
      version,
      draft,
      meeting,
      { email: identity.email, name: identity.name, rulesAccepted: false },
      // Only the content is shown: the sender is the mailer's.
      { APP_ORIGIN: c.env.APP_ORIGIN, EMAIL_FROM: "" },
      testToken,
    );
    return { subject: message.subject, text: message.text ?? "" };
  };
  return c.json<ScheduledEmailPreview>({
    full: copy("full"),
    locked: copy("locked"),
    recipients: { full: counts?.full ?? 0, locked: counts?.locked ?? 0 },
  });
});
scheduledEmails.post("/emails/test", async (c) => {
  const draft = await input(c, scheduledEmailDraftSchema);
  await upcomingMeeting(c, draft.meetingId);
  const failed = new HTTPException(503, {
    message:
      "Não foi possível enviar o teste agora. Tente de novo em instantes.",
  });
  if (!c.env.APPROVAL_EMAIL) throw failed;
  const body: ScheduledEmailDraft & { meetingId: string; userId: string } = {
    ...draft,
    userId: c.get("identity").userId,
  };
  const response = await c.env.APPROVAL_EMAIL.fetch(
    "https://approval.internal/scheduled-email-test",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  ).catch(() => null);
  const result = response?.ok
    ? ((await response.json()) as { status?: string })
    : null;
  if (result?.status !== "sent") throw failed;
  return c.json({
    message: `Enviamos as duas versões para ${c.get("identity").email}.`,
  });
});
scheduledEmails.post("/emails", async (c) => {
  const data = await input(c, scheduledEmailSchema);
  const meeting = await upcomingMeeting(c, data.meetingId);
  const sendAt = new Date(data.sendAt);
  if (sendAt.getTime() <= Date.now())
    throw new HTTPException(400, {
      message: "Escolha um horário que ainda não passou.",
    });
  if (sendAt.getTime() >= Date.parse(meeting.starts_at))
    throw new HTTPException(400, {
      message: "Escolha um horário antes do início do encontro.",
    });
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO scheduled_emails(id,meeting_id,subject,body,send_at,created_by) VALUES(?,?,?,?,?,?)",
  )
    .bind(
      id,
      meeting.id,
      data.subject,
      data.body,
      sendAt.toISOString(),
      c.get("identity").userId,
    )
    .run();
  return c.json({ id }, 201);
});
// Only before the cron starts it: after that, part of the club already has it.
scheduledEmails.delete("/emails/:id", async (c) => {
  const cancelled = await c.env.DB.prepare(
    "UPDATE scheduled_emails SET status='cancelled' WHERE id=? AND status='scheduled' RETURNING id",
  )
    .bind(c.req.param("id"))
    .first();
  if (cancelled) return c.json({ ok: true });
  const exists = await c.env.DB.prepare(
    "SELECT 1 FROM scheduled_emails WHERE id=?",
  )
    .bind(c.req.param("id"))
    .first();
  if (!exists) return missing();
  throw new HTTPException(409, {
    message: "Este e-mail já começou a sair e não pode mais ser cancelado.",
  });
});
export { scheduledEmails };
