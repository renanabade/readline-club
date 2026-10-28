import type { Meeting } from "../../shared/contracts";
import { googleCalendarUrl } from "../../shared/calendar";
import { meetingToIcs } from "./calendar";
import { emailConfirmedSql } from "./email-gate";
import { rulesAcceptedSql } from "./community";
import { verificationLifetime } from "./email-verification";
import {
  escapeHtml,
  invitationWhen,
  rsvpToken,
  type InvitationEnv,
} from "./meeting-invitation";
export type ScheduledEmailVersion = "full" | "locked";
export interface ScheduledEmailDraft {
  subject: string;
  body: string;
}
export type ScheduledEmailMeeting = Meeting & {
  book_title: string;
  starts_at: string;
};
export interface ScheduledEmailRecipient {
  email: string;
  name: string;
  rulesAccepted: boolean;
}
export const scheduledEmailBatchSize = 20;
export const scheduledEmailBatchesPerRun = 5;
const sendConcurrency = 10;
// Links in the test copies: they look like the real ones but answer nothing.
export const testToken = "teste";
const meetingSql =
  "SELECT m.*,b.title book_title FROM meetings m JOIN reading_cycles cy ON cy.id=m.cycle_id JOIN books b ON b.id=cy.book_id WHERE m.id=?";
export async function scheduledEmailMeeting(DB: D1Database, meetingId: string) {
  return DB.prepare(meetingSql)
    .bind(meetingId)
    .first<Meeting & { book_title: string }>();
}
export const isUpcomingMeeting = (
  meeting: Pick<Meeting, "status" | "starts_at"> | null,
  now = Date.now(),
): meeting is ScheduledEmailMeeting =>
  meeting?.status === "scheduled" &&
  !!meeting.starts_at &&
  Date.parse(meeting.starts_at) > now;
const paragraphs = (body: string) =>
  body
    .trim()
    .split(/\n\s*\n/)
    .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
