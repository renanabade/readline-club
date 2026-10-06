interface DigestEnv {
  DB: D1Database;
  EMAIL: SendEmail;
  EMAIL_FROM: string;
  ADMIN_NOTIFY_EMAIL?: string;
  APP_ORIGIN: string;
}

export async function sendPendingDigest(env: DigestEnv, scheduledTime: number) {
  const time = new Date(scheduledTime);
  // Brasília is UTC-3: 12:00 and 21:00 UTC correspond to 09:00 and 18:00.
  if (![12, 21].includes(time.getUTCHours()) || time.getUTCMinutes() !== 0)
    return "outside_schedule";
  if (!env.ADMIN_NOTIFY_EMAIL)
    throw new Error("admin_digest_recipient_missing");
  const count =
    (await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM applications a JOIN users u ON u.email=a.email WHERE a.status='pending' AND u.role='member'",
    ).first<number>("total")) ?? 0;
  if (!count) return "empty";
  const slot = time.toISOString().slice(0, 13);
  const claim = await env.DB.prepare(
    `INSERT INTO admin_digest_notifications(slot,status,pending_count,attempted_at)
    VALUES(?,'sending',?,?) ON CONFLICT(slot) DO UPDATE SET status='sending',attempts=attempts+1,pending_count=excluded.pending_count,attempted_at=excluded.attempted_at,error_code=NULL
    WHERE admin_digest_notifications.status='failed' AND admin_digest_notifications.attempts<3 RETURNING slot`,
  )
    .bind(slot, count, new Date().toISOString())
    .first();
  if (!claim) return "already_attempted";
  let messageId: string;
  try {
    const label =
      count === 1 ? "1 cadastro pendente" : `${count} cadastros pendentes`;
    const url = env.APP_ORIGIN + "/admin";
    const result = await env.EMAIL.send({
      from: { email: env.EMAIL_FROM, name: "readline club" },
      to: env.ADMIN_NOTIFY_EMAIL,
      subject: `readline club: ${label} para aprovar`,
      text: `Há ${label} no readline club.\n\nAbra a administração para revisar as inscrições e aceitar os novos integrantes: ${url}\n\nVocê pode usar “Aceitar todos” para aprovar os cadastros pendentes de uma vez.\n\nEste resumo é enviado às 9h e às 18h, no horário de Brasília, somente quando há pessoas aguardando aprovação.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#202024;line-height:1.6"><p><strong>readline club</strong></p><h1 style="font-size:26px">${label} para aprovar.</h1><p>Abra a administração para revisar as inscrições e aceitar os novos integrantes. Você também pode usar <strong>Aceitar todos</strong>.</p><p><a href="${url}" style="display:inline-block;padding:12px 20px;background:#202024;color:white;border-radius:8px;text-decoration:none">Revisar cadastros</a></p><p style="font-size:13px">Resumo às 9h e às 18h (Brasília), somente quando há pendências.</p></div>`,
    });
    messageId = result.messageId;
    if (!messageId) throw new Error("missing_confirmation");
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    const known = typeof code === "string" && /^E_[A-Z_]+$/.test(code);
    await env.DB.prepare(
      "UPDATE admin_digest_notifications SET status=?,error_code=? WHERE slot=?",
    )
      .bind(known ? "failed" : "sending", known ? code : "UNKNOWN", slot)
      .run();
    // Avoid recipient/provider details in logs. Unknown outcomes remain locked.
    throw new Error("admin_digest_failed");
  }
  await env.DB.prepare(
    "UPDATE admin_digest_notifications SET status='sent',sent_at=?,provider_id=? WHERE slot=?",
  )
    .bind(new Date().toISOString(), messageId, slot)
    .run();
  return "sent";
}
