import { beforeAll, afterAll, test, expect } from "vitest";
import { fixture, session } from "./helpers";
import { createApp } from "../worker/index";
import { hashPassword, digest } from "../worker/auth/password";
const app = createApp();
let f: Awaited<ReturnType<typeof fixture>>;
beforeAll(async () => {
  f = await fixture();
});
afterAll(async () => {
  await f.mf.dispose();
});
const write = (path: string, body: unknown, cookie = "", method = "POST") =>
  app.request(
    "/api" + path,
    {
      method,
      headers: {
        origin: f.env.APP_ORIGIN,
        cookie,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
    f.env,
  );

test("initial administrator password cannot be reused to unlock administration", async () => {
  const admin = await session(f.DB, "admin");
  f.env.ADMIN_EMAIL = admin.email;
  await f.DB.prepare(
    "UPDATE users SET password_hash=?,must_change_password=1 WHERE id=?",
  )
    .bind(hashPassword("initial-password-123"), admin.id)
    .run();
  const r = await write(
    "/auth/password",
    {
      currentPassword: "initial-password-123",
      password: "initial-password-123",
    },
    admin.cookie,
  );
  expect(r.status).toBe(400);
  expect(
    await f.DB.prepare("SELECT must_change_password FROM users WHERE id=?")
      .bind(admin.id)
      .first("must_change_password"),
  ).toBe(1);
});

test("changing a password invalidates previously issued recovery links", async () => {
  const member = await session(f.DB);
  await f.DB.prepare("UPDATE users SET password_hash=? WHERE id=?")
    .bind(hashPassword("old-password-123"), member.id)
    .run();
  const token = "a".repeat(64);
  await f.DB.prepare(
    "INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES(?,?,?)",
  )
    .bind(digest(token), member.id, Date.now() + 60000)
    .run();
  const change = await write(
    "/auth/password",
    { currentPassword: "old-password-123", password: "new-password-456" },
    member.cookie,
  );
  expect(change.status).toBe(200);
  expect(
    (await write("/auth/reset", { token, password: "stolen-password-789" }))
      .status,
  ).toBe(400);
});

test("malformed WhatsApp links return a validation error instead of a server error", async () => {
  const admin = await session(f.DB, "admin");
  f.env.ADMIN_EMAIL = admin.email;
  const r = await write(
    "/admin/settings",
    {
      club_name: "Clube",
      description: "Descrição do clube",
      whatsapp_url: "not a url",
      community_guidelines: "Respeito",
    },
    admin.cookie,
    "PATCH",
  );
  expect(r.status).toBe(400);
});

test("administrator lifecycle: forced password change, content, approval and suspension", async () => {
  const admin = await session(f.DB, "admin"),
    member = await session(f.DB, "member", "pending");
  f.env.ADMIN_EMAIL = admin.email;
  await f.DB.prepare(
    "UPDATE users SET password_hash=?,must_change_password=1 WHERE id=?",
  )
    .bind(hashPassword("initial-lifecycle-123"), admin.id)
    .run();
  expect(
    (
      await app.request(
        "/api/admin/overview",
        { headers: { cookie: admin.cookie } },
        f.env,
      )
    ).status,
  ).toBe(403);
  const changed = await write(
    "/auth/password",
    { currentPassword: "initial-lifecycle-123", password: "new-lifecycle-456" },
    admin.cookie,
  );
  expect(changed.status).toBe(200);
  const cookie = changed.headers.get("set-cookie")!.split(";")[0];
  expect(
    (await app.request("/api/admin/overview", { headers: { cookie } }, f.env))
      .status,
  ).toBe(200);
  expect(
    (
      await write(
        "/admin/settings",
        {
          club_name: "Clube revisado",
          description: "Encontros para aprender juntos",
          whatsapp_url: "https://chat.whatsapp.com/example",
          discord_url: "https://discord.gg/example",
          community_guidelines: "Respeito",
        },
        cookie,
        "PATCH",
      )
    ).status,
  ).toBe(200);
  expect(
    await f.DB.prepare("SELECT discord_url FROM settings WHERE id=1").first(
      "discord_url",
    ),
  ).toBe("https://discord.gg/example");
  expect(
    (
      await write(
        "/admin/settings",
        {
          club_name: "Clube revisado",
          description: "Encontros para aprender juntos",
          discord_url: "https://evil.example/discord",
        },
        cookie,
        "PATCH",
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await write(
        "/admin/applications/" + member.id,
        { status: "approved" },
        cookie,
        "PATCH",
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await app.request(
        "/api/books",
        { headers: { cookie: member.cookie } },
        f.env,
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await write(
        "/admin/applications/" + member.id,
        { status: "suspended" },
        cookie,
        "PATCH",
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await app.request(
        "/api/books",
        { headers: { cookie: member.cookie } },
        f.env,
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await app.request(
        "/api/admin/overview",
        { headers: { cookie: member.cookie } },
        f.env,
      )
    ).status,
  ).toBe(403);
});
