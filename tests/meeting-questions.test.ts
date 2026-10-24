import { beforeAll, afterAll, test, expect } from "vitest";
import { fixture, session } from "./helpers";
import { createApp } from "../worker/index";
import type { AdminQuestion, MeetingQuestions } from "../shared/contracts";
const app = createApp();
let f: Awaited<ReturnType<typeof fixture>>;
let admin: Awaited<ReturnType<typeof session>>;
beforeAll(async () => {
  f = await fixture();
  admin = await session(f.DB, "admin");
  f.env.ADMIN_EMAIL = admin.email;
});
afterAll(async () => {
  await f.mf.dispose();
});
const day = 86400000;
async function meeting(id: string, offset = day, status = "scheduled") {
  await f.DB.prepare(
    "INSERT INTO meetings(id,cycle_id,title,starts_at,status) VALUES(?,'primeira-leitura',?,?,?)",
  )
    .bind(
      id,
      "Encontro " + id,
      new Date(Date.now() + offset).toISOString(),
      status,
    )
    .run();
}
async function member(name = "Pessoa", status = "approved") {
  const s = await session(f.DB, "member", status);
  await f.DB.prepare("UPDATE users SET name=? WHERE id=?")
    .bind(name, s.id)
    .run();
  return s;
}
const request = (
  path: string,
  cookie: string,
  method = "GET",
  body?: unknown,
  origin = f.env.APP_ORIGIN,
) =>
  app.request(
    "/api" + path,
    {
      method,
      headers: {
        cookie,
        origin,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    f.env,
  );
const ask = (
  id: string,
  cookie: string,
  body: unknown = "Por que O(n log n)?",
) => request("/meetings/" + id + "/questions", cookie, "POST", { body });
const list = async (id: string, cookie: string) =>
  (await (
    await request("/meetings/" + id + "/questions", cookie)
  ).json()) as MeetingQuestions;
const count = async (sql: string, ...values: string[]) =>
  (await f.DB.prepare(sql)
    .bind(...values)
    .first<number>("total")) ?? 0;

test("only approved members send and read questions; only administrators review them", async () => {
  await meeting("access");
  expect(
    (await app.request("/api/meetings/access/questions", {}, f.env)).status,
  ).toBe(401);
  for (const status of ["pending", "rejected", "suspended"]) {
    const s = await member("Pessoa", status);
    expect((await request("/meetings/access/questions", s.cookie)).status).toBe(
      403,
    );
    expect((await ask("access", s.cookie)).status).toBe(403);
  }
  const m = await member();
  expect((await ask("access", m.cookie)).status).toBe(201);
  const id = (await list("access", m.cookie)).questions[0].id;
  expect(
    (await request("/admin/meetings/access/questions", m.cookie)).status,
  ).toBe(403);
  expect(
    (
      await request("/admin/questions/" + id, m.cookie, "PATCH", {
        hidden: true,
      })
    ).status,
  ).toBe(403);
  expect(
    (await request("/admin/meetings/access/questions", admin.cookie)).status,
  ).toBe(200);
  const forged = await request(
    "/meetings/access/questions",
    m.cookie,
    "POST",
    { body: "Forjada" },
    "https://evil.example",
  );
  expect(forged.status).toBe(403);
  expect(
    await count(
      "SELECT COUNT(*) total FROM meeting_questions WHERE body='Forjada'",
    ),
  ).toBe(0);
});

test("members send up to three questions of up to 500 characters before the meeting", async () => {
  await meeting("limit");
  await meeting("started", -60000);
  await meeting("cancelled-q", day, "cancelled");
  const m = await member("Ana Souza");
  expect((await ask("limit", m.cookie, "")).status).toBe(400);
  expect((await ask("limit", m.cookie, "x".repeat(501))).status).toBe(400);
  expect((await ask("missing", m.cookie)).status).toBe(404);
  for (const id of ["started", "cancelled-q"])
    expect((await ask(id, m.cookie)).status).toBe(409);
  expect((await ask("limit", m.cookie, "x".repeat(500))).status).toBe(201);
  expect((await ask("limit", m.cookie, "  Segunda  ")).status).toBe(201);
  expect((await list("limit", m.cookie)).remaining).toBe(1);
  expect((await ask("limit", m.cookie)).status).toBe(201);
  const fourth = await ask("limit", m.cookie);
  expect(fourth.status).toBe(409);
  expect(
    await count(
      "SELECT COUNT(*) total FROM meeting_questions WHERE meeting_id='limit' AND user_id=?",
      m.id,
    ),
  ).toBe(3);
  const stored = await f.DB.prepare(
    "SELECT body FROM meeting_questions WHERE meeting_id='limit' AND body LIKE 'Seg%'",
  ).first<string>("body");
  expect(stored).toBe("Segunda");
});

test("parallel submissions cannot go past three questions", async () => {
  await meeting("parallel");
  const m = await member();
  const results = await Promise.all(
    Array.from({ length: 6 }, (_, i) => ask("parallel", m.cookie, "P" + i)),
  );
  expect(results.filter((r) => r.status === 201)).toHaveLength(3);
  expect(
    await count(
      "SELECT COUNT(*) total FROM meeting_questions WHERE meeting_id='parallel'",
    ),
  ).toBe(3);
});

test("sending questions is rate limited", async () => {
  await meeting("rate-a");
  await meeting("rate-b");
  await meeting("rate-c");
  await meeting("rate-d");
  const m = await member();
  const statuses = [];
  for (const id of ["rate-a", "rate-b", "rate-c", "rate-d"])
    for (let i = 0; i < 3; i++)
      statuses.push((await ask(id, m.cookie, "Q" + i)).status);
  expect(statuses.slice(0, 10).every((s) => s === 201)).toBe(true);
  expect(statuses[10]).toBe(429);
});

test("members see first names and vote totals, never who voted", async () => {
  await meeting("votes");
  const ana = await member("Ana Souza Lima");
  const bruno = await member("Bruno Reis");
  const carla = await member("Carla Dias");
  await ask("votes", ana.cookie, "Pergunta da Ana");
  const questionId = (await list("votes", ana.cookie)).questions[0].id;
  const vote = (cookie: string, value: unknown) =>
    request(
      "/meetings/votes/questions/" + questionId + "/vote",
      cookie,
      "PUT",
      { vote: value },
    );
  expect((await vote(bruno.cookie, "yes")).status).toBe(400);
  expect(await (await vote(bruno.cookie, true)).json()).toEqual({
    voted: true,
    votes: 1,
  });
  expect(await (await vote(bruno.cookie, true)).json()).toEqual({
    voted: true,
    votes: 1,
  });
  await vote(carla.cookie, true);
  expect((await vote(ana.cookie, true)).status).toBe(409);
  const response = await request("/meetings/votes/questions", carla.cookie);
  const text = await response.text();
  const body = JSON.parse(text) as MeetingQuestions;
  expect(body.questions[0]).toEqual({
    id: questionId,
    body: "Pergunta da Ana",
    first_name: "Ana",
    votes: 2,
    voted: true,
    mine: false,
    agenda: false,
    created_at: expect.any(String),
  });
  for (const secret of [
    "Souza",
    ana.id,
    ana.email,
    bruno.id,
    "Bruno",
    carla.id,
  ])
    expect(text).not.toContain(secret);
  expect((await list("votes", ana.cookie)).questions[0]).toMatchObject({
    mine: true,
    voted: false,
  });
  expect(await (await vote(bruno.cookie, false)).json()).toEqual({
    voted: false,
    votes: 1,
  });
});

test("authors delete only their own questions", async () => {
  await meeting("delete");
  const ana = await member("Ana");
  const bruno = await member("Bruno");
  await ask("delete", ana.cookie);
  const id = (await list("delete", ana.cookie)).questions[0].id;
  const remove = (cookie: string) =>
    request("/meetings/delete/questions/" + id, cookie, "DELETE");
  expect((await remove(bruno.cookie)).status).toBe(404);
  expect((await remove(ana.cookie)).status).toBe(200);
  expect((await list("delete", ana.cookie)).questions).toEqual([]);
});

test("administrators hide questions and mark them for the agenda", async () => {
  await meeting("review");
  const ana = await member("Ana Souza");
  const bruno = await member("Bruno Reis");
  await ask("review", ana.cookie, "Primeira");
  await ask("review", bruno.cookie, "Segunda");
  const all = (await (
    await request("/admin/meetings/review/questions", admin.cookie)
  ).json()) as AdminQuestion[];
  expect(all.map((q) => [q.body, q.author])).toEqual([
    ["Primeira", "Ana Souza"],
    ["Segunda", "Bruno Reis"],
  ]);
  const [first, second] = all;
  const patch = (id: string, body: unknown) =>
    request("/admin/questions/" + id, admin.cookie, "PATCH", body);
  expect((await patch(first.id, {})).status).toBe(400);
  expect((await patch("missing", { hidden: true })).status).toBe(404);
  expect((await patch(first.id, { hidden: true })).status).toBe(200);
  expect((await patch(second.id, { agenda: true })).status).toBe(200);
  const seen = await list("review", bruno.cookie);
  expect(seen.questions.map((q) => [q.body, q.agenda])).toEqual([
    ["Segunda", true],
  ]);
  // Hiding a question does not give its author a new slot.
  expect((await list("review", ana.cookie)).remaining).toBe(2);
  expect(
    (
      await request(
        "/meetings/review/questions/" + first.id + "/vote",
        bruno.cookie,
        "PUT",
        { vote: true },
      )
    ).status,
  ).toBe(404);
  const reviewed = (await (
    await request("/admin/meetings/review/questions", admin.cookie)
  ).json()) as AdminQuestion[];
  expect(reviewed.map((q) => [q.hidden, q.agenda])).toEqual([
    [true, false],
    [false, true],
  ]);
});

test("questions close when the meeting starts and leave with the account", async () => {
  await meeting("closing");
  const ana = await member();
  const bruno = await member();
  await ask("closing", ana.cookie);
  const id = (await list("closing", ana.cookie)).questions[0].id;
  await request(
    "/meetings/closing/questions/" + id + "/vote",
    bruno.cookie,
    "PUT",
    { vote: true },
  );
  await f.DB.prepare("UPDATE meetings SET starts_at=? WHERE id='closing'")
    .bind(new Date(Date.now() - 60000).toISOString())
    .run();
  const closed = await list("closing", bruno.cookie);
  expect(closed.open).toBe(false);
  expect(closed.questions).toHaveLength(1);
  expect(
    (
      await request(
        "/meetings/closing/questions/" + id + "/vote",
        bruno.cookie,
        "PUT",
        { vote: false },
      )
    ).status,
  ).toBe(409);
  await f.DB.prepare("DELETE FROM applications WHERE id=?")
    .bind(bruno.id)
    .run();
  await f.DB.prepare("DELETE FROM users WHERE id=?").bind(bruno.id).run();
  expect(
    await count(
      "SELECT COUNT(*) total FROM meeting_question_votes WHERE question_id=?",
      id,
    ),
  ).toBe(0);
  await f.DB.prepare("DELETE FROM applications WHERE id=?").bind(ana.id).run();
  await f.DB.prepare("DELETE FROM users WHERE id=?").bind(ana.id).run();
  expect(
    await count("SELECT COUNT(*) total FROM meeting_questions WHERE id=?", id),
  ).toBe(0);
});
