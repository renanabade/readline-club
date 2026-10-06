import { beforeAll, afterAll, test, expect, vi } from "vitest";
import { fixture, session } from "./helpers";
import { createApp } from "../worker/index";
import { hashPassword } from "../worker/auth/password";
const app = createApp();
let f: Awaited<ReturnType<typeof fixture>>;
beforeAll(async () => {
  f = await fixture();
  await f.DB.prepare(
    "INSERT INTO meetings(id,cycle_id,title,starts_at,meeting_url,summary) VALUES('audit-meeting','primeira-leitura','Encontro reservado','2026-10-10T19:00:00Z','https://private.example.test/meeting','PRIVATE_NOTES_SENTINEL')",
  ).run();
  await f.DB.prepare(
    "INSERT INTO recordings(id,meeting_id,youtube_id,published) VALUES('audit-video','audit-meeting','AbCdEfGhI12',0)",
  ).run();
  await f.DB.prepare(
    "INSERT INTO resources(id,meeting_id,title,url) VALUES('audit-resource','audit-meeting','Material reservado','https://private.example.test/resource')",
  ).run();
  await f.DB.prepare(
    "UPDATE settings SET whatsapp_url='https://chat.whatsapp.com/PRIVATE_INVITE_SENTINEL'",
  ).run();
});
afterAll(async () => {
  await f.mf.dispose();
  vi.restoreAllMocks();
});
const privatePaths = [
  "/api/books",
  "/api/books/entendendo-algoritmos",
  "/api/meetings",
  "/api/meetings/audit-meeting",
  "/api/meetings/audit-meeting/calendar.ics",
  "/api/community",
  "/api/admin/overview",
];

test("every private entry point rejects visitors and unapproved accounts without payload leakage", async () => {
  for (const status of [null, "pending", "rejected", "suspended"]) {
    const user = status ? await session(f.DB, "member", status) : null;
    for (const path of privatePaths) {
      const response = await app.request(
        path,
        { headers: user ? { cookie: user.cookie } : {} },
        f.env,
      );
      expect(response.status, path + ":" + status).toBe(user ? 403 : 401);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(Object.keys(await response.json())).toEqual(["error"]);
    }
  }
});

test("public data and identity contain only their intended fields", async () => {
  const member = await session(f.DB);
  const home = await app.request("/api/public/home", {}, f.env);
  const raw = await home.text();
  for (const hidden of [
    member.email,
    "AbCdEfGhI12",
    "PRIVATE_INVITE_SENTINEL",
    "PRIVATE_NOTES_SENTINEL",
    "password_hash",
    "token_hash",
    "meeting_url",
    "whatsapp_url",
  ])
    expect(raw).not.toContain(hidden);
  const identity = await app.request(
    "/api/me",
    { headers: { cookie: member.cookie } },
    f.env,
  );
  expect(Object.keys(await identity.json()).sort()).toEqual(
    ["userId", "email", "name", "role", "status", "mustChangePassword"].sort(),
  );
});

test("book archives never mix books and unpublished recordings stay hidden in every member view", async () => {
  await f.DB.prepare(
    "INSERT INTO books(id,title,author) VALUES('other-book','Outro livro','Autor')",
  ).run();
  await f.DB.prepare(
    "INSERT INTO reading_cycles(id,book_id,title) VALUES('other-cycle','other-book','Outro ciclo')",
  ).run();
  await f.DB.prepare(
    "INSERT INTO meetings(id,cycle_id,title) VALUES('other-meeting','other-cycle','OTHER_BOOK_SENTINEL')",
  ).run();
  const member = await session(f.DB);
  for (const path of [
    "/api/books/entendendo-algoritmos",
    "/api/meetings",
    "/api/meetings/audit-meeting",
  ]) {
    const response = await app.request(
      path,
      { headers: { cookie: member.cookie } },
      f.env,
    );
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).not.toContain("AbCdEfGhI12");
    if (path.startsWith("/api/books/"))
      expect(body).not.toContain("OTHER_BOOK_SENTINEL");
  }
  const forbidden = await app.request(
    "/api/admin/overview",
    { headers: { cookie: member.cookie } },
    f.env,
  );
  expect(forbidden.status).toBe(403);
});

test("session cookies resist script access, logout revokes them and no password is returned", async () => {
  const member = await session(f.DB);
  await f.DB.prepare("UPDATE users SET password_hash=? WHERE id=?")
    .bind(hashPassword("audit-only-password-123"), member.id)
    .run();
  const login = await app.request(
    "/api/auth/login",
    {
      method: "POST",
      headers: { origin: f.env.APP_ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({
        email: member.email,
        password: "audit-only-password-123",
      }),
    },
    f.env,
  );
  expect(login.status).toBe(200);
  expect(await login.json()).toEqual({ ok: true });
  const cookie = login.headers.get("set-cookie")!;
  for (const flag of ["HttpOnly", "Secure", "SameSite=Lax"])
    expect(cookie).toContain(flag);
  const sessionCookie = cookie.split(";")[0];
  await app.request(
    "/api/auth/logout",
    {
      method: "POST",
      headers: { origin: f.env.APP_ORIGIN, cookie: sessionCookie },
    },
    f.env,
  );
  expect(
    (
      await app.request(
        "/api/books",
        { headers: { cookie: sessionCookie } },
        f.env,
      )
    ).status,
  ).toBe(401);
});

test("internal failures never disclose database errors or credentials", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const broken = {
    ...f.env,
    DB: {
      prepare: () => {
        throw new Error("SECRET_SENTINEL SELECT password_hash FROM users");
      },
    } as unknown as D1Database,
  };
  const response = await app.request("/api/public/home", {}, broken);
  expect(response.status).toBe(500);
  expect(await response.text()).not.toMatch(
    /SECRET_SENTINEL|password_hash|SELECT|stack/,
  );
  expect(JSON.stringify(log.mock.calls)).not.toMatch(
    /SECRET_SENTINEL|password_hash|SELECT/,
  );
  log.mockRestore();
});

test("ordinary members cannot mutate any administrative resource", async () => {
  const member = await session(f.DB);
  for (const [method, path] of [
    ["PATCH", "/api/admin/applications/any"],
    ["POST", "/api/admin/members/any/reset"],
    ["POST", "/api/admin/books"],
    ["PATCH", "/api/admin/books/any"],
    ["POST", "/api/admin/cycles"],
    ["POST", "/api/admin/meetings"],
    ["POST", "/api/admin/recordings"],
    ["POST", "/api/admin/categories"],
    ["POST", "/api/admin/resources"],
    ["PATCH", "/api/admin/settings"],
    ["DELETE", "/api/admin/resources/any"],
  ]) {
    const response = await app.request(
      path,
      {
        method,
        headers: {
          origin: f.env.APP_ORIGIN,
          cookie: member.cookie,
          "content-type": "application/json",
        },
        body: "{}",
      },
      f.env,
    );
    expect(response.status, path).toBe(403);
  }
});
