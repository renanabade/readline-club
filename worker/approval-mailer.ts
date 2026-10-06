import { sendPendingDigest } from "./lib/admin-digest";
interface MailerEnv {
  DB: D1Database;
  EMAIL: SendEmail;
  EMAIL_FROM: string;
  APP_ORIGIN: string;
  ADMIN_NOTIFY_EMAIL?: string;
}

export default {
  async scheduled(controller: ScheduledController, env: MailerEnv) {
    const status = await sendPendingDigest(env, controller.scheduledTime);
    console.log(JSON.stringify({ event: "admin_digest", status }));
  },
  async fetch(request: Request, env: MailerEnv): Promise<Response> {
    if (request.method !== "POST") return new Response(null, { status: 405 });
    const body = (await request.json().catch(() => null)) as {
      applicationId?: unknown;
    } | null;
    if (
      typeof body?.applicationId !== "string" ||
      body.applicationId.length > 100
    )
      return new Response(null, { status: 400 });
    const id = body.applicationId;
    const member = await env.DB.prepare(
      "SELECT email FROM applications WHERE id=? AND status='approved'",
    )
      .bind(id)
      .first<{ email: string }>();
    if (!member)
      return Response.json(
        {
          emailStatus: "ineligible",
          message: "A conta precisa estar aprovada para receber o aviso.",
        },
        { status: 409 },
      );

    // Claim once in D1 before sending. Concurrent requests and repeated approvals
    // cannot send the same welcome message twice. Only explicit failures retry.
    const claim = await env.DB.prepare(
      `INSERT INTO approval_notifications(application_id,status,attempted_at)
      VALUES(?,'sending',?) ON CONFLICT(application_id) DO UPDATE SET status='sending',attempted_at=excluded.attempted_at,error_code=NULL
      WHERE approval_notifications.status='failed' AND approval_notifications.attempted_at < ?
      RETURNING application_id`,
    )
      .bind(
        id,
        new Date().toISOString(),
        new Date(Date.now() - 60_000).toISOString(),
      )
      .first();
    if (!claim) {
      const existing = await env.DB.prepare(
        "SELECT status FROM approval_notifications WHERE application_id=?",
      )
        .bind(id)
        .first<{ status: string }>();
      return Response.json({
        emailStatus: existing?.status ?? "unavailable",
        message:
          existing?.status === "sent"
            ? "Esse aviso já foi enviado."
            : "Há uma tentativa em andamento ou recente. Aguarde antes de tentar novamente.",
      });
    }
    let providerId: string;
    try {
      const url = env.APP_ORIGIN + "/entrar";
      const result = await env.EMAIL.send({
        from: { email: env.EMAIL_FROM, name: "readline club" },
        to: member.email,
        replyTo: env.EMAIL_FROM,
        subject: "Seu acesso ao readline club foi aprovado",
        text: `Seu acesso ao readline club foi aprovado!\n\nEntre com o e-mail e a senha que você cadastrou: ${url}\n\nNa plataforma você encontra a leitura atual, os encontros e as gravações disponíveis. Sua conta aprovada também libera o grupo do WhatsApp. Após fazer login, clique em Entrar no grupo do WhatsApp na página inicial, em O clube ou em Minha conta.\n\nreadline club — clube do livro de computação`,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#202024;line-height:1.6"><p><strong>readline club</strong><br>clube do livro de computação</p><h1 style="font-size:26px">Seu acesso foi aprovado.</h1><p>Entre com o e-mail e a senha que você cadastrou.</p><p><a href="${url}" style="display:inline-block;padding:12px 20px;background:#202024;color:white;border-radius:8px;text-decoration:none">Entrar no clube</a></p><p>Na plataforma você encontra a leitura atual, os encontros e as gravações disponíveis. Sua conta aprovada também libera o grupo do WhatsApp. Após fazer login, clique em Entrar no grupo do WhatsApp na página inicial, em O clube ou em Minha conta.</p><p style="font-size:13px">Se o botão não abrir: <a href="${url}">${url}</a></p></div>`,
      });
      providerId = result.messageId;
      if (!providerId) throw new Error("Missing provider confirmation");
    } catch (error) {
      const code = (error as { code?: unknown })?.code;
      const safeCode =
        typeof code === "string" && /^E_[A-Z_]+$/.test(code) ? code : "UNKNOWN";
      // Unknown outcomes stay locked: an interrupted response may already have
      // delivered the email, so blindly retrying could duplicate it.
      await env.DB.prepare(
        "UPDATE approval_notifications SET status=?,error_code=? WHERE application_id=?",
      )
        .bind(safeCode === "UNKNOWN" ? "sending" : "failed", safeCode, id)
        .run();
      return Response.json({
        emailStatus: safeCode === "UNKNOWN" ? "sending" : "failed",
        message:
          "A conta está aprovada, mas não foi possível confirmar o envio do aviso.",
      });
    }
    // Do not classify a DB failure after a successful send as a delivery failure.
    await env.DB.prepare(
      "UPDATE approval_notifications SET status='sent',sent_at=?,provider_id=? WHERE application_id=?",
    )
      .bind(new Date().toISOString(), providerId, id)
      .run();
    return Response.json({
      emailStatus: "sent",
      message: "Acesso aprovado. Aviso aceito pelo serviço de e-mail.",
    });
  },
};
