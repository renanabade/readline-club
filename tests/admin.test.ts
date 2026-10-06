import { beforeAll, afterAll, test, expect } from "vitest";
import { fixture, session } from "./helpers";
import { createApp } from "../worker/index";
let f: Awaited<ReturnType<typeof fixture>>,
  admin: { cookie: string; id: string; email: string };
const app = createApp();
beforeAll(async () => {
  f = await fixture();
  admin = await session(f.DB, "admin");
  f.env.ADMIN_EMAIL = admin.email;
});
afterAll(async () => {
  await f.mf.dispose();
});
const write = (path: string, body: object, method = "POST") =>
  app.request(
    path,
    {
      method,
      headers: {
        origin: f.env.APP_ORIGIN,
        cookie: admin.cookie,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
    f.env,
  );
test("administrator creates a dated meeting and publishes a validated recording", async () => {
  const r = await write("/api/admin/meetings", {
    cycle_id: "primeira-leitura",
    title: "Introdução",
    chapters: "Capítulo 1",
    starts_at: "2026-10-10T19:00:00-03:00",
  });
  expect(r.status).toBe(201);
  const { id } = (await r.json()) as { id: string };
  expect(
    (
      await write("/api/admin/recordings", {
        meeting_id: id,
        url: "https://youtu.be/dQw4w9WgXcQ",
        published: 1,
      })
    ).status,
  ).toBe(201);
  const member = await session(f.DB);
  const view = await app.request(
    "/api/meetings/" + id,
    { headers: { cookie: member.cookie } },
    f.env,
  );
  const body = (await view.json()) as { meeting: { youtube_id: string } };
  expect(body.meeting.youtube_id).toBe("dQw4w9WgXcQ");
  expect((await app.request("/api/meetings/" + id, {}, f.env)).status).toBe(
    401,
  );
});
test("administrator approval persists without allowing a role change", async () => {
  const member = await session(f.DB, "member", "pending");
  const r = await write(
    "/api/admin/applications/" + member.id,
    { status: "approved", role: "admin" },
    "PATCH",
  );
  expect(r.status).toBe(200);
  expect(
    await f.DB.prepare("SELECT role FROM users WHERE id=?")
      .bind(member.id)
      .first("role"),
  ).toBe("member");
  expect(
    await f.DB.prepare("SELECT status FROM applications WHERE id=?")
      .bind(member.id)
      .first("status"),
  ).toBe("approved");
});
test("bad foreign keys and unsafe URLs produce validation errors", async () => {
  expect(
    (await write("/api/admin/meetings", { cycle_id: "missing", title: "Bad" }))
      .status,
  ).toBe(400);
  expect(
    (
      await write("/api/admin/resources", {
        meeting_id: "missing",
        title: "Bad",
        url: "javascript:alert(1)",
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await write("/api/admin/recordings", {
        meeting_id: "missing",
        url: "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ",
        published: 1,
      })
    ).status,
  ).toBe(400);
});
test("reset links are single use and revoke all prior sessions", async () => {
  const member = await session(f.DB);
  const issue = await write("/api/admin/members/" + member.id + "/reset", {});
  expect(issue.status).toBe(201);
  const { url } = (await issue.json()) as { url: string };
  const token = new URL(url).hash.slice(1);
  const send = () =>
    app.request(
      "/api/auth/reset",
      {
        method: "POST",
        headers: {
          origin: f.env.APP_ORIGIN,
          "content-type": "application/json",
        },
        body: JSON.stringify({ token, password: "minha-nova-senha123" }),
      },
      f.env,
    );
  expect((await send()).status).toBe(200);
  expect((await send()).status).toBe(400);
  expect(
    (
      await app.request(
        "/api/books",
        { headers: { cookie: member.cookie } },
        f.env,
      )
    ).status,
  ).toBe(401);
});
