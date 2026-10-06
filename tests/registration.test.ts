import { beforeAll, afterAll, afterEach, test, expect, vi } from "vitest";
import { createApp } from "../worker/index";
import { fixture } from "./helpers";
let f: Awaited<ReturnType<typeof fixture>>;
const app = createApp();
beforeAll(async () => {
  f = await fixture();
});
afterAll(async () => {
  await f.mf.dispose();
});
afterEach(() => vi.unstubAllGlobals());
const data = {
  name: "Ana Leitora",
  email: "ana@example.test",
  password: "uma-senha-forte-123",
  experience: "beginner",
  motivation: "",
  consent: true,
  turnstileToken: "token",
};
function post(path: string, body: object) {
  return app.request(
    path,
    {
      method: "POST",
      headers: { origin: f.env.APP_ORIGIN, "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    f.env,
  );
}
test("invalid signup does not persist an account", async () => {
  const r = await post("/api/auth/register", { ...data, password: "123" });
  expect(r.status).toBe(400);
  expect(await f.DB.prepare("SELECT count(*) n FROM users").first("n")).toBe(0);
});
test("signup fails closed when challenge verification is unavailable", async () => {
  const r = await app.request(
    "/api/auth/register",
    {
      method: "POST",
      headers: { origin: f.env.APP_ORIGIN, "content-type": "application/json" },
      body: JSON.stringify(data),
    },
    { ...f.env, TURNSTILE_SECRET: "" },
  );
  expect(r.status).toBe(503);
});
test("signup stores a hashed password and pending status; login works", async () => {
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
  expect((await post("/api/auth/register", data)).status).toBe(201);
  const row = await f.DB.prepare(
    "SELECT password_hash,role FROM users WHERE email=?",
  )
    .bind(data.email)
    .first<{ password_hash: string; role: string }>();
  expect(row?.password_hash).not.toBe(data.password);
  expect(row?.password_hash).toMatch(/^scrypt:/);
  expect(row?.role).toBe("member");
  expect(
    await f.DB.prepare("SELECT status FROM applications WHERE email=?")
      .bind(data.email)
      .first("status"),
  ).toBe("pending");
  const login = await post("/api/auth/login", {
    email: data.email,
    password: data.password,
  });
  expect(login.status).toBe(200);
  expect(login.headers.get("set-cookie")).toContain("HttpOnly");
});
test("duplicate registration cannot overwrite password or approval", async () => {
  await f.DB.prepare("UPDATE applications SET status='approved' WHERE email=?")
    .bind(data.email)
    .run();
  const before = await f.DB.prepare(
    "SELECT password_hash FROM users WHERE email=?",
  )
    .bind(data.email)
    .first("password_hash");
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
  await post("/api/auth/register", {
    ...data,
    password: "attacker-password123",
  });
  expect(
    await f.DB.prepare("SELECT password_hash FROM users WHERE email=?")
      .bind(data.email)
      .first("password_hash"),
  ).toBe(before);
  expect(
    await f.DB.prepare("SELECT status FROM applications WHERE email=?")
      .bind(data.email)
      .first("status"),
  ).toBe("approved");
});
test("wrong password does not issue a session", async () => {
  const r = await post("/api/auth/login", {
    email: data.email,
    password: "totally-wrong",
  });
  expect(r.status).toBe(401);
  expect(r.headers.get("set-cookie")).toBeNull();
});
test("signing up with configured administrator email never grants admin", async () => {
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
  await post("/api/auth/register", { ...data, email: f.env.ADMIN_EMAIL });
  expect(
    await f.DB.prepare("SELECT role FROM users WHERE email=?")
      .bind(f.env.ADMIN_EMAIL)
      .first("role"),
  ).not.toBe("admin");
});
