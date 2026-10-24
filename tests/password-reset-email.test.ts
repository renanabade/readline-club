import { beforeAll, afterAll, afterEach, test, expect, vi } from "vitest";
import { createHash } from "node:crypto";
import { createApp } from "../worker/index";
import mailer from "../worker/approval-mailer";
import { fixture, session } from "./helpers";
const app = createApp();
let f: Awaited<ReturnType<typeof fixture>>;
let owner: Awaited<ReturnType<typeof session>>;
beforeAll(async () => {
  f = await fixture();
  owner = await session(f.DB, "admin");
  f.env.ADMIN_EMAIL = owner.email;
});
afterAll(async () => {
  await f.mf.dispose();
});
afterEach(() => vi.unstubAllGlobals());
type Sent = EmailMessageBuilder & { text: string; html: string };
function mailerBinding(send: SendEmail["send"]) {
  return {
    fetch: (url: string, init: RequestInit) =>
      mailer.fetch(new Request(url, init), {
        DB: f.DB,
        EMAIL: { send },
        EMAIL_FROM: "club@example.test",
        APP_ORIGIN: f.env.APP_ORIGIN,
      }),
  };
}
const sender = () =>
  vi.fn(async (_message: EmailMessage | EmailMessageBuilder) => ({
    messageId: "message-" + crypto.randomUUID(),
  }));
const tokenOf = (message: Sent) =>
  /\/redefinir-senha#([0-9a-f]{64})/.exec(message.text)![1];
function turnstile(action = "reset") {
  // A new response per call: a response body can be read only once.
  const verify = vi.fn(async () =>
    Response.json({ success: true, hostname: "club.example", action }),
  );
  vi.stubGlobal("fetch", verify);
  return verify;
}
// Each test uses its own IP, so per-IP limits do not carry over between tests.
function post(path: string, body: object, env: object = {}, ip = "") {
  return app.request(
    path,
    {
      method: "POST",
      headers: {
        origin: f.env.APP_ORIGIN,
        "content-type": "application/json",
        ...(ip ? { "cf-connecting-ip": ip } : {}),
      },
      body: JSON.stringify(body),
    },
    { ...f.env, ...env },
  );
}
const forgot = (email: string, env: object = {}, ip = "") =>
  post("/api/auth/forgot", { email, turnstileToken: "token" }, env, ip);
