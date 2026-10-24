import { beforeAll, afterAll, test, expect } from "vitest";
import { fixture, session } from "./helpers";
import { createApp } from "../worker/index";
import type {
  AttendanceSheet,
  AttendanceSummary,
  AttendedMeeting,
} from "../shared/contracts";
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
async function meeting(
  id: string,
  offset: number,
  status = "scheduled",
  title = "Encontro " + id,
) {
  await f.DB.prepare(
    "INSERT INTO meetings(id,cycle_id,title,starts_at,status) VALUES(?,'primeira-leitura',?,?,?)",
  )
    .bind(id, title, new Date(Date.now() + offset).toISOString(), status)
    .run();
}
const get = (path: string, cookie = admin.cookie) =>
  app.request("/api" + path, { headers: { cookie } }, f.env);
const mark = (
  id: string,
  userIds: unknown,
  cookie = admin.cookie,
  origin = f.env.APP_ORIGIN,
) =>
  app.request(
    "/api/admin/meetings/" + id + "/attendance",
    {
      method: "PUT",
      headers: { cookie, origin, "content-type": "application/json" },
      body: JSON.stringify({ userIds }),
    },
    f.env,
  );
const marked = async (id: string) =>
  (
    await f.DB.prepare(
      "SELECT user_id FROM meeting_attendance WHERE meeting_id=? ORDER BY user_id",
    )
      .bind(id)
      .all<{ user_id: string }>()
  ).results.map((r: { user_id: string }) => r.user_id);

test("only administrators manage attendance and only members read their history", async () => {
  await meeting("access-held", -day);
  for (const path of [
    "/admin/attendance",
    "/admin/meetings/access-held/attendance",
    "/attendance",
  ])
    expect((await app.request("/api" + path, {}, f.env)).status).toBe(401);
  for (const status of ["pending", "rejected", "suspended"]) {
    const s = await session(f.DB, "member", status);
    for (const path of ["/admin/attendance", "/attendance"])
      expect((await get(path, s.cookie)).status).toBe(403);
    expect((await mark("access-held", [], s.cookie)).status).toBe(403);
  }
  const member = await session(f.DB);
  expect((await get("/admin/attendance", member.cookie)).status).toBe(403);
  expect(
    (await get("/admin/meetings/access-held/attendance", member.cookie)).status,
  ).toBe(403);
  expect((await mark("access-held", [member.id], member.cookie)).status).toBe(
    403,
  );
  expect(await marked("access-held")).toEqual([]);
  expect((await get("/attendance", member.cookie)).status).toBe(200);
  expect((await get("/admin/attendance")).status).toBe(200);
});

test("administrators mark who was present after the meeting starts", async () => {
  await meeting("future", day);
  await meeting("cancelled", -day, "cancelled");
  await meeting("mark-held", -day);
  const [a, b] = [await session(f.DB), await session(f.DB)];
  const pending = await session(f.DB, "member", "pending");
  for (const id of ["future", "cancelled"])
    expect((await mark(id, [a.id])).status).toBe(409);
  expect((await mark("missing", [a.id])).status).toBe(404);
  expect((await mark("mark-held", "everyone")).status).toBe(400);
  expect(
    (await mark("mark-held", [a.id], admin.cookie, "https://evil.example"))
      .status,
  ).toBe(403);
  expect(await marked("mark-held")).toEqual([]);

  const response = await mark("mark-held", [a.id, b.id, pending.id, a.id]);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ present: 2 });
  expect(await marked("mark-held")).toEqual([a.id, b.id].sort());

  // The list is the whole set: who is left out is unmarked.
  expect(await (await mark("mark-held", [b.id])).json()).toEqual({
    present: 1,
  });
  expect(await marked("mark-held")).toEqual([b.id]);
});

test("the sheet lists approved members and keeps marks of who left", async () => {
  await meeting("sheet-held", -day);
  const [a, b] = [await session(f.DB), await session(f.DB)];
  await mark("sheet-held", [a.id, b.id]);
  await f.DB.prepare("UPDATE applications SET status='suspended' WHERE id=?")
    .bind(b.id)
    .run();
  const pending = await session(f.DB, "member", "pending");
  const sheet = await (
    await get("/admin/meetings/sheet-held/attendance")
  ).json<AttendanceSheet>();
  expect(sheet.meeting.id).toBe("sheet-held");
  const byId = new Map(sheet.members.map((m) => [m.user_id, m]));
  expect(byId.get(a.id)?.present).toBe(true);
  expect(byId.get(b.id)?.present).toBe(true);
  expect(byId.has(pending.id)).toBe(false);
  expect(byId.has(admin.id)).toBe(false);
  // Saving the same set keeps the suspended mark; new marks need approval.
  await mark("sheet-held", [a.id, b.id]);
  expect(await marked("sheet-held")).toEqual([a.id, b.id].sort());
  await mark("sheet-held", [a.id]);
  await mark("sheet-held", [a.id, b.id]);
  expect(await marked("sheet-held")).toEqual([a.id]);
});

test("the panel counts who was present and who also came to the previous meeting", async () => {
  const [a, b, c] = [
    await session(f.DB),
    await session(f.DB),
    await session(f.DB),
  ];
  await meeting("first", -30 * day, "completed", "Primeiro");
  await meeting("skipped", -20 * day, "cancelled", "Cancelado");
  await meeting("second", -10 * day, "completed", "Segundo");
  await mark("first", [a.id, b.id]);
  await mark("second", [b.id, c.id]);
  const summary = await (
    await get("/admin/attendance")
  ).json<AttendanceSummary[]>();
  const second = summary.find((m) => m.meeting_id === "second");
  expect(second).toMatchObject({
    title: "Segundo",
    book_title: "Entendendo Algoritmos",
    previous_title: "Primeiro",
    present: 2,
    also_previous: 1,
  });
  expect(summary.find((m) => m.meeting_id === "first")?.present).toBe(2);
  expect(summary.some((m) => m.meeting_id === "skipped")).toBe(false);
  expect(summary.some((m) => m.meeting_id === "future")).toBe(false);
  // Most recent first.
  expect(summary.findIndex((m) => m.meeting_id === "second")).toBeLessThan(
    summary.findIndex((m) => m.meeting_id === "first"),
  );
});

test("members see only their own attendance history", async () => {
  const [a, b] = [await session(f.DB), await session(f.DB)];
  await meeting("history-one", -3 * day, "completed", "Histórico um");
  await meeting("history-two", -2 * day, "completed", "Histórico dois");
  await mark("history-one", [a.id, b.id]);
  await mark("history-two", [b.id]);
  const response = await get("/attendance", a.cookie);
  const body = await response.text();
  const history = JSON.parse(body) as AttendedMeeting[];
  expect(history.map((m) => m.id)).toEqual(["history-one"]);
  expect(Object.keys(history[0]).sort()).toEqual(
    ["book_title", "id", "starts_at", "title"].sort(),
  );
  expect(body).not.toContain(b.id);
  expect(
    (await (await get("/attendance", b.cookie)).json<AttendedMeeting[]>()).map(
      (m) => m.id,
    ),
  ).toEqual(["history-two", "history-one"]);
});

test("deleting the account deletes its attendance", async () => {
  const a = await session(f.DB);
  await meeting("deleted-held", -day);
  await mark("deleted-held", [a.id]);
  await f.DB.prepare("DELETE FROM applications WHERE id=?").bind(a.id).run();
  await f.DB.prepare("DELETE FROM users WHERE id=?").bind(a.id).run();
  expect(await marked("deleted-held")).toEqual([]);
});
