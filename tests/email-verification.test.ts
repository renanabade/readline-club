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
// The API reaches the real mailer code, with a simulated email provider.
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
  /\/confirmar-email#([0-9a-f]{64})/.exec(message.text)![1];
function call(
  path: string,
  {
    body,
    cookie,
    method = "POST",
    env = {},
  }: {
    body?: object;
    cookie?: string;
    method?: string;
    env?: object;
  } = {},
) {
  return app.request(
    path,
    {
      method,
      headers: {
        origin: f.env.APP_ORIGIN,
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
    { ...f.env, ...env },
  );
}
const verifiedAt = (id: string) =>
  f.DB.prepare("SELECT email_verified_at FROM applications WHERE id=?")
    .bind(id)
    .first<string | null>("email_verified_at");
test("signup sends a confirmation link whose token is stored only as a hash", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        success: true,
        hostname: "club.example",
        action: "signup",
      }),
    ),
  );
  const send = sender();
  const response = await call("/api/auth/register", {
    body: {
      name: "Bia Leitora",
      email: "bia@example.test",
      phone: "(11) 91234-5678",
      password: "uma-senha-forte-123",
      experience: "beginner",
      motivation: "",
      consent: true,
      turnstileToken: "token",
    },
    env: { APPROVAL_EMAIL: mailerBinding(send) },
  });
  expect(response.status).toBe(201);
  expect(send).toHaveBeenCalledOnce();
  const message = send.mock.calls[0]![0] as Sent;
  expect(message.to).toBe("bia@example.test");
  expect(message.html).toContain("/confirmar-email#");
  const token = tokenOf(message);
  const row = await f.DB.prepare(
    "SELECT v.token_hash,v.status FROM email_verifications v JOIN users u ON u.id=v.user_id WHERE u.email=?",
  )
    .bind("bia@example.test")
    .first<{ token_hash: string; status: string }>();
  expect(row).toEqual({
    token_hash: createHash("sha256").update(token).digest("hex"),
    status: "sent",
  });
  expect(JSON.stringify(row)).not.toContain(token);
});
test("signup still succeeds when the confirmation email is unavailable", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        success: true,
        hostname: "club.example",
        action: "signup",
      }),
    ),
  );
  const response = await call("/api/auth/register", {
    body: {
      name: "Caio Leitor",
      email: "caio@example.test",
      phone: "(11) 91234-5679",
      password: "uma-senha-forte-123",
      experience: "beginner",
      motivation: "",
      consent: true,
      turnstileToken: "token",
    },
  });
  expect(response.status).toBe(201);
});
test("the link confirms the email once, with one click and no session", async () => {
  const pending = await session(f.DB, "member", "pending");
  const send = sender();
  const binding = { APPROVAL_EMAIL: mailerBinding(send) };
  const resent = await call("/api/auth/email-verification", {
    cookie: pending.cookie,
    body: {},
    env: binding,
  });
  expect(resent.status).toBe(200);
  const token = tokenOf(send.mock.calls[0]![0] as Sent);
  expect(await verifiedAt(pending.id)).toBeNull();
  const confirm = await call("/api/auth/verify-email", { body: { token } });
  expect(confirm.status).toBe(200);
  expect(confirm.headers.get("set-cookie")).toBeNull();
  expect(await verifiedAt(pending.id)).toBeTruthy();
  expect(
    (await call("/api/auth/verify-email", { body: { token } })).status,
  ).toBe(400);
  const status = await call("/api/auth/email-verification", {
    cookie: pending.cookie,
    method: "GET",
  });
  expect(await status.json()).toEqual({ verified: true });
  // Already confirmed: no new email.
  const again = await call("/api/auth/email-verification", {
    cookie: pending.cookie,
    body: {},
    env: binding,
  });
  expect(await again.json()).toEqual({
    message: "Seu e-mail já está confirmado.",
  });
  expect(send).toHaveBeenCalledOnce();
});
test("resending is throttled, replaces the previous link and expired links fail", async () => {
  const pending = await session(f.DB, "member", "pending");
  const send = sender();
  const binding = { APPROVAL_EMAIL: mailerBinding(send) };
  const resend = () =>
    call("/api/auth/email-verification", {
      cookie: pending.cookie,
      body: {},
      env: binding,
    });
  const results = await Promise.all([resend(), resend()]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 429]);
  expect(send).toHaveBeenCalledOnce();
  const first = tokenOf(send.mock.calls[0]![0] as Sent);
  await f.DB.prepare(
    "UPDATE email_verifications SET attempted_at='2020-01-01' WHERE user_id=?",
  )
    .bind(pending.id)
    .run();
  expect((await resend()).status).toBe(200);
  const second = tokenOf(send.mock.calls[1]![0] as Sent);
  expect(
    (await call("/api/auth/verify-email", { body: { token: first } })).status,
  ).toBe(400);
  await f.DB.prepare(
    "UPDATE email_verifications SET expires_at=? WHERE user_id=?",
  )
    .bind(Date.now() - 1, pending.id)
    .run();
  expect(
    (await call("/api/auth/verify-email", { body: { token: second } })).status,
  ).toBe(400);
  expect(await verifiedAt(pending.id)).toBeNull();
});
test("an unknown delivery outcome is not retried right away", async () => {
  const pending = await session(f.DB, "member", "pending");
  const send = vi.fn(async () => {
    throw new Error("lost connection after acceptance");
  });
  const binding = { APPROVAL_EMAIL: mailerBinding(send) };
  const resend = () =>
    call("/api/auth/email-verification", {
      cookie: pending.cookie,
      body: {},
      env: binding,
    });
  expect((await resend()).status).toBe(503);
  await f.DB.prepare(
    "UPDATE email_verifications SET attempted_at=? WHERE user_id=?",
  )
    .bind(new Date(Date.now() - 5 * 60000).toISOString(), pending.id)
    .run();
  expect((await resend()).status).toBe(429);
  expect(send).toHaveBeenCalledOnce();
});
test("confirmation routes validate input, origin and session", async () => {
  expect(
    (await call("/api/auth/verify-email", { body: { token: "short" } })).status,
  ).toBe(400);
  expect(
    (
      await app.request(
        "/api/auth/verify-email",
        {
          method: "POST",
          headers: {
            origin: "https://other.example",
            "content-type": "application/json",
          },
          body: JSON.stringify({ token: "a".repeat(64) }),
        },
        f.env,
      )
    ).status,
  ).toBe(403);
  expect(
    (await call("/api/auth/email-verification", { method: "GET" })).status,
  ).toBe(401);
  expect(
    (await call("/api/auth/email-verification", { body: {} })).status,
  ).toBe(401);
});
test("the panel shows confirmation and accept all only takes confirmed pending signups", async () => {
  const confirmed = await session(f.DB, "member", "pending");
  const unconfirmed = await session(f.DB, "member", "pending");
  await f.DB.prepare("UPDATE applications SET email_verified_at=? WHERE id=?")
    .bind(new Date().toISOString(), confirmed.id)
    .run();
  const overview = (await (
    await call("/api/admin/overview", { cookie: owner.cookie, method: "GET" })
  ).json()) as { applications: { id: string; email_verified_at: unknown }[] };
  const byId = new Map(overview.applications.map((a) => [a.id, a]));
  expect(byId.get(confirmed.id)?.email_verified_at).toBeTruthy();
  expect(byId.get(unconfirmed.id)?.email_verified_at).toBeNull();
  const response = await call("/api/admin/applications/approve-all", {
    cookie: owner.cookie,
    body: { ids: [confirmed.id, unconfirmed.id] },
  });
  expect(await response.json()).toMatchObject({ approved: 1 });
  const status = (id: string) =>
    f.DB.prepare("SELECT status FROM applications WHERE id=?")
      .bind(id)
      .first("status");
  expect(await status(confirmed.id)).toBe("approved");
  expect(await status(unconfirmed.id)).toBe("pending");
  // Manual approval still works for an unconfirmed email.
  await call("/api/admin/applications/" + unconfirmed.id, {
    cookie: owner.cookie,
    method: "PATCH",
    body: { status: "approved" },
  });
  expect(await status(unconfirmed.id)).toBe("approved");
});
test("deleting the account removes its pending confirmation link", async () => {
  const pending = await session(f.DB, "member", "pending");
  await f.DB.prepare(
    "INSERT INTO email_verifications(user_id,token_hash,expires_at,status,attempted_at) VALUES(?,?,?,'sent',?)",
  )
    .bind(pending.id, "hash-" + pending.id, Date.now() + 60000, "2020-01-01")
    .run();
  await f.DB.prepare("DELETE FROM users WHERE id=?").bind(pending.id).run();
  expect(
    await f.DB.prepare(
      "SELECT COUNT(*) n FROM email_verifications WHERE user_id=?",
    )
      .bind(pending.id)
      .first("n"),
  ).toBe(0);
});
async function confirmFor(userId: string, env: object = {}) {
  const token = crypto.randomUUID().replace(/-/g, "").repeat(2);
  await f.DB.prepare(
    "INSERT INTO email_verifications(user_id,token_hash,expires_at,status,attempted_at) VALUES(?,?,?,'sent',?) ON CONFLICT(user_id) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at",
  )
    .bind(
      userId,
      createHash("sha256").update(token).digest("hex"),
      Date.now() + 60000,
      new Date().toISOString(),
    )
    .run();
  return call("/api/auth/verify-email", { body: { token }, env });
}
const statusOf = (userId: string) =>
  f.DB.prepare(
    "SELECT a.status FROM applications a JOIN users u ON u.email=a.email WHERE u.id=?",
  )
    .bind(userId)
    .first<string>("status");
