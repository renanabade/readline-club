import { beforeAll, afterAll, test, expect, vi } from "vitest";
import { fixture, session } from "./helpers";
import { createApp } from "../worker/index";
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
function request(
  path: string,
  body: object,
  method = "POST",
  cookie = owner.cookie,
  extra = {},
) {
  return app.request(
    path,
    {
      method,
      headers: {
        origin: f.env.APP_ORIGIN,
        cookie,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
    { ...f.env, ...extra },
  );
}
test("pending applications precede approved users even if they are older", async () => {
  const pending = await session(f.DB, "member", "pending");
  await f.DB.prepare(
    "UPDATE applications SET created_at='2020-01-01' WHERE id=?",
  )
    .bind(pending.id)
    .run();
  await session(f.DB);
  const response = await app.request(
    "/api/admin/overview",
    { headers: { cookie: owner.cookie } },
    f.env,
  );
  const body = (await response.json()) as {
    applications: { id: string; status: string }[];
  };
  expect(body.applications[0].id).toBe(pending.id);
});
test("bulk approval only approves submitted pending members and notifies once", async () => {
  const first = await session(f.DB, "member", "pending");
  const second = await session(f.DB, "member", "pending");
  const later = await session(f.DB, "member", "pending");
  const suspended = await session(f.DB, "member", "suspended");
  const rejected = await session(f.DB, "member", "rejected");
  const fetch = vi.fn(async () => Response.json({ emailStatus: "sent" }));
  const ids = [
    first.id,
    first.id,
    second.id,
    suspended.id,
    rejected.id,
    owner.id,
  ];
  const response = await request(
    "/api/admin/applications/approve-all",
    { ids },
    "POST",
    owner.cookie,
    { APPROVAL_EMAIL: { fetch } },
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    approved: 2,
    notified: 2,
    notificationFailures: 0,
  });
  expect(fetch).toHaveBeenCalledTimes(2);
  for (const [id, status] of [
    [later.id, "pending"],
    [suspended.id, "suspended"],
    [rejected.id, "rejected"],
  ]) {
    expect(
      await f.DB.prepare("SELECT status FROM applications WHERE id=?")
        .bind(id)
        .first("status"),
    ).toBe(status);
  }
  const repeated = await request(
    "/api/admin/applications/approve-all",
    { ids },
    "POST",
    owner.cookie,
    { APPROVAL_EMAIL: { fetch } },
  );
  expect(await repeated.json()).toMatchObject({ approved: 0 });
  expect(fetch).toHaveBeenCalledTimes(2);
});
test("bulk approval reports unavailable notices while preserving approved access", async () => {
  const member = await session(f.DB, "member", "pending");
  const response = await request("/api/admin/applications/approve-all", {
    ids: [member.id],
  });
  expect(await response.json()).toMatchObject({
    approved: 1,
    notified: 0,
    notificationFailures: 1,
  });
});
test("bulk approval requires administrator, same origin and bounded explicit ids", async () => {
  const member = await session(f.DB);
  expect(
    (
      await request(
        "/api/admin/applications/approve-all",
        { ids: [member.id] },
        "POST",
        member.cookie,
      )
    ).status,
  ).toBe(403);
  expect(
    (await request("/api/admin/applications/approve-all", { ids: [] })).status,
  ).toBe(400);
  expect(
    (
      await request("/api/admin/applications/approve-all", {
        ids: Array(21).fill(member.id),
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await app.request(
        "/api/admin/applications/approve-all",
        {
          method: "POST",
          headers: { cookie: owner.cookie, origin: "https://other.example" },
          body: JSON.stringify({ ids: [member.id] }),
        },
        f.env,
      )
    ).status,
  ).toBe(403);
});
test("restoring a suspended account restores catalog access with its existing login", async () => {
  const member = await session(f.DB, "member", "suspended");
  expect(
    (
      await app.request(
        "/api/books",
        { headers: { cookie: member.cookie } },
        f.env,
      )
    ).status,
  ).toBe(403);
  const restored = await request(
    "/api/admin/applications/" + member.id,
    { status: "approved" },
    "PATCH",
  );
  expect(restored.status).toBe(200);
  expect(
    (
      await app.request(
        "/api/books",
        { headers: { cookie: member.cookie } },
        f.env,
      )
    ).status,
  ).toBe(200);
});
