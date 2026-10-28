import { escapeHtml, rsvpToken } from "./meeting-invitation";
interface VerificationEnv {
  DB: D1Database;
  EMAIL: SendEmail;
  EMAIL_FROM: string;
  APP_ORIGIN: string;
}
export const verificationLifetime = 7 * 86400000;
export type VerificationStatus =
  "sent" | "failed" | "sending" | "ineligible" | "throttled";
export function verificationMessage(
  recipient: { email: string; name: string },
  env: Pick<VerificationEnv, "EMAIL_FROM" | "APP_ORIGIN">,
  token: string,
): EmailMessageBuilder {
  const firstName = recipient.name.trim().split(/\s+/)[0] || "";
  // The token travels in the fragment, which browsers never send to servers.
  const url = env.APP_ORIGIN + "/confirmar-email#" + token;
  return {
    from: { email: env.EMAIL_FROM, name: "readline club" },
    to: recipient.email,
    replyTo: env.EMAIL_FROM,
    subject: "Confirme seu e-mail no readline club",
    text: `Olá${firstName ? ", " + firstName : ""}!\n\nRecebemos seu cadastro no readline club. Confirme que este e-mail é seu: ${url}\n\nSeu acesso ao clube já está liberado. Confirmar o e-mail libera também os grupos do WhatsApp e do Discord, as gravações e os resumos dos encontros. O link vale por 7 dias.\n\nSe você não se cadastrou, ignore este e-mail.\n\nreadline club — clube do livro de computação`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#202024;line-height:1.6"><p><strong>readline club</strong><br>clube do livro de computação</p><p>Olá${firstName ? ", " + escapeHtml(firstName) : ""}!</p><h1 style="font-size:26px">Confirme seu e-mail.</h1><p>Recebemos seu cadastro no readline club. Confirme que este e-mail é seu.</p><p><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 20px;background:#202024;color:white;border-radius:8px;text-decoration:none">Confirmar e-mail</a></p><p>Seu acesso ao clube já está liberado. Confirmar o e-mail libera também os grupos do WhatsApp e do Discord, as gravações e os resumos dos encontros. O link vale por 7 dias.</p><p>Se você não se cadastrou, ignore este e-mail.</p><p style="font-size:13px">Se o botão não abrir: <a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p></div>`,
  };
}
export async function sendEmailVerification(
  env: VerificationEnv,
  userId: string,
  now = Date.now(),
): Promise<VerificationStatus> {
  const account = await env.DB.prepare(
    "SELECT u.email,u.name FROM users u JOIN applications a ON a.email=u.email WHERE u.id=? AND u.role='member' AND a.email_verified_at IS NULL",
  )
    .bind(userId)
    .first<{ email: string; name: string }>();
  if (!account) return "ineligible";
  const { token, hash } = await rsvpToken();
  const iso = (ms: number) => new Date(ms).toISOString();
  // Claimed in D1 before sending, with the new token: only the newest link
  // works. One send per minute. An unknown outcome stays locked longer, but
  // not forever: the person asked for the link, and a repeated one is harmless.
  const claim = await env.DB.prepare(
    `INSERT INTO email_verifications(user_id,token_hash,expires_at,status,attempted_at)
    VALUES(?,?,?,'sending',?) ON CONFLICT(user_id) DO UPDATE SET
      token_hash=excluded.token_hash,expires_at=excluded.expires_at,status='sending',
      attempted_at=excluded.attempted_at,sent_at=NULL,provider_id=NULL,error_code=NULL
    WHERE email_verifications.attempted_at < CASE WHEN email_verifications.status='sending' THEN ? ELSE ? END
    RETURNING user_id`,
  )
    .bind(
      userId,
      hash,
      now + verificationLifetime,
      iso(now),
      iso(now - 15 * 60000),
      iso(now - 60000),
    )
    .first();
  if (!claim) return "throttled";
  let providerId: string;
  try {
    const result = await env.EMAIL.send(
      verificationMessage(account, env, token),
    );
    providerId = result.messageId;
    if (!providerId) throw new Error("missing_confirmation");
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    const known = typeof code === "string" && /^E_[A-Z_]+$/.test(code);
    await env.DB.prepare(
      "UPDATE email_verifications SET status=?,error_code=? WHERE user_id=?",
    )
      .bind(known ? "failed" : "sending", known ? code : "UNKNOWN", userId)
      .run();
    return known ? "failed" : "sending";
  }
  await env.DB.prepare(
    "UPDATE email_verifications SET status='sent',sent_at=?,provider_id=? WHERE user_id=?",
  )
    .bind(new Date().toISOString(), providerId, userId)
    .run();
  return "sent";
}
