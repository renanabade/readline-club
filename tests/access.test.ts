import { beforeAll, afterAll, test, expect } from "vitest";
import { createApp } from "../worker/index";
import { fixture, session } from "./helpers";
import { isUpcoming } from "../src/lib/dates";
import type { Meeting } from "../shared/contracts";
let f: Awaited<ReturnType<typeof fixture>>;
const app = createApp();
beforeAll(async () => {
  f = await fixture();
});
afterAll(async () => {
  await f.mf.dispose();
});
test("visitor cannot read books, recordings or administration", async () => {
  for (const path of [
    "/api/books",
    "/api/meetings/hidden",
    "/api/admin/overview",
  ])
    expect((await app.request(path, {}, f.env)).status).toBe(401);
});
test("pending and suspended identities cannot fetch private catalog", async () => {
  for (const status of ["pending", "suspended", "rejected"]) {
    const s = await session(f.DB, "member", status);
    expect(
      (
        await app.request(
          "/api/books",
          { headers: { cookie: s.cookie } },
          f.env,
        )
      ).status,
    ).toBe(403);
  }
});
test("approved member can read but cannot administer", async () => {
  const s = await session(f.DB);
  expect(
    (await app.request("/api/books", { headers: { cookie: s.cookie } }, f.env))
      .status,
  ).toBe(200);
  expect(
    (
      await app.request(
        "/api/admin/overview",
        { headers: { cookie: s.cookie } },
        f.env,
      )
    ).status,
  ).toBe(403);
});
test("suspension immediately revokes access with existing cookie", async () => {
  const s = await session(f.DB);
  expect(
    (await app.request("/api/books", { headers: { cookie: s.cookie } }, f.env))
      .status,
  ).toBe(200);
  await f.DB.prepare("UPDATE applications SET status='suspended' WHERE id=?")
    .bind(s.id)
    .run();
  expect(
    (await app.request("/api/books", { headers: { cookie: s.cookie } }, f.env))
      .status,
  ).toBe(403);
});
test("public catalog cannot disclose meetings or member records", async () => {
  const r = await app.request("/api/public/home", {}, f.env);
  expect(r.status).toBe(200);
  const body = await r.text();
  expect(body).toContain("Entendendo Algoritmos");
  expect(body).not.toContain("youtube_id");
  expect(body).not.toContain("meeting_url");
  expect(body).not.toContain("@example.test");
});
test("public next meeting is an announcement without links, agenda or notes", async () => {
  const read = async () =>
    (
      (await (await app.request("/api/public/home", {}, f.env)).json()) as {
        nextMeeting: Record<string, unknown> | null;
      }
    ).nextMeeting;
  expect(await read()).toBeNull();
  const future = (days: number) =>
    new Date(Date.now() + days * 86400000).toISOString();
  await f.DB.batch([
    f.DB.prepare(
      "INSERT INTO meetings(id,cycle_id,title,starts_at) VALUES('past','primeira-leitura','Passado',?)",
    ).bind(new Date(Date.now() - 86400000).toISOString()),
    f.DB.prepare(
      "INSERT INTO meetings(id,cycle_id,title,starts_at,status) VALUES('cancelled','primeira-leitura','Cancelado',?,'cancelled')",
    ).bind(future(1)),
    f.DB.prepare(
      "INSERT INTO meetings(id,cycle_id,title,chapters,starts_at,agenda,summary,meeting_url) VALUES('next','primeira-leitura','Próximo','Capítulo 5',?,'AGENDA_SENTINEL','NOTES_SENTINEL','https://private.example.test/call')",
    ).bind(future(2)),
    f.DB.prepare(
      "INSERT INTO meetings(id,cycle_id,title,starts_at) VALUES('later','primeira-leitura','Depois',?)",
    ).bind(future(9)),
  ]);
  const next = await read();
  expect(next?.id).toBe("next");
  expect(next?.book_title).toBe("Entendendo Algoritmos");
  expect(Object.keys(next!).sort()).toEqual(
    [
      "id",
      "title",
      "chapters",
      "starts_at",
      "duration_minutes",
      "status",
      "book_title",
    ].sort(),
  );
  const raw = await (await app.request("/api/public/home", {}, f.env)).text();
  for (const hidden of ["AGENDA_SENTINEL", "NOTES_SENTINEL", "private.example"])
    expect(raw).not.toContain(hidden);
  await f.DB.prepare(
    "DELETE FROM meetings WHERE id IN ('past','cancelled','next','later')",
  ).run();
});
test("home, community and agenda agree on the next meeting", async () => {
  const s = await session(f.DB);
  const get = async <T>(path: string) =>
    (await (
      await app.request(path, { headers: { cookie: s.cookie } }, f.env)
    ).json()) as T;
  type Next = { nextMeeting: { title: string } | null };
  const minutes = (n: number) => new Date(Date.now() + n * 60000).toISOString();
  await f.DB.batch([
    f.DB.prepare(
      "INSERT INTO meetings(id,cycle_id,title,starts_at,duration_minutes) VALUES('over','primeira-leitura','Encerrado',?,60)",
    ).bind(minutes(-90)),
    f.DB.prepare(
      "INSERT INTO meetings(id,cycle_id,title,starts_at,duration_minutes) VALUES('live','primeira-leitura','Em andamento',?,60)",
    ).bind(minutes(-10)),
    f.DB.prepare(
      "INSERT INTO meetings(id,cycle_id,title,starts_at) VALUES('soon','primeira-leitura','Em breve',?)",
    ).bind(minutes(60 * 24)),
  ]);
  // The agenda shows the first scheduled meeting that is not over yet.
  const agenda = (await get<Meeting[]>("/api/meetings")).find(
    (m) => m.status === "scheduled" && !!m.starts_at && isUpcoming(m),
  );
  expect(agenda?.title).toBe("Em andamento");
  expect((await get<Next>("/api/public/home")).nextMeeting?.title).toBe(
    agenda?.title,
  );
  expect((await get<Next>("/api/community")).nextMeeting?.title).toBe(
    agenda?.title,
  );
  await f.DB.prepare(
    "DELETE FROM meetings WHERE id IN ('over','live','soon')",
  ).run();
});
test("public member count includes only approved readers and follows status changes", async () => {
  const count = async () => {
    const response = await app.request("/api/public/home", {}, f.env);
    const body = (await response.json()) as { memberCount: number };
    expect(Number.isInteger(body.memberCount)).toBe(true);
    return body.memberCount;
  };
  const before = await count();
  const member = await session(f.DB, "member", "approved");
  await session(f.DB, "member", "pending");
  await session(f.DB, "member", "suspended");
  await session(f.DB, "member", "rejected");
  await session(f.DB, "admin", "approved");
  expect(await count()).toBe(before + 1);
  await f.DB.prepare("UPDATE applications SET status='suspended' WHERE id=?")
    .bind(member.id)
    .run();
  expect(await count()).toBe(before);
});
test("all API responses prevent shared caching", async () => {
  const r = await app.request("/api/me", {}, f.env);
  expect(r.headers.get("cache-control")).toContain("no-store");
});
test("cross-origin writes are rejected", async () => {
  const r = await app.request(
    "/api/auth/login",
    {
      method: "POST",
      headers: {
        origin: "https://attacker.example",
        "content-type": "application/json",
      },
      body: "{}",
    },
    f.env,
  );
  expect(r.status).toBe(403);
});
