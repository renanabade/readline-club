import type { Meeting } from "../../shared/contracts";
import { googleCalendarUrl } from "../../shared/calendar";
import { meetingToIcs } from "./calendar";
export interface InvitationEnv {
  DB: D1Database;
  EMAIL: SendEmail;
  EMAIL_FROM: string;
  APP_ORIGIN: string;
}
export const invitationBatchSize = 20;
// Each cron run sends at most this many batches, so a large club is invited
// over a few runs instead of one long run.
export const invitationBatchesPerRun = 5;
const sendConcurrency = 10;
// The mailer runs without nodejs_compat, so tokens use Web Crypto. The API
// checks them with the same SHA-256 hex digest used for sessions.
export async function rsvpToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = (b: Uint8Array) =>
    Array.from(b, (n) => n.toString(16).padStart(2, "0")).join("");
  const token = hex(bytes);
  const hash = hex(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
    ),
  );
  return { token, hash };
}
export const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ]!,
  );
export function invitationWhen(startsAt: string) {
  const date = new Date(startsAt);
  const day = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Sao_Paulo",
  }).format(date);
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
  return `${day}, às ${time}`;
}
export function invitationMessage(
  meeting: Meeting & { book_title: string; starts_at: string },
  recipient: { email: string; name: string },
  env: Pick<InvitationEnv, "EMAIL_FROM" | "APP_ORIGIN">,
  token: string,
): EmailMessageBuilder {
  const when = invitationWhen(meeting.starts_at);
  const title = meeting.title.replace(/\s+/g, " ");
  const firstName = recipient.name.trim().split(/\s+/)[0] || "";
  const confirmUrl =
    env.APP_ORIGIN + "/encontros/" + encodeURIComponent(meeting.id);
  // The token travels in the fragment, which browsers never send to servers.
  // Opening the page does not answer: link scanners open every link.
  const answerUrl = (answer: "sim" | "nao") =>
    env.APP_ORIGIN + "/presenca?resposta=" + answer + "#" + token;
  const yesUrl = answerUrl("sim"),
    noUrl = answerUrl("nao");
  const calendarUrl = googleCalendarUrl(meeting, env.APP_ORIGIN)!;
  const accountUrl = env.APP_ORIGIN + "/conta";
  const reading = [meeting.book_title, meeting.chapters]
    .filter(Boolean)
    .join(" · ");
  const button = (href: string, label: string, primary: boolean) =>
    `<a href="${escapeHtml(href)}" style="display:inline-block;margin:0 8px 8px 0;padding:12px 20px;border-radius:8px;text-decoration:none;${primary ? "background:#202024;color:white" : "border:1px solid #202024;color:#202024"}">${label}</a>`;
  return {
    from: { email: env.EMAIL_FROM, name: "readline club" },
    to: recipient.email,
    replyTo: env.EMAIL_FROM,
    subject: `${title} · ${when}`,
    text: `Olá${firstName ? ", " + firstName : ""}!\n\n${title}\n${when} (horário de Brasília), ${meeting.duration_minutes} minutos.\n${reading}\n\nVocê vai participar? Responda com um clique, sem precisar entrar na plataforma:\nVou participar: ${yesUrl}\nNão vou poder: ${noUrl}\n\nSe preferir, responda na página do encontro: ${confirmUrl}\n\nAdicionar ao Google Agenda: ${calendarUrl}\nPara Apple Calendar ou Outlook, abra o arquivo .ics anexado.\n\nO link da chamada fica na página do encontro, disponível para membros.\n\nVocê recebe este aviso por ser membro do readline club. Para não receber avisos de encontros, desative em Minha conta: ${accountUrl}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#202024;line-height:1.6"><p><strong>readline club</strong><br>clube do livro de computação</p><p>Olá${firstName ? ", " + escapeHtml(firstName) : ""}!</p><h1 style="font-size:26px">${escapeHtml(title)}</h1><p><strong>${escapeHtml(when)}</strong> (horário de Brasília), ${meeting.duration_minutes} minutos.<br>${escapeHtml(reading)}</p><p>Você vai participar? Responda com um clique, sem precisar entrar na plataforma.</p><p>${button(yesUrl, "Vou participar", true)}${button(noUrl, "Não vou poder", false)}</p><p>${button(calendarUrl, "Adicionar ao Google Agenda", false)}</p><p style="font-size:14px">Para Apple Calendar ou Outlook, abra o arquivo .ics anexado. O link da chamada fica na página do encontro, disponível para membros.</p><p style="font-size:13px">Se o botão não abrir, responda na página do encontro: <a href="${escapeHtml(confirmUrl)}">${escapeHtml(confirmUrl)}</a>. Os botões de resposta são pessoais: não encaminhe este e-mail.</p><p style="font-size:12px;color:#6b6b73">Você recebe este aviso por ser membro do readline club. Para não receber avisos de encontros, desative em <a href="${escapeHtml(accountUrl)}">Minha conta</a>.</p></div>`,
    attachments: [
      {
        disposition: "attachment",
        filename: "readline-encontro.ics",
        type: "text/calendar; charset=utf-8; method=PUBLISH",
        content: meetingToIcs(meeting, env.APP_ORIGIN),
      },
    ],
  };
}
export async function sendInvitationBatch(
  env: InvitationEnv,
  meetingId: string,
) {
  const meeting = await env.DB.prepare(
    "SELECT m.*,b.title book_title FROM meetings m JOIN reading_cycles cy ON cy.id=m.cycle_id JOIN books b ON b.id=cy.book_id WHERE m.id=?",
  )
    .bind(meetingId)
    .first<Meeting & { book_title: string }>();
  if (
    !meeting?.starts_at ||
    meeting.status !== "scheduled" ||
    Date.parse(meeting.starts_at) <= Date.now()
  ) {
    // The meeting passed or was cancelled: drop what is still queued, so the
    // cron stops picking it up.
    await env.DB.prepare(
      "UPDATE meeting_invitations SET status='skipped' WHERE meeting_id=? AND status='queued'",
    )
      .bind(meetingId)
      .run();
    return { status: "ineligible" as const };
  }
  const startsAt = meeting.starts_at;
  // Claim a batch atomically: concurrent calls get disjoint rows, so nobody
  // receives the same invitation twice.
  const claimed = await env.DB.prepare(
    `UPDATE meeting_invitations SET status='sending',attempted_at=?,error_code=NULL
    WHERE meeting_id=? AND status='queued' AND user_id IN (
      SELECT user_id FROM meeting_invitations WHERE meeting_id=? AND status='queued' LIMIT ?
    ) RETURNING user_id`,
  )
    .bind(new Date().toISOString(), meetingId, meetingId, invitationBatchSize)
    .all<{ user_id: string }>();
  const ids = claimed.results.map((r) => r.user_id);
  // Eligibility is checked again at send time: a member may have been
  // suspended or turned meeting emails off after the invitation was queued.
  const recipients = ids.length
    ? (
        await env.DB.prepare(
          `SELECT u.id,u.email,u.name FROM users u JOIN applications a ON a.email=u.email
          WHERE u.id IN (SELECT value FROM json_each(?)) AND a.status='approved' AND u.role='member' AND u.meeting_emails=1`,
        )
          .bind(JSON.stringify(ids))
          .all<{ id: string; email: string; name: string }>()
      ).results
    : [];
  const eligible = new Set(recipients.map((r) => r.id));
  const skipped = ids.filter((id) => !eligible.has(id));
  if (skipped.length)
    await env.DB.prepare(
      "UPDATE meeting_invitations SET status='skipped' WHERE meeting_id=? AND user_id IN (SELECT value FROM json_each(?))",
    )
      .bind(meetingId, JSON.stringify(skipped))
      .run();
  const sendOne = async (recipient: (typeof recipients)[number]) => {
    let messageId: string;
    // Stored before sending, so a link that reaches the inbox always works.
    const { token, hash } = await rsvpToken();
    await env.DB.prepare(
      "UPDATE meeting_invitations SET rsvp_token_hash=? WHERE meeting_id=? AND user_id=?",
    )
      .bind(hash, meetingId, recipient.id)
      .run();
    try {
      const result = await env.EMAIL.send(
        invitationMessage(
          { ...meeting, starts_at: startsAt },
          recipient,
          env,
          token,
        ),
      );
      messageId = result.messageId;
      if (!messageId) throw new Error("missing_confirmation");
    } catch (error) {
      const code = (error as { code?: unknown })?.code;
      const known = typeof code === "string" && /^E_[A-Z_]+$/.test(code);
      // Unknown outcomes stay locked as 'sending': the email may have gone out.
      await env.DB.prepare(
        "UPDATE meeting_invitations SET status=?,error_code=? WHERE meeting_id=? AND user_id=?",
      )
        .bind(
          known ? "failed" : "sending",
          known ? code : "UNKNOWN",
          meetingId,
          recipient.id,
        )
        .run();
      return false;
    }
    await env.DB.prepare(
      "UPDATE meeting_invitations SET status='sent',sent_at=?,provider_id=? WHERE meeting_id=? AND user_id=?",
    )
      .bind(new Date().toISOString(), messageId, meetingId, recipient.id)
      .run();
    return true;
  };
  // A few sends at a time: each one waits on the provider, so sending them
  // one by one made a batch take about a minute.
  let sent = 0,
    failed = 0;
  for (let i = 0; i < recipients.length; i += sendConcurrency) {
    const results = await Promise.all(
      recipients.slice(i, i + sendConcurrency).map(sendOne),
    );
    sent += results.filter(Boolean).length;
    failed += results.filter((ok) => !ok).length;
  }
  const remaining =
    (await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM meeting_invitations WHERE meeting_id=? AND status='queued'",
    )
      .bind(meetingId)
      .first<number>("total")) ?? 0;
  return {
    status: "processed" as const,
    sent,
    failed,
    skipped: skipped.length,
    remaining,
  };
}
// Runs from the mailer's cron, so the organizer can close the page after
// queueing. Each batch moves rows out of 'queued', so the loop always ends.
export async function drainInvitations(env: InvitationEnv) {
  let batches = 0,
    sent = 0,
    failed = 0;
  while (batches < invitationBatchesPerRun) {
    const meeting = await env.DB.prepare(
      "SELECT meeting_id FROM meeting_invitations WHERE status='queued' LIMIT 1",
    ).first<string>("meeting_id");
    if (!meeting) break;
    const result = await sendInvitationBatch(env, meeting);
    batches++;
    if (result.status === "processed") {
      sent += result.sent;
      failed += result.failed;
    }
  }
  return { batches, sent, failed };
}