// 'full' carries the personal answer buttons and the calendar invitation.
// 'locked' goes to accounts that have not confirmed the email: the date and
// the reading, plus the links that unlock the rest.
export function scheduledEmailMessage(
  version: ScheduledEmailVersion,
  draft: ScheduledEmailDraft,
  meeting: ScheduledEmailMeeting,
  recipient: ScheduledEmailRecipient,
  env: Pick<InvitationEnv, "EMAIL_FROM" | "APP_ORIGIN">,
  token: string,
  test = false,
): EmailMessageBuilder {
  const when = invitationWhen(meeting.starts_at);
  const title = meeting.title.replace(/\s+/g, " ");
  const firstName = recipient.name.trim().split(/\s+/)[0] || "";
  const pageUrl =
    env.APP_ORIGIN + "/encontros/" + encodeURIComponent(meeting.id);
  const accountUrl = env.APP_ORIGIN + "/conta";
  const rulesUrl = env.APP_ORIGIN + "/comunidade";
  // Tokens travel in the fragment, which browsers never send to servers.
  const answerUrl = (answer: "sim" | "nao") =>
    env.APP_ORIGIN + "/presenca?resposta=" + answer + "#" + token;
  const confirmUrl = env.APP_ORIGIN + "/confirmar-email#" + token;
  const reading = [meeting.book_title, meeting.chapters]
    .filter(Boolean)
    .join(" · ");
  const button = (href: string, label: string, primary: boolean) =>
    `<a href="${escapeHtml(href)}" style="display:inline-block;margin:0 8px 8px 0;padding:12px 20px;border-radius:8px;text-decoration:none;${primary ? "background:#202024;color:white" : "border:1px solid #202024;color:#202024"}">${label}</a>`;
  const rules = recipient.rulesAccepted
    ? null
    : "Falta ler e aceitar os combinados da comunidade para receber os convites do grupo do WhatsApp e do Discord.";
  let text: string, html: string;
  if (version === "full") {
    const yesUrl = answerUrl("sim"),
      noUrl = answerUrl("nao");
    const calendarUrl = googleCalendarUrl(meeting, env.APP_ORIGIN)!;
    text = `Você vai participar? Responda com um clique, sem precisar entrar na plataforma:\nVou participar: ${yesUrl}\nNão vou poder: ${noUrl}\n\nPágina do encontro, com o link da chamada: ${pageUrl}\nAdicionar ao Google Agenda: ${calendarUrl}\nPara Apple Calendar ou Outlook, abra o arquivo .ics anexado.${rules ? `\n\n${rules} ${rulesUrl}` : ""}`;
    html = `<p>Você vai participar? Responda com um clique, sem precisar entrar na plataforma.</p><p>${button(yesUrl, "Vou participar", true)}${button(noUrl, "Não vou poder", false)}</p><p>${button(pageUrl, "Abrir a página do encontro", false)}${button(calendarUrl, "Adicionar ao Google Agenda", false)}</p><p style="font-size:14px">O link da chamada fica na página do encontro. Para Apple Calendar ou Outlook, abra o arquivo .ics anexado.</p>${rules ? `<p>${rules}</p><p>${button(rulesUrl, "Ler e aceitar os combinados", false)}</p>` : ""}<p style="font-size:13px">Os botões de resposta são pessoais: não encaminhe este e-mail.</p>`;
  } else {
    const lead =
      "Seu e-mail ainda não foi confirmado. Confirme para ver o link da chamada, responder à presença e liberar os grupos, as gravações e os resumos.";
    text = `${lead}\nConfirmar meu e-mail: ${confirmUrl}\nO link vale por 7 dias. Se ele expirar, entre na plataforma e peça outro.${rules ? `\n\n${rules} ${rulesUrl}` : ""}`;
    html = `<p>${lead}</p><p>${button(confirmUrl, "Confirmar meu e-mail", true)}${rules ? button(rulesUrl, "Ler e aceitar os combinados", false) : ""}</p><p style="font-size:13px">O link vale por 7 dias. Se ele expirar, entre na plataforma e peça outro.${rules ? " " + rules : ""}</p>`;
  }
  const testNote = test
    ? "Envio de teste: os botões pessoais deste e-mail não funcionam."
    : "";
  return {
    from: { email: env.EMAIL_FROM, name: "readline club" },
    to: recipient.email,
    replyTo: env.EMAIL_FROM,
    subject:
      (test
        ? `[Teste · ${version === "full" ? "completa" : "sem link"}] `
        : "") + draft.subject.replace(/\s+/g, " ").trim(),
    text: `${testNote ? testNote + "\n\n" : ""}Olá${firstName ? ", " + firstName : ""}!\n\n${draft.body.trim()}\n\n${title}\n${when} (horário de Brasília), ${meeting.duration_minutes} minutos.\n${reading}\n\n${text}\n\nVocê recebe este aviso por ser membro do readline club. Para não receber avisos de encontros, desative em Minha conta: ${accountUrl}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#202024;line-height:1.6">${testNote ? `<p style="padding:8px 12px;border:1px solid #202024;border-radius:8px">${testNote}</p>` : ""}<p><strong>readline club</strong><br>clube do livro de computação</p><p>Olá${firstName ? ", " + escapeHtml(firstName) : ""}!</p>${paragraphs(draft.body)}<h1 style="font-size:24px">${escapeHtml(title)}</h1><p><strong>${escapeHtml(when)}</strong> (horário de Brasília), ${meeting.duration_minutes} minutos.<br>${escapeHtml(reading)}</p>${html}<p style="font-size:12px;color:#6b6b73">Você recebe este aviso por ser membro do readline club. Para não receber avisos de encontros, desative em <a href="${escapeHtml(accountUrl)}">Minha conta</a>.</p></div>`,
    ...(version === "full"
      ? {
          attachments: [
            {
              disposition: "attachment" as const,
              filename: "readline-encontro.ics",
              type: "text/calendar; charset=utf-8; method=PUBLISH",
              content: meetingToIcs(meeting, env.APP_ORIGIN),
            },
          ],
        }
      : {}),
  };
}
const errorCode = (error: unknown) => {
  const code = (error as { code?: unknown })?.code;
  return typeof code === "string" && /^E_[A-Z_]+$/.test(code) ? code : null;
};
// Both versions to one person, marked as a test. Nothing is recorded: no
// recipient row, invitation or confirmation token.
export async function sendScheduledEmailTest(
  env: InvitationEnv,
  draft: ScheduledEmailDraft & { meetingId: string },
  userId: string,
) {
  const [meeting, user] = await Promise.all([
    scheduledEmailMeeting(env.DB, draft.meetingId),
    env.DB.prepare("SELECT email,name FROM users WHERE id=?")
      .bind(userId)
      .first<{ email: string; name: string }>(),
  ]);
  if (!isUpcomingMeeting(meeting) || !user) return { status: "ineligible" };
  const recipient = { ...user, rulesAccepted: false };
  let sent = 0;
  for (const version of ["full", "locked"] as const) {
    try {
      const result = await env.EMAIL.send(
        scheduledEmailMessage(
          version,
          draft,
          meeting,
          recipient,
          env,
          testToken,
          true,
        ),
      );
      if (result.messageId) sent++;
    } catch {
      // Reported as a count below; the test can simply be sent again.
    }
  }
  return { status: sent === 2 ? "sent" : "failed", sent };
}
// Due emails get their recipient list in the same transaction that starts
// them, so a run that stops halfway leaves nothing half-listed. Members who
// turned meeting emails off are left out; the email confirmation is not a
// filter here, it only picks the version.
async function startDueEmails(DB: D1Database, now: string) {
  await DB.batch([
    DB.prepare(
      `INSERT INTO scheduled_email_recipients(email_id,user_id)
      SELECT e.id,u.id FROM scheduled_emails e JOIN users u JOIN applications a ON a.email=u.email
      WHERE e.status='scheduled' AND e.send_at<=?1 AND a.status='approved' AND u.role='member' AND u.meeting_emails=1
      ON CONFLICT(email_id,user_id) DO NOTHING`,
    ).bind(now),
    DB.prepare(
      "UPDATE scheduled_emails SET status='sending' WHERE status='scheduled' AND send_at<=?",
    ).bind(now),
  ]);
  // The meeting was cancelled, moved to the past or already happened: what
  // is still queued is dropped.
  await DB.prepare(
    `UPDATE scheduled_email_recipients SET status='skipped' WHERE status='queued' AND email_id IN (
      SELECT e.id FROM scheduled_emails e JOIN meetings m ON m.id=e.meeting_id
      WHERE e.status='sending' AND NOT (m.status='scheduled' AND m.starts_at IS NOT NULL AND m.starts_at>?)
    )`,
  )
    .bind(now)
    .run();
}
interface ClaimedRecipient {
  email_id: string;
  user_id: string;
  email: string;
  name: string;
  confirmed: number;
  rules_accepted: number;
}
async function sendScheduledBatch(env: InvitationEnv) {
  const claimed = await env.DB.prepare(
    `UPDATE scheduled_email_recipients SET status='sending',attempted_at=?1,error_code=NULL
    WHERE rowid IN (
      SELECT r.rowid FROM scheduled_email_recipients r JOIN scheduled_emails e ON e.id=r.email_id
      WHERE r.status='queued' AND e.status='sending' LIMIT ?2
    ) AND status='queued' RETURNING email_id,user_id`,
  )
    .bind(new Date().toISOString(), scheduledEmailBatchSize)
    .all<{ email_id: string; user_id: string }>();
  if (!claimed.results.length) return { claimed: 0, sent: 0, failed: 0 };
  // Checked again at send time: someone may have turned meeting emails off,
  // been suspended or confirmed the email since the list was made.
  const recipients = (
    await env.DB.prepare(
      `SELECT r.email_id,r.user_id,u.email,u.name,(${emailConfirmedSql}) confirmed,(${rulesAcceptedSql}) rules_accepted
      FROM json_each(?) j JOIN scheduled_email_recipients r ON r.email_id=json_extract(j.value,'$.email_id') AND r.user_id=json_extract(j.value,'$.user_id')
      JOIN users u ON u.id=r.user_id JOIN applications a ON a.email=u.email
      WHERE a.status='approved' AND u.role='member' AND u.meeting_emails=1`,
    )
      .bind(JSON.stringify(claimed.results))
      .all<ClaimedRecipient>()
  ).results;
  const eligible = new Set(recipients.map((r) => r.email_id + r.user_id));
  const skipped = claimed.results.filter(
    (r) => !eligible.has(r.email_id + r.user_id),
  );
  if (skipped.length)
    await env.DB.prepare(
      `UPDATE scheduled_email_recipients SET status='skipped' WHERE rowid IN (
        SELECT r.rowid FROM json_each(?) j JOIN scheduled_email_recipients r ON r.email_id=json_extract(j.value,'$.email_id') AND r.user_id=json_extract(j.value,'$.user_id'))`,
    )
      .bind(JSON.stringify(skipped))
      .run();
  const emails = new Map<
    string,
    { draft: ScheduledEmailDraft; meeting: ScheduledEmailMeeting | null }
  >();
  for (const id of new Set(recipients.map((r) => r.email_id))) {
    const row = await env.DB.prepare(
      "SELECT subject,body,meeting_id FROM scheduled_emails WHERE id=?",
    )
      .bind(id)
      .first<{ subject: string; body: string; meeting_id: string }>();
    const meeting = row
      ? await scheduledEmailMeeting(env.DB, row.meeting_id)
      : null;
    emails.set(id, {
      draft: { subject: row?.subject ?? "", body: row?.body ?? "" },
      meeting: isUpcomingMeeting(meeting) ? meeting : null,
    });
  }
  const update = (sql: string, r: ClaimedRecipient, ...values: unknown[]) =>
    env.DB.prepare(
      `UPDATE scheduled_email_recipients SET ${sql} WHERE email_id=? AND user_id=?`,
    )
      .bind(...values, r.email_id, r.user_id)
      .run();
  const sendOne = async (r: ClaimedRecipient) => {
    const { draft, meeting } = emails.get(r.email_id)!;
    if (!meeting) {
      await update("status='skipped'", r);
      return null;
    }
    const version: ScheduledEmailVersion = r.confirmed ? "full" : "locked";
    const { token, hash } = await rsvpToken();
    const now = Date.now();
    // Stored before sending, so a link that reaches the inbox always works.
    if (version === "full")
      await update("version='full',rsvp_token_hash=?", r, hash);
    else
      // A fresh confirmation link, without sending the confirmation email:
      // only the newest link works, as when the person asks for another.
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO email_verifications(user_id,token_hash,expires_at,status,attempted_at,sent_at)
          VALUES(?1,?2,?3,'sent',?4,?4) ON CONFLICT(user_id) DO UPDATE SET
            token_hash=excluded.token_hash,expires_at=excluded.expires_at,status='sent',
            attempted_at=excluded.attempted_at,sent_at=excluded.sent_at,provider_id=NULL,error_code=NULL`,
        ).bind(
          r.user_id,
          hash,
          now + verificationLifetime,
          new Date(now).toISOString(),
        ),
        env.DB.prepare(
          "UPDATE scheduled_email_recipients SET version='locked' WHERE email_id=? AND user_id=?",
        ).bind(r.email_id, r.user_id),
      ]);
    let messageId: string;
    try {
      const result = await env.EMAIL.send(
        scheduledEmailMessage(
          version,
          draft,
          meeting,
          {
            email: r.email,
            name: r.name,
            rulesAccepted: !!r.rules_accepted,
          },
          env,
          token,
        ),
      );
      messageId = result.messageId;
      if (!messageId) throw new Error("missing_confirmation");
    } catch (error) {
      const code = errorCode(error);
      // Unknown outcomes stay locked as 'sending': the email may have gone out.
      await update(
        "status=?,error_code=?",
        r,
        code ? "failed" : "sending",
        code ?? "UNKNOWN",
      );
      return false;
    }
    const sentAt = new Date().toISOString();
    await update("status='sent',sent_at=?,provider_id=?", r, sentAt, messageId);
    // The full version is the meeting invitation: "send invitations" later
    // must not send it again. A pending invitation is marked as sent too.
    if (version === "full")
      await env.DB.prepare(
        `INSERT INTO meeting_invitations(meeting_id,user_id,status,attempted_at,sent_at,provider_id)
        VALUES(?1,?2,'sent',?3,?3,?4) ON CONFLICT(meeting_id,user_id) DO UPDATE SET
          status='sent',attempted_at=excluded.attempted_at,sent_at=excluded.sent_at,provider_id=excluded.provider_id,error_code=NULL
        WHERE meeting_invitations.status IN ('queued','failed','skipped')`,
      )
        .bind(meeting.id, r.user_id, sentAt, messageId)
        .run();
    return true;
  };
  let sent = 0,
    failed = 0;
  for (let i = 0; i < recipients.length; i += sendConcurrency) {
    const results = await Promise.all(
      recipients.slice(i, i + sendConcurrency).map(sendOne),
    );
    sent += results.filter((ok) => ok === true).length;
    failed += results.filter((ok) => ok === false).length;
  }
  return { claimed: claimed.results.length, sent, failed };
}
// Runs from the mailer's 15-minute cron, after the reminders and the
// invitations. A large club is sent over a few runs.
export async function sendScheduledEmails(env: InvitationEnv, now: number) {
  await startDueEmails(env.DB, new Date(now).toISOString());
  let batches = 0,
    sent = 0,
    failed = 0;
  while (batches < scheduledEmailBatchesPerRun) {
    const result = await sendScheduledBatch(env);
    if (!result.claimed) break;
    batches++;
    sent += result.sent;
    failed += result.failed;
  }
  await env.DB.prepare(
    `UPDATE scheduled_emails SET status='done' WHERE status='sending' AND NOT EXISTS (
      SELECT 1 FROM scheduled_email_recipients r WHERE r.email_id=scheduled_emails.id AND r.status='queued')`,
  ).run();
  return { batches, sent, failed };
}
