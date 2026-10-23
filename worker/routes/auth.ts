import { Hono } from "hono";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../env";
import { input } from "../errors";
import {
  signupSchema,
  emailSchema,
  passwordSchema,
  preferencesSchema,
  profileSchema,
} from "../../shared/validation";
import {
  hashPassword,
  verifyPassword,
  digest,
  randomToken,
} from "../auth/password";
import { startSession, endSession, getIdentity } from "../auth/sessions";
import { requireUser } from "../auth/guards";
import { rateLimit } from "../auth/limits";
import { requestAccountEmail } from "../lib/account-email";
const auth = new Hono<AppEnv>();
export const expireDepartures = (db: D1Database, now = new Date()) =>
  db
    .prepare("DELETE FROM member_departures WHERE left_at<?")
    .bind(new Date(now.getTime() - 30 * 86400000).toISOString());
auth.post("/register", async (c) => {
  const data = await input(c, signupSchema);
  await rateLimit(c, "signup", 10);
  if (!c.env.TURNSTILE_SECRET)
    throw new HTTPException(503, {
      message:
        "As inscrições estão sendo preparadas. Tente novamente em breve.",
    });
  let valid = false;
  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          secret: c.env.TURNSTILE_SECRET,
          response: data.turnstileToken,
          remoteip: c.req.header("cf-connecting-ip"),
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    const result = (await response.json()) as {
      success?: boolean;
      hostname?: string;
      action?: string;
    };
    valid =
      response.ok &&
      result.success === true &&
      result.hostname === new URL(c.env.APP_ORIGIN).hostname &&
      result.action === "signup";
  } catch {
    throw new HTTPException(503, {
      message: "Não foi possível verificar a inscrição. Tente novamente.",
    });
  }
  if (!valid)
    throw new HTTPException(400, {
      message: "Refaça a verificação de segurança.",
    });
  const existing = await c.env.DB.prepare("SELECT id FROM users WHERE email=?")
    .bind(data.email)
    .first();
  if (existing)
    return c.json(
      { ok: true, message: "Se você já tem cadastro, entre com sua senha." },
      201,
    );
  // Never bootstrap an administrator from an unverified public signup.
  if (c.env.ADMIN_EMAIL && data.email === c.env.ADMIN_EMAIL.toLowerCase())
    throw new HTTPException(409, {
      message:
        "Este endereço está reservado. Entre com o acesso fornecido pelo organizador.",
    });
  const id = crypto.randomUUID(),
    hash = hashPassword(data.password);
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(
        "INSERT INTO users(id,email,name,password_hash) VALUES(?,?,?,?)",
      ).bind(id, data.email, data.name, hash),
      c.env.DB.prepare(
        "INSERT INTO applications(id,email,name,phone,experience,motivation) VALUES(?,?,?,?,?,?)",
      ).bind(
        id,
        data.email,
        data.name,
        data.phone,
        data.experience,
        data.motivation,
      ),
    ]);
  } catch (err) {
    const duplicate = await c.env.DB.prepare(
      "SELECT id FROM users WHERE email=?",
    )
      .bind(data.email)
      .first();
    if (!duplicate) throw err;
    // A concurrent signup created the account: the link is its to send.
    return c.json(
      {
        ok: true,
        message: "Cadastro recebido. Entre para acompanhar sua aprovação.",
      },
      201,
    );
  }
  // The signup stands even if the link cannot go out now: it can be sent
  // again from the status page.
  await requestAccountEmail(c.env, "/email-verification", { userId: id });
  return c.json(
    {
      ok: true,
      message:
        "Cadastro recebido. Enviamos um link para confirmar seu e-mail. Entre para acompanhar sua aprovação.",
    },
    201,
  );
});
auth.get("/email-verification", requireUser, async (c) => {
  const verifiedAt = await c.env.DB.prepare(
    "SELECT email_verified_at FROM applications WHERE email=?",
  )
    .bind(c.get("identity").email)
    .first<string | null>("email_verified_at");
  return c.json({ verified: !!verifiedAt });
});
auth.post("/email-verification", requireUser, async (c) => {
  await rateLimit(c, "verify-resend", 5, c.get("identity").userId);
  const status = await requestAccountEmail(c.env, "/email-verification", {
    userId: c.get("identity").userId,
  });
  if (status === "sent")
    return c.json({ message: "Enviamos um novo link para o seu e-mail." });
  if (status === "ineligible")
    return c.json({ message: "Seu e-mail já está confirmado." });
  if (status === "throttled")
    throw new HTTPException(429, {
      message:
        "Um link foi enviado há pouco. Aguarde um minuto antes de pedir outro.",
    });
  throw new HTTPException(503, {
    message:
      "Não foi possível enviar o link agora. Tente novamente mais tarde.",
  });
});
auth.post("/verify-email", async (c) => {
  const { token } = await input(
    c,
    z.object({ token: z.string().min(32).max(128) }),
  );
  await rateLimit(c, "verify-email", 20);
  const verification = await c.env.DB.prepare(
    "DELETE FROM email_verifications WHERE token_hash=? AND expires_at>? RETURNING user_id",
  )
    .bind(digest(token), Date.now())
    .first<{ user_id: string }>();
  if (!verification)
    throw new HTTPException(400, {
      message:
        "Este link expirou ou já foi usado. Entre na plataforma para pedir outro.",
    });
  await c.env.DB.prepare(
    "UPDATE applications SET email_verified_at=COALESCE(email_verified_at,?) WHERE email=(SELECT email FROM users WHERE id=?)",
  )
    .bind(new Date().toISOString(), verification.user_id)
    .run();
  return c.json({ ok: true });
});
auth.post("/login", async (c) => {
  const data = await input(
    c,
    z.object({ email: emailSchema, password: z.string().min(1).max(128) }),
  );
  await rateLimit(c, "login-ip", 40);
  await rateLimit(c, "login-email", 15, data.email);
  const user = await c.env.DB.prepare(
    "SELECT id,password_hash FROM users WHERE email=?",
  )
    .bind(data.email)
    .first<{ id: string; password_hash: string }>();
  const dummy =
    "scrypt:16384:8:5:00000000000000000000000000000000:" + "00".repeat(64);
  const valid = verifyPassword(data.password, user?.password_hash || dummy);
  if (!user || !valid)
    throw new HTTPException(401, { message: "E-mail ou senha incorretos." });
  await startSession(c, user.id);
  return c.json({ ok: true });
});
auth.post("/logout", async (c) => {
  await endSession(c);
  return c.json({ ok: true });
});
auth.post("/password", requireUser, async (c) => {
  const data = await input(
    c,
    z.object({
      currentPassword: z.string().min(1).max(128),
      password: passwordSchema,
    }),
  );
  await rateLimit(c, "password", 10, c.get("identity").userId);
  const user = await c.env.DB.prepare(
    "SELECT password_hash FROM users WHERE id=?",
  )
    .bind(c.get("identity").userId)
    .first<{ password_hash: string }>();
  if (!user || !verifyPassword(data.currentPassword, user.password_hash))
    throw new HTTPException(400, { message: "A senha atual não confere." });
  if (data.currentPassword === data.password)
    throw new HTTPException(400, {
      message: "Escolha uma senha diferente da atual.",
    });
  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE users SET password_hash=?,must_change_password=0 WHERE id=?",
    ).bind(hashPassword(data.password), c.get("identity").userId),
    c.env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(
      c.get("identity").userId,
    ),
    c.env.DB.prepare("DELETE FROM password_resets WHERE user_id=?").bind(
      c.get("identity").userId,
    ),
  ]);
  await startSession(c, c.get("identity").userId);
  return c.json({ ok: true });
});
auth.post("/account/delete", requireUser, async (c) => {
  const data = await input(
    c,
    z.object({ password: z.string().min(1).max(128) }),
  );
  const { userId } = c.get("identity");
  await rateLimit(c, "delete-account", 10, userId);
  const user = await c.env.DB.prepare(
    "SELECT email,role,password_hash FROM users WHERE id=?",
  )
    .bind(userId)
    .first<{ email: string; role: string; password_hash: string }>();
  if (!user || !verifyPassword(data.password, user.password_hash))
    throw new HTTPException(400, { message: "A senha não confere." });
  // Removing the only administrator would lock the club out of its panel.
  if (user.role === "admin")
    throw new HTTPException(403, {
      message: "A conta administrativa não pode ser excluída por aqui.",
    });
  // Whoever had access may still be in the WhatsApp and Discord groups, which
  // are members-only. Name and phone stay, apart from the account, until the
  // organization removes the person there, and for 30 days at most.
  const departure = await c.env.DB.prepare(
    "SELECT name,phone FROM applications WHERE email=? AND status IN ('approved','suspended')",
  )
    .bind(user.email)
    .first<{ name: string; phone: string }>();
  const now = new Date();
  // Sessions, reset links and onboarding cascade from users. Approval notices
  // have no cascade, so they go first.
  await c.env.DB.batch([
    expireDepartures(c.env.DB, now),
    ...(departure
      ? [
          c.env.DB.prepare(
            "INSERT INTO member_departures(id,name,phone,left_at) VALUES(?,?,?,?)",
          ).bind(
            crypto.randomUUID(),
            departure.name,
            departure.phone,
            now.toISOString(),
          ),
        ]
      : []),
    c.env.DB.prepare(
      "DELETE FROM approval_notifications WHERE application_id IN (SELECT id FROM applications WHERE email=?)",
    ).bind(user.email),
    c.env.DB.prepare("DELETE FROM applications WHERE email=?").bind(user.email),
    c.env.DB.prepare("DELETE FROM users WHERE id=?").bind(userId),
    c.env.DB.prepare("DELETE FROM auth_limits WHERE key=?").bind(
      digest("login-email:" + user.email),
    ),
  ]);
  await endSession(c);
  return c.json({ ok: true });
});
auth.get("/preferences", requireUser, async (c) => {
  const meetingEmails = await c.env.DB.prepare(
    "SELECT meeting_emails FROM users WHERE id=?",
  )
    .bind(c.get("identity").userId)
    .first<number>("meeting_emails");
  return c.json({ meetingEmails: meetingEmails === 1 });
});
auth.patch("/preferences", requireUser, async (c) => {
  const { meetingEmails } = await input(c, preferencesSchema);
  await c.env.DB.prepare("UPDATE users SET meeting_emails=? WHERE id=?")
    .bind(meetingEmails ? 1 : 0, c.get("identity").userId)
    .run();
  return c.json({ meetingEmails });
});
auth.get("/profile", requireUser, async (c) => {
  const phone = await c.env.DB.prepare(
    "SELECT phone FROM applications WHERE email=?",
  )
    .bind(c.get("identity").email)
    .first<string>("phone");
  return c.json({ phone: phone ?? "" });
});
auth.patch("/profile", requireUser, async (c) => {
  const { phone } = await input(c, profileSchema);
  await c.env.DB.prepare("UPDATE applications SET phone=? WHERE email=?")
    .bind(phone, c.get("identity").email)
    .run();
  return c.json({ phone });
});
auth.post("/reset", async (c) => {
  const data = await input(
    c,
    z.object({ token: z.string().min(32).max(128), password: passwordSchema }),
  );
  await rateLimit(c, "reset", 20);
  const reset = await c.env.DB.prepare(
    "DELETE FROM password_resets WHERE token_hash=? AND expires_at>? RETURNING user_id",
  )
    .bind(digest(data.token), Date.now())
    .first<{ user_id: string }>();
  if (!reset)
    throw new HTTPException(400, {
      message:
        "Este link expirou ou já foi utilizado. Solicite outro ao organizador.",
    });
  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE users SET password_hash=?,must_change_password=0 WHERE id=?",
    ).bind(hashPassword(data.password), reset.user_id),
    c.env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(
      reset.user_id,
    ),
  ]);
  return c.json({ ok: true });
});
export { auth };
