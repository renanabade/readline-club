import { escapeHtml, rsvpToken } from "./meeting-invitation";
interface ResetEnv {
  DB: D1Database;
  EMAIL: SendEmail;
  EMAIL_FROM: string;
  APP_ORIGIN: string;
}
// Same lifetime as the links generated in the panel.
export const resetLifetime = 30 * 60000;
export type ResetEmailStatus =
  "sent" | "failed" | "sending" | "ineligible" | "throttled";
export function resetMessage(
  recipient: { email: string; name: string },
  env: Pick<ResetEnv, "EMAIL_FROM" | "APP_ORIGIN">,
  token: string,
): EmailMessageBuilder {
  const firstName = recipient.name.trim().split(/\s+/)[0] || "";
  // The token travels in the fragment, which browsers never send to servers.
  const url = env.APP_ORIGIN + "/redefinir-senha#" + token;
  return {
    from: { email: env.EMAIL_FROM, name: "readline club" },
    to: recipient.email,
    replyTo: env.EMAIL_FROM,
    subject: "Redefina sua senha do readline club",
    text: `Olá${firstName ? ", " + firstName : ""}!\n\nRecebemos um pedido para criar uma nova senha na sua conta do readline club. Para escolher a nova senha, abra: ${url}\n\nO link vale por 30 minutos e só pode ser usado uma vez. Ao trocar a senha, as sessões abertas na sua conta são encerradas.\n\nSe não foi você, ignore este e-mail: sua senha continua a mesma.\n\nreadline club — clube do livro de computação`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#202024;line-height:1.6"><p><strong>readline club</strong><br>clube do livro de computação</p><p>Olá${firstName ? ", " + escapeHtml(firstName) : ""}!</p><h1 style="font-size:26px">Redefina sua senha.</h1><p>Recebemos um pedido para criar uma nova senha na sua conta do readline club.</p><p><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 20px;background:#202024;color:white;border-radius:8px;text-decoration:none">Escolher nova senha</a></p><p>O link vale por 30 minutos e só pode ser usado uma vez. Ao trocar a senha, as sessões abertas na sua conta são encerradas.</p><p>Se não foi você, ignore este e-mail: sua senha continua a mesma.</p><p style="font-size:13px">Se o botão não abrir: <a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p></div>`,
  };
}
export async function sendPasswordReset(
  env: ResetEnv,
  userId: string,
  now = Date.now(),
): Promise<ResetEmailStatus> {
  // Members only: the administrator account never gets a reset by email.
  const account = await env.DB.prepare(
    "SELECT email,name FROM users WHERE id=? AND role='member'",
  )
    .bind(userId)
    .first<{ email: string; name: string }>();
  if (!account) return "ineligible";
  const iso = (ms: number) => new Date(ms).toISOString();
  // One email per minute per account. An unknown outcome stays locked for
  // 15 minutes, not forever: a repeated link is harmless, because each new
  // one replaces the previous.
  const claim = await env.DB.prepare(
    `INSERT INTO password_reset_emails(user_id,status,attempted_at) VALUES(?,'sending',?)
    ON CONFLICT(user_id) DO UPDATE SET status='sending',attempted_at=excluded.attempted_at,
      sent_at=NULL,provider_id=NULL,error_code=NULL
    WHERE password_reset_emails.attempted_at < CASE WHEN password_reset_emails.status='sending' THEN ? ELSE ? END
    RETURNING user_id`,
  )
    .bind(userId, iso(now), iso(now - 15 * 60000), iso(now - 60000))
    .first();
  if (!claim) return "throttled";
  // Stored before sending, so a link that reaches the inbox always works.
  const { token, hash } = await rsvpToken();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM password_resets WHERE user_id=?").bind(userId),
    env.DB.prepare(
      "INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES(?,?,?)",
    ).bind(hash, userId, now + resetLifetime),
  ]);
  let providerId: string;
  try {
    const result = await env.EMAIL.send(resetMessage(account, env, token));
    providerId = result.messageId;
    if (!providerId) throw new Error("missing_confirmation");
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    const known = typeof code === "string" && /^E_[A-Z_]+$/.test(code);
    await env.DB.prepare(
      "UPDATE password_reset_emails SET status=?,error_code=? WHERE user_id=?",
    )
      .bind(known ? "failed" : "sending", known ? code : "UNKNOWN", userId)
      .run();
    return known ? "failed" : "sending";
  }
  await env.DB.prepare(
    "UPDATE password_reset_emails SET status='sent',sent_at=?,provider_id=? WHERE user_id=?",
  )
    .bind(new Date().toISOString(), providerId, userId)
    .run();
  return "sent";
}
