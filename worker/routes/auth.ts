import { Hono } from "hono";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../env";
import { input } from "../errors";
import {
  signupSchema,
  emailSchema,
  passwordSchema,
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
const auth = new Hono<AppEnv>();
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
        "INSERT INTO applications(id,email,name,experience,motivation) VALUES(?,?,?,?,?)",
      ).bind(id, data.email, data.name, data.experience, data.motivation),
    ]);
  } catch (err) {
    const duplicate = await c.env.DB.prepare(
      "SELECT id FROM users WHERE email=?",
    )
      .bind(data.email)
      .first();
    if (!duplicate) throw err;
  }
  return c.json(
    {
      ok: true,
      message: "Cadastro recebido. Entre para acompanhar sua aprovação.",
    },
    201,
  );
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
