import { beforeAll, afterAll, test, expect, vi } from "vitest";
import { fixture, session } from "./helpers";
import { createApp } from "../worker/index";
import { hashPassword } from "../worker/auth/password";
const app = createApp();
let f: Awaited<ReturnType<typeof fixture>>;
beforeAll(async () => {
  f = await fixture();
});
afterAll(async () => {
  await f.mf.dispose();
});
test("wrong Turnstile action and hostname never register accounts", async () => {
  const body = {
    name: "Test",
    email: "bad@example.test",
    password: "a-long-password-123",
    experience: "beginner",
    consent: true,
    turnstileToken: "token",
  };
  for (const result of [
    { success: true, hostname: "attacker.test", action: "signup" },
    { success: true, hostname: "club.example", action: "different" },
    { success: false, hostname: "club.example", action: "signup" },
  ]) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(result)));
    const r = await app.request(
      "/api/auth/register",
      {
        method: "POST",
        headers: {
          origin: f.env.APP_ORIGIN,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      },
      f.env,
    );
    expect(r.status).toBe(400);
    vi.unstubAllGlobals();
  }
  expect(
    await f.DB.prepare(
      "SELECT count(*) n FROM users WHERE email='bad@example.test'",
    ).first("n"),
  ).toBe(0);
});
test("password rotation revokes all old sessions and clears forced change", async () => {
  const s = await session(f.DB, "admin");
  f.env.ADMIN_EMAIL = s.email;
  await f.DB.prepare(
    "UPDATE users SET password_hash=?,must_change_password=1 WHERE id=?",
  )
    .bind(hashPassword("initial-password-123"), s.id)
    .run();
  expect(
    (
      await app.request(
        "/api/admin/overview",
        { headers: { cookie: s.cookie } },
        f.env,
      )
    ).status,
  ).toBe(403);
  const r = await app.request(
    "/api/auth/password",
    {
      method: "POST",
      headers: {
        cookie: s.cookie,
        origin: f.env.APP_ORIGIN,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        currentPassword: "initial-password-123",
        password: "a-new-strong-password-456",
      }),
    },
    f.env,
  );
  expect(r.status).toBe(200);
  expect(r.headers.get("set-cookie")).toBeTruthy();
  expect(
    (await app.request("/api/books", { headers: { cookie: s.cookie } }, f.env))
      .status,
  ).toBe(401);
  expect(
    await f.DB.prepare("SELECT must_change_password FROM users WHERE id=?")
      .bind(s.id)
      .first("must_change_password"),
  ).toBe(0);
});
test("unpublished recording is never exposed to a member", async () => {
  await f.DB.prepare(
    "INSERT INTO meetings(id,cycle_id,title) VALUES('private','primeira-leitura','Rascunho de gravação')",
  ).run();
  await f.DB.prepare(
    "INSERT INTO recordings(id,meeting_id,youtube_id,published) VALUES('r','private','dQw4w9WgXcQ',0)",
  ).run();
  const s = await session(f.DB);
  const response = await app.request(
    "/api/meetings/private",
    { headers: { cookie: s.cookie } },
    f.env,
  );
  expect(response.status).toBe(200);
  expect(await response.text()).not.toContain("dQw4w9WgXcQ");
});
test("too many failed login attempts return 429 without a session", async () => {
  for (let i = 0; i < 16; i++) {
    const r = await app.request(
      "/api/auth/login",
      {
        method: "POST",
        headers: {
          origin: f.env.APP_ORIGIN,
          "content-type": "application/json",
        },
        body: JSON.stringify({ email: "rate@example.test", password: "wrong" }),
      },
      f.env,
    );
    if (i === 15) {
      expect(r.status).toBe(429);
      expect(r.headers.get("set-cookie")).toBeNull();
    }
  }
});