test("the response is the same whether or not the email has an account", async () => {
  turnstile();
  const member = await session(f.DB);
  const send = sender();
  const env = { APPROVAL_EMAIL: mailerBinding(send) };
  const known = await forgot(member.email.toUpperCase(), env, "10.0.0.1");
  const unknown = await forgot("ninguem@example.test", env, "10.0.0.1");
  const admin = await forgot(owner.email, env, "10.0.0.1");
  expect([known.status, unknown.status, admin.status]).toEqual([200, 200, 200]);
  const bodies = await Promise.all(
    [known, unknown, admin].map((r) => r.json()),
  );
  expect(bodies[1]).toEqual(bodies[0]);
  expect(bodies[2]).toEqual(bodies[0]);
  // Only the member gets an email; the administrator stays out of this flow.
  expect(send).toHaveBeenCalledOnce();
  expect((send.mock.calls[0]![0] as Sent).to).toBe(member.email);
  expect(
    await f.DB.prepare("SELECT COUNT(*) n FROM password_resets WHERE user_id=?")
      .bind(owner.id)
      .first("n"),
  ).toBe(0);
});
test("the emailed link is single use, valid for 30 minutes and revokes sessions", async () => {
  turnstile();
  const member = await session(f.DB);
  const send = sender();
  await forgot(
    member.email,
    { APPROVAL_EMAIL: mailerBinding(send) },
    "10.0.0.2",
  );
  const message = send.mock.calls[0]![0] as Sent;
  expect(message.html).toContain("/redefinir-senha#");
  expect(message.text).toContain("30 minutos");
  const token = tokenOf(message);
  const row = await f.DB.prepare(
    "SELECT token_hash,expires_at FROM password_resets WHERE user_id=?",
  )
    .bind(member.id)
    .first<{ token_hash: string; expires_at: number }>();
  expect(row!.token_hash).toBe(
    createHash("sha256").update(token).digest("hex"),
  );
  expect(row!.expires_at - Date.now()).toBeGreaterThan(29 * 60000);
  expect(row!.expires_at - Date.now()).toBeLessThanOrEqual(30 * 60000);
  const reset = (password: string) =>
    post("/api/auth/reset", { token, password }, {}, "10.0.0.2");
  expect((await reset("uma-senha-nova-123")).status).toBe(200);
  expect(
    await f.DB.prepare("SELECT COUNT(*) n FROM sessions WHERE user_id=?")
      .bind(member.id)
      .first("n"),
  ).toBe(0);
  const again = await reset("outra-senha-nova-456");
  expect(again.status).toBe(400);
  expect(((await again.json()) as { error: string }).error).toContain(
    "Esqueci minha senha",
  );
});
test("an expired emailed link does not reset the password", async () => {
  turnstile();
  const member = await session(f.DB);
  const send = sender();
  await forgot(
    member.email,
    { APPROVAL_EMAIL: mailerBinding(send) },
    "10.0.0.3",
  );
  const token = tokenOf(send.mock.calls[0]![0] as Sent);
  await f.DB.prepare("UPDATE password_resets SET expires_at=? WHERE user_id=?")
    .bind(Date.now() - 1, member.id)
    .run();
  expect(
    (
      await post(
        "/api/auth/reset",
        { token, password: "uma-senha-nova-123" },
        {},
        "10.0.0.3",
      )
    ).status,
  ).toBe(400);
});
test("concurrent requests send one email, and a new link replaces the previous one", async () => {
  turnstile();
  const member = await session(f.DB);
  const send = sender();
  const env = { APPROVAL_EMAIL: mailerBinding(send) };
  await Promise.all([
    forgot(member.email, env, "10.0.0.4"),
    forgot(member.email, env, "10.0.0.4"),
  ]);
  expect(send).toHaveBeenCalledOnce();
  const first = tokenOf(send.mock.calls[0]![0] as Sent);
  await f.DB.prepare(
    "UPDATE password_reset_emails SET attempted_at='2020-01-01' WHERE user_id=?",
  )
    .bind(member.id)
    .run();
  await forgot(member.email, env, "10.0.0.4");
  expect(send).toHaveBeenCalledTimes(2);
  expect(
    (
      await post(
        "/api/auth/reset",
        { token: first, password: "uma-senha-nova-123" },
        {},
        "10.0.0.4",
      )
    ).status,
  ).toBe(400);
});
test("an unknown delivery outcome is not retried right away", async () => {
  turnstile();
  const member = await session(f.DB);
  const send = vi.fn(async () => {
    throw new Error("lost connection after acceptance");
  });
  const env = { APPROVAL_EMAIL: mailerBinding(send) };
  expect((await forgot(member.email, env, "10.0.0.5")).status).toBe(200);
  await f.DB.prepare(
    "UPDATE password_reset_emails SET attempted_at=? WHERE user_id=?",
  )
    .bind(new Date(Date.now() - 5 * 60000).toISOString(), member.id)
    .run();
  await forgot(member.email, env, "10.0.0.5");
  expect(send).toHaveBeenCalledOnce();
  expect(
    await f.DB.prepare(
      "SELECT status FROM password_reset_emails WHERE user_id=?",
    )
      .bind(member.id)
      .first("status"),
  ).toBe("sending");
});
test("requests are limited per email and per IP", async () => {
  turnstile();
  const send = sender();
  const env = { APPROVAL_EMAIL: mailerBinding(send) };
  const statuses = [];
  for (const ip of ["10.1.0.1", "10.1.0.2", "10.1.0.3", "10.1.0.4"])
    statuses.push((await forgot("limite@example.test", env, ip)).status);
  expect(statuses).toEqual([200, 200, 200, 429]);
  const perIp = [];
  for (let i = 0; i < 11; i++)
    perIp.push((await forgot(`ip${i}@example.test`, env, "10.2.0.1")).status);
  expect(perIp.slice(0, 10).every((s) => s === 200)).toBe(true);
  expect(perIp[10]).toBe(429);
});
test("the request needs a valid challenge for this form and fails closed", async () => {
  const member = await session(f.DB);
  const send = sender();
  const env = { APPROVAL_EMAIL: mailerBinding(send) };
  turnstile("signup");
  expect((await forgot(member.email, env, "10.3.0.1")).status).toBe(400);
  expect(
    (await forgot(member.email, { ...env, TURNSTILE_SECRET: "" }, "10.3.0.2"))
      .status,
  ).toBe(503);
  expect(
    (
      await post(
        "/api/auth/forgot",
        { email: "não é e-mail", turnstileToken: "token" },
        env,
        "10.3.0.3",
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await app.request(
        "/api/auth/forgot",
        {
          method: "POST",
          headers: {
            origin: "https://other.example",
            "content-type": "application/json",
          },
          body: JSON.stringify({ email: member.email, turnstileToken: "t" }),
        },
        { ...f.env, ...env },
      )
    ).status,
  ).toBe(403);
  expect(send).not.toHaveBeenCalled();
});
test("the mailer never sends a reset to the administrator account", async () => {
  const send = sender();
  const response = await mailer.fetch(
    new Request("https://internal/password-reset", {
      method: "POST",
      body: JSON.stringify({ userId: owner.id }),
    }),
    {
      DB: f.DB,
      EMAIL: { send },
      EMAIL_FROM: "club@example.test",
      APP_ORIGIN: f.env.APP_ORIGIN,
    },
  );
  expect(await response.json()).toEqual({ status: "ineligible" });
  expect(send).not.toHaveBeenCalled();
});