test("confirming the email releases member access and sends the welcome email", async () => {
  const pending = await session(f.DB, "member", "pending");
  const blocked = await call("/api/meetings", {
    cookie: pending.cookie,
    method: "GET",
  });
  expect(blocked.status).toBe(403);
  const send = sender();
  const confirm = await confirmFor(pending.id, {
    APPROVAL_EMAIL: mailerBinding(send),
  });
  expect(confirm.status).toBe(200);
  expect(await statusOf(pending.id)).toBe("approved");
  expect(send).toHaveBeenCalledOnce();
  const open = await call("/api/meetings", {
    cookie: pending.cookie,
    method: "GET",
  });
  expect(open.status).toBe(200);
});
test("the panel shows a failed confirmation and the admin can send a new link", async () => {
  const member = await session(f.DB);
  await f.DB.prepare(
    "UPDATE applications SET email_confirmation_required=1 WHERE id=?",
  )
    .bind(member.id)
    .run();
  const failing = vi.fn(async () => {
    throw Object.assign(new Error("domain"), {
      code: "E_SENDER_DOMAIN_NOT_AVAILABLE",
    });
  });
  // The signup email failed: the panel tells the organization.
  await mailer.fetch(
    new Request("https://approval.internal/email-verification", {
      method: "POST",
      body: JSON.stringify({ userId: member.id }),
    }),
    {
      DB: f.DB,
      EMAIL: { send: failing },
      EMAIL_FROM: "club@example.test",
      APP_ORIGIN: f.env.APP_ORIGIN,
    },
  );
  const overview = async () =>
    (
      (await (
        await call("/api/admin/overview", {
          cookie: owner.cookie,
          method: "GET",
        })
      ).json()) as {
        applications: {
          id: string;
          email_verification_status: string | null;
          email_verification_error: string | null;
        }[];
      }
    ).applications.find((a) => a.id === member.id)!;
  expect(await overview()).toMatchObject({
    email_verification_status: "failed",
    email_verification_error: "E_SENDER_DOMAIN_NOT_AVAILABLE",
  });

  const path = `/api/admin/applications/${member.id}/email-verification`;
  const send = sender();
  const env = { APPROVAL_EMAIL: mailerBinding(send) };
  expect((await call(path, { env })).status).toBe(401);
  expect((await call(path, { cookie: member.cookie, env })).status).toBe(403);
  // Failed sends retry after a minute, like the person's own resend.
  await f.DB.prepare(
    "UPDATE email_verifications SET attempted_at=? WHERE user_id=?",
  )
    .bind(new Date(Date.now() - 120000).toISOString(), member.id)
    .run();
  const response = await call(path, { cookie: owner.cookie, env });
  expect(response.status).toBe(200);
  expect(((await response.json()) as { message: string }).message).toBe(
    "Novo link de confirmação enviado.",
  );
  expect(send).toHaveBeenCalledTimes(1);
  expect((send.mock.calls[0]![0] as Sent).to).toBe(member.email);
  expect((await overview()).email_verification_status).toBe("sent");
  // A second click right away does not send again.
  expect((await call(path, { cookie: owner.cookie, env })).status).toBe(429);
  expect(send).toHaveBeenCalledTimes(1);

  // The new link confirms the email; after that there is nothing to resend.
  const token = tokenOf(send.mock.calls[0]![0] as Sent);
  expect(
    (await call("/api/auth/verify-email", { body: { token } })).status,
  ).toBe(200);
  expect(await verifiedAt(member.id)).toBeTruthy();
  const again = await call(path, { cookie: owner.cookie, env });
  expect(((await again.json()) as { message: string }).message).toBe(
    "Esse e-mail já está confirmado.",
  );
  expect(send).toHaveBeenCalledTimes(1);
});

test("confirming the email never lifts a suspension or a rejection", async () => {
  for (const status of ["suspended", "rejected"]) {
    const member = await session(f.DB, "member", status);
    expect((await confirmFor(member.id)).status).toBe(200);
    expect(await statusOf(member.id)).toBe(status);
    expect(await verifiedAt(member.id)).toBeTruthy();
  }
});
