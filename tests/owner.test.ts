import { beforeAll, afterAll, test, expect } from "vitest";
import { fixture, session } from "./helpers";
import { createApp } from "../worker/index";
let f: Awaited<ReturnType<typeof fixture>>;
const app = createApp();
beforeAll(async () => {
  f = await fixture();
});
afterAll(async () => {
  await f.mf.dispose();
});
test("only the configured owner with an admin role can access administration", async () => {
  const owner = await session(f.DB, "admin"),
    other = await session(f.DB, "admin");
  f.env.ADMIN_EMAIL = owner.email;
  expect(
    (
      await app.request(
        "/api/admin/overview",
        { headers: { cookie: owner.cookie } },
        f.env,
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await app.request(
        "/api/admin/overview",
        { headers: { cookie: other.cookie } },
        f.env,
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await app.request(
        "/api/admin/settings",
        {
          method: "PATCH",
          headers: {
            cookie: other.cookie,
            origin: f.env.APP_ORIGIN,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            club_name: "Unauthorized",
            description: "No",
          }),
        },
        f.env,
      )
    ).status,
  ).toBe(403);
  const identity = await (
    await app.request("/api/me", { headers: { cookie: other.cookie } }, f.env)
  ).json();
  expect(identity).toMatchObject({ role: "member" });
});
test("a matching email alone does not grant an ordinary account administrative access", async () => {
  const member = await session(f.DB);
  f.env.ADMIN_EMAIL = member.email;
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
test("missing owner configuration disables administrator permissions", async () => {
  const owner = await session(f.DB, "admin");
  f.env.ADMIN_EMAIL = "";
  expect(
    (
      await app.request(
        "/api/admin/overview",
        { headers: { cookie: owner.cookie } },
        f.env,
      )
    ).status,
  ).toBe(403);
});
