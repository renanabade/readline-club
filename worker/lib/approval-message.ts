import { escapeHtml, invitationWhen } from "./meeting-invitation";
import { nextMeetingWhere } from "./next-meeting";
export interface ApprovalContext {
  nextMeeting: {
    id: string;
    title: string;
    chapters: string;
    starts_at: string;
    book_title: string;
  } | null;
  currentBookTitle: string | null;
}
export async function approvalContext(
  db: D1Database,
  now = new Date(),
): Promise<ApprovalContext> {
  const nextMeeting = await db
    .prepare(
      "SELECT m.id,m.title,m.chapters,m.starts_at,b.title book_title FROM meetings m JOIN reading_cycles cy ON cy.id=m.cycle_id JOIN books b ON b.id=cy.book_id WHERE " +
        nextMeetingWhere +
        " ORDER BY m.starts_at LIMIT 1",
    )
    .bind(now.toISOString())
    .first<NonNullable<ApprovalContext["nextMeeting"]>>();
  const currentBookTitle = await db
    .prepare(
      "SELECT b.title FROM books b JOIN reading_cycles cy ON cy.book_id=b.id WHERE cy.is_current=1 AND b.status!='archived'",
    )
    .first<string>("title");
  return { nextMeeting, currentBookTitle };
}
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();
// The text part says the same as the HTML, link by link, for mail clients
// and readers that only show plain text.
export function approvalMessage(
  context: ApprovalContext,
  recipient: { email: string; name: string },
  env: { EMAIL_FROM: string; APP_ORIGIN: string },
): EmailMessageBuilder {
  const firstName = recipient.name.trim().split(/\s+/)[0] || "";
  const loginUrl = env.APP_ORIGIN + "/entrar";
  const communityUrl = env.APP_ORIGIN + "/comunidade";
  const meeting = context.nextMeeting;
  const meetingUrl = meeting
    ? env.APP_ORIGIN + "/encontros/" + encodeURIComponent(meeting.id)
    : env.APP_ORIGIN + "/agenda";
  const reading = meeting
    ? [meeting.book_title, meeting.chapters].filter(Boolean).map(oneLine)
    : context.currentBookTitle
      ? [oneLine(context.currentBookTitle)]
      : [];
  const when = meeting ? invitationWhen(meeting.starts_at) : "";
  const steps = [
    {
      title: "Entre no grupo do WhatsApp.",
      body: "Na página da comunidade, leia como o clube funciona e use o botão do grupo.",
    },
    {
      title: meeting
        ? "Confirme presença no próximo encontro."
        : "Confirme presença no próximo encontro, quando ele for marcado.",
      body: meeting
        ? "A página do encontro tem o botão de presença e os atalhos para a agenda."
        : "A agenda mostra os encontros marcados.",
      url: meetingUrl,
    },
    {
      title: "Mande uma pergunta.",
      body: "Leve ao grupo uma dúvida ou um exemplo da leitura: é assim que a conversa do encontro começa.",
    },
  ];
  const textSteps = steps
    .map(
      (s, i) => `${i + 1}. ${s.title} ${s.body}${s.url ? "\n   " + s.url : ""}`,
    )
    .join("\n");
  const textMeeting = meeting
    ? `Próximo encontro: ${oneLine(meeting.title)}\n${when} (horário de Brasília)\n${reading.length ? "Leitura: " + reading.join(" · ") + "\n" : ""}\n`
    : reading.length
      ? `Leitura atual: ${reading.join(" · ")}\n\n`
      : "";
  const htmlMeeting = meeting
    ? `<p><strong>Próximo encontro:</strong> ${escapeHtml(oneLine(meeting.title))}<br>${escapeHtml(when)} (horário de Brasília)${reading.length ? "<br><strong>Leitura:</strong> " + escapeHtml(reading.join(" · ")) : ""}</p>`
    : reading.length
      ? `<p><strong>Leitura atual:</strong> ${escapeHtml(reading.join(" · "))}</p>`
      : "";
  const htmlSteps = steps
    .map(
      (s) =>
        `<li style="margin-bottom:8px"><strong>${s.title}</strong> ${s.body}${s.url ? ` <a href="${escapeHtml(s.url)}">${escapeHtml(s.url)}</a>` : ""}</li>`,
    )
    .join("");
  return {
    from: { email: env.EMAIL_FROM, name: "readline club" },
    to: recipient.email,
    replyTo: env.EMAIL_FROM,
    subject: "Seu acesso ao readline club foi aprovado",
    text: `Olá${firstName ? ", " + firstName : ""}!\n\nSeu acesso ao readline club foi aprovado. Entre com o e-mail e a senha que você cadastrou: ${loginUrl}\n\n${textMeeting}Seus primeiros passos:\n${textSteps}\n\nAbrir a página da comunidade: ${communityUrl}\n\nreadline club — clube do livro de computação`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#202024;line-height:1.6"><p><strong>readline club</strong><br>clube do livro de computação</p><p>Olá${firstName ? ", " + escapeHtml(firstName) : ""}!</p><h1 style="font-size:26px">Seu acesso foi aprovado.</h1><p>Entre com o e-mail e a senha que você cadastrou: <a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a></p>${htmlMeeting}<p><strong>Seus primeiros passos:</strong></p><ol>${htmlSteps}</ol><p><a href="${escapeHtml(communityUrl)}" style="display:inline-block;padding:12px 20px;background:#202024;color:white;border-radius:8px;text-decoration:none">Abrir a página da comunidade</a></p><p style="font-size:13px">Se o botão não abrir: <a href="${escapeHtml(communityUrl)}">${escapeHtml(communityUrl)}</a></p></div>`,
  };
}
