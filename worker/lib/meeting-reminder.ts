import type { Meeting } from "../../shared/contracts";
import {
  escapeHtml,
  invitationWhen,
  rsvpToken,
  type InvitationEnv,
} from "./meeting-invitation";
import { emailConfirmedSql } from "./email-gate";
export type ReminderKind = "d1" | "h1";
const minute = 60_000;
// How long before the meeting each reminder goes out. The windows are as
// wide as the 15-minute cron needs to hit every meeting at least once.
export const reminderWindows: Record<ReminderKind, [number, number]> = {
  d1: [23 * 60 * minute, 24 * 60 * minute],
  h1: [45 * minute, 75 * minute],
};
export const reminderBatchSize = 20;
export const reminderBatchesPerRun = 5;
const sendConcurrency = 10;
type ReminderMeeting = Meeting & { book_title: string; starts_at: string };
export function reminderMessage(
  kind: ReminderKind,
  meeting: ReminderMeeting,
  recipient: { email: string; name: string },
  env: Pick<InvitationEnv, "EMAIL_FROM" | "APP_ORIGIN">,
  token: string,
): EmailMessageBuilder {
  const when = invitationWhen(meeting.starts_at);
  const title = meeting.title.replace(/\s+/g, " ");
  const firstName = recipient.name.trim().split(/\s+/)[0] || "";
  const pageUrl =
    env.APP_ORIGIN + "/encontros/" + encodeURIComponent(meeting.id);
  // Same personal links as the invitation: the token goes in the fragment and
  // opening the page answers nothing.
  const answerUrl = (answer: "sim" | "nao") =>
    env.APP_ORIGIN + "/presenca?resposta=" + answer + "#" + token;
  const yesUrl = answerUrl("sim"),
    noUrl = answerUrl("nao");
  const accountUrl = env.APP_ORIGIN + "/conta";
  const reading = [meeting.book_title, meeting.chapters]
    .filter(Boolean)
    .join(" · ");
  const lead =
    kind === "d1"
      ? "Lembrete: o encontro é amanhã."
      : "O encontro começa em cerca de 1 hora.";
  const button = (href: string, label: string, primary: boolean) =>
    `<a href="${escapeHtml(href)}" style="display:inline-block;margin:0 8px 8px 0;padding:12px 20px;border-radius:8px;text-decoration:none;${primary ? "background:#202024;color:white" : "border:1px solid #202024;color:#202024"}">${label}</a>`;
  return {
    from: { email: env.EMAIL_FROM, name: "readline club" },
    to: recipient.email,
    replyTo: env.EMAIL_FROM,
    subject: `${kind === "d1" ? "Amanhã" : "Em 1 hora"}: ${title} · ${when}`,
    text: `Olá${firstName ? ", " + firstName : ""}!\n\n${lead}\n\n${title}\n${when} (horário de Brasília), ${meeting.duration_minutes} minutos.\n${reading}\n\nO link da chamada fica na página do encontro, disponível para membros: ${pageUrl}\n\nAinda dá para responder ou mudar a presença com um clique, sem entrar na plataforma:\nVou participar: ${yesUrl}\nNão vou poder: ${noUrl}\n\nVocê recebe este aviso por ser membro do readline club. Para não receber avisos de encontros, desative em Minha conta: ${accountUrl}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#202024;line-height:1.6"><p><strong>readline club</strong><br>clube do livro de computação</p><p>Olá${firstName ? ", " + escapeHtml(firstName) : ""}!</p><p>${lead}</p><h1 style="font-size:26px">${escapeHtml(title)}</h1><p><strong>${escapeHtml(when)}</strong> (horário de Brasília), ${meeting.duration_minutes} minutos.<br>${escapeHtml(reading)}</p><p>${button(pageUrl, "Abrir a página do encontro", true)}</p><p style="font-size:14px">O link da chamada fica na página do encontro, disponível para membros.</p><p>Ainda dá para responder ou mudar a presença com um clique, sem entrar na plataforma.</p><p>${button(yesUrl, "Vou participar", false)}${button(noUrl, "Não vou poder", false)}</p><p style="font-size:13px">Se o botão não abrir: <a href="${escapeHtml(pageUrl)}">${escapeHtml(pageUrl)}</a>. Os botões de resposta são pessoais: não encaminhe este e-mail.</p><p style="font-size:12px;color:#6b6b73">Você recebe este aviso por ser membro do readline club. Para não receber avisos de encontros, desative em <a href="${escapeHtml(accountUrl)}">Minha conta</a>.</p></div>`,
  };
}
// Claims a batch atomically: the UNIQUE(meeting_id,user_id,kind) row is the
// claim, so overlapping runs never send the same reminder twice. Members who
// said no are left out. Known failures from an earlier run get another try
// while the window lasts; unknown outcomes stay locked as 'sending'.
async function sendReminderBatch(
  env: InvitationEnv,
  kind: ReminderKind,
  meeting: ReminderMeeting,
  runStartedAt: string,
) {
  const claimed = await env.DB.prepare(
    `INSERT INTO meeting_reminders(meeting_id,user_id,kind,attempted_at)
    SELECT ?1,u.id,?2,?3 FROM users u JOIN applications a ON a.email=u.email
    WHERE a.status='approved' AND u.role='member' AND u.meeting_emails=1 AND ${emailConfirmedSql}
      AND NOT EXISTS (SELECT 1 FROM meeting_rsvps r WHERE r.meeting_id=?1 AND r.user_id=u.id AND r.response='no')
      AND NOT EXISTS (SELECT 1 FROM meeting_reminders x WHERE x.meeting_id=?1 AND x.user_id=u.id AND x.kind=?2
        AND (x.status!='failed' OR x.attempted_at>=?3))
    LIMIT ?4
    ON CONFLICT(meeting_id,user_id,kind) DO UPDATE SET status='sending',attempted_at=excluded.attempted_at,error_code=NULL
    WHERE meeting_reminders.status='failed' AND meeting_reminders.attempted_at<excluded.attempted_at
    RETURNING user_id`,
  )
    .bind(meeting.id, kind, runStartedAt, reminderBatchSize)
    .all<{ user_id: string }>();
  const ids = claimed.results.map((r) => r.user_id);
  if (!ids.length) return { claimed: 0, sent: 0, failed: 0 };
  const recipients = (
    await env.DB.prepare(
      "SELECT id,email,name FROM users WHERE id IN (SELECT value FROM json_each(?))",
    )
      .bind(JSON.stringify(ids))
      .all<{ id: string; email: string; name: string }>()
  ).results;
  const sendOne = async (recipient: (typeof recipients)[number]) => {
    let messageId: string;
    // Stored before sending, so a link that reaches the inbox always works.
    const { token, hash } = await rsvpToken();
    await env.DB.prepare(
      "UPDATE meeting_reminders SET rsvp_token_hash=? WHERE meeting_id=? AND user_id=? AND kind=?",
    )
      .bind(hash, meeting.id, recipient.id, kind)
      .run();
    try {
      const result = await env.EMAIL.send(
        reminderMessage(kind, meeting, recipient, env, token),
      );
      messageId = result.messageId;
      if (!messageId) throw new Error("missing_confirmation");
    } catch (error) {
      const code = (error as { code?: unknown })?.code;
      const known = typeof code === "string" && /^E_[A-Z_]+$/.test(code);
      await env.DB.prepare(
        "UPDATE meeting_reminders SET status=?,error_code=? WHERE meeting_id=? AND user_id=? AND kind=?",
      )
        .bind(
          known ? "failed" : "sending",
          known ? code : "UNKNOWN",
          meeting.id,
          recipient.id,
          kind,
        )
        .run();
      return false;
    }
    await env.DB.prepare(
      "UPDATE meeting_reminders SET status='sent',sent_at=?,provider_id=? WHERE meeting_id=? AND user_id=? AND kind=?",
    )
      .bind(new Date().toISOString(), messageId, meeting.id, recipient.id, kind)
      .run();
    return true;
  };
  let sent = 0,
    failed = 0;
  for (let i = 0; i < recipients.length; i += sendConcurrency) {
    const results = await Promise.all(
      recipients.slice(i, i + sendConcurrency).map(sendOne),
    );
    sent += results.filter(Boolean).length;
    failed += results.filter((ok) => !ok).length;
  }
  return { claimed: ids.length, sent, failed };
}
// Runs from the mailer's 15-minute cron. `now` is the scheduled time, so a
// late run still checks the windows of its own tick.
export async function sendReminders(env: InvitationEnv, now: number) {
  const meetings = (
    await env.DB.prepare(
      "SELECT m.*,b.title book_title FROM meetings m JOIN reading_cycles cy ON cy.id=m.cycle_id JOIN books b ON b.id=cy.book_id WHERE m.status='scheduled' AND m.starts_at IS NOT NULL",
    ).all<ReminderMeeting>()
  ).results;
  const due: [ReminderKind, ReminderMeeting][] = [];
  for (const meeting of meetings) {
    const ahead = Date.parse(meeting.starts_at) - now;
    for (const kind of ["d1", "h1"] as const) {
      const [from, to] = reminderWindows[kind];
      if (ahead > from && ahead <= to) due.push([kind, meeting]);
    }
  }
  const runStartedAt = new Date().toISOString();
  let batches = 0,
    sent = 0,
    failed = 0;
  for (const [kind, meeting] of due)
    while (batches < reminderBatchesPerRun) {
      const result = await sendReminderBatch(env, kind, meeting, runStartedAt);
      if (!result.claimed) break;
      batches++;
      sent += result.sent;
      failed += result.failed;
    }
  return { batches, sent, failed };
}
