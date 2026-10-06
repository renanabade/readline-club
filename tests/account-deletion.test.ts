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
const remove = (body: unknown, cookie = "", origin = f.env.APP_ORIGIN) =>
  app.request(
    "/api/auth/account/delete",
    {
      method: "POST",
      headers: { origin, cookie, "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    f.env,
  );
async function account(role = "member", status = "approved") {
  const s = await session(f.DB, role, status);
  await f.DB.prepare("UPDATE users SET password_hash=? WHERE id=?")
    .bind(hashPassword("account-password-123"), s.id)
    .run();
  return s;
}
const count = async (sql: string, value: string) =>
  (await f.DB.prepare(sql).bind(value).first<number>("total")) ?? 0;

test("members delete their account and every record tied to it", async () => {
  const member = await account();
  const other = await account();
  await f.DB.batch([
    f.DB.prepare(
      "INSERT INTO community_onboarding(user_id,version,accepted_at) VALUES(?,'community-v1','2026-01-01T00:00:00Z')",
    ).bind(member.id),
    f.DB.prepare(
      "INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES(?,?,?)",
    ).bind(digest("reset-" + member.id), member.id, Date.now() + 60000),
    f.DB.prepare(
      "INSERT INTO approval_notifications(application_id,status,attempted_at) VALUES(?,'sent','2026-01-01T00:00:00Z')",
    ).bind(member.id),
    f.DB.prepare(
      "INSERT INTO auth_limits(key,attempts,expires_at) VALUES(?,1,?)",
    ).bind(digest("login-email:" + member.email), Date.now() + 60000),
  ]);
  const response = await remove(
    { password: "account-password-123" },
    member.cookie,
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("set-cookie")).toMatch(
    /club_session=;.*Max-Age=0/,
  );
  for (const [sql, value] of [
    ["SELECT COUNT(*) total FROM users WHERE id=?", member.id],
    ["SELECT COUNT(*) total FROM applications WHERE email=?", member.email],
    ["SELECT COUNT(*) total FROM sessions WHERE user_id=?", member.id],
    ["SELECT COUNT(*) total FROM password_resets WHERE user_id=?", member.id],
    [
      "SELECT COUNT(*) total FROM community_onboarding WHERE user_id=?",
      member.id,
    ],
    [
      "SELECT COUNT(*) total FROM approval_notifications WHERE application_id=?",
      member.id,
    ],
    [
      "SELECT COUNT(*) total FROM auth_limits WHERE key=?",
      digest("login-email:" + member.email),
    ],
  ])
    expect(await count(sql, value), sql).toBe(0);
  const me = await app.request(
    "/api/me",
    { headers: { cookie: member.cookie } },
    f.env,
  );
  expect(await me.json()).toBeNull();
  expect(
    await count("SELECT COUNT(*) total FROM users WHERE id=?", other.id),
  ).toBe(1);
});

test("deletion requires the session, the current password and the club origin", async () => {
  const member = await account("member", "pending");
  expect((await remove({ password: "account-password-123" })).status).toBe(401);
  expect(
    (
      await remove(
        { password: "account-password-123" },
        member.cookie,
        "https://evil.example",
      )
    ).status,
  ).toBe(403);
  expect(
    (await remove({ password: "wrong-password" }, member.cookie)).status,
  ).toBe(400);
  expect(
    await count("SELECT COUNT(*) total FROM users WHERE id=?", member.id),
  ).toBe(1);
  expect(
    (await remove({ password: "account-password-123" }, member.cookie)).status,
  ).toBe(200);
});

test("the administrator account cannot be deleted from the member area", async () => {
  const admin = await account("admin");
  f.env.ADMIN_EMAIL = admin.email;
  const response = await remove(
    { password: "account-password-123" },
    admin.cookie,
  );
  expect(response.status).toBe(403);
  expect(
    await count("SELECT COUNT(*) total FROM users WHERE id=?", admin.id),
  ).toBe(1);
});
