import { beforeAll, afterAll, test, expect, vi } from "vitest";
import { fixture, session } from "./helpers";
import { createApp } from "../worker/index";
import mailer, { meetingEmailsCron } from "../worker/approval-mailer";
import { reminderBatchSize } from "../worker/lib/meeting-reminder";

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

type Send = (
  message: EmailMessage | EmailMessageBuilder,
) => Promise<EmailSendResult>;
const delivered = () =>
  vi.fn<Send>(async () => ({ messageId: crypto.randomUUID() }));
const minute = 60_000,
  hour = 60 * minute;
// Each test uses its own far-apart meeting time, so the windows of one test
// never include the meetings of another.
let nextBase = Date.UTC(2030, 0, 1, 23, 0);
const base = () => (nextBase += 30 * 24 * hour);
const run = (send: Send, scheduledTime: number, cron = meetingEmailsCron) =>
  mailer.scheduled({ cron, scheduledTime } as ScheduledController, {
    DB: f.DB,
    EMAIL: { send },
    EMAIL_FROM: "club@example.test",
    APP_ORIGIN: f.env.APP_ORIGIN,
    ADMIN_NOTIFY_EMAIL: "admin@example.test",
  });
async function meeting(startsAt: number, status = "scheduled") {
  const id = crypto.randomUUID();
  await f.DB.prepare(
    "INSERT INTO meetings(id,cycle_id,title,chapters,starts_at,status,meeting_url) VALUES(?,'primeira-leitura','Encontro de teste','Capítulo 1',?,?,'https://meet.example.test/private-call-sentinel')",
  )
    .bind(id, new Date(startsAt).toISOString(), status)
    .run();
  return id;
}
const answer = (meetingId: string, userId: string, response: string) =>
  f.DB.prepare(
    "INSERT INTO meeting_rsvps(meeting_id,user_id,response,updated_at) VALUES(?,?,?,?)",
  )
    .bind(meetingId, userId, response, new Date().toISOString())
    .run();
const recipientsOf = (send: ReturnType<typeof vi.fn<Send>>) =>
  send.mock.calls.map((call) => (call[0] as EmailMessageBuilder).to);
const messageTo = (send: ReturnType<typeof vi.fn<Send>>, email: string) =>
  send.mock.calls
    .map((call) => call[0] as EmailMessageBuilder)
    .find((m) => m.to === email)!;
const reminderStatus = (meetingId: string, userId: string, kind: string) =>
  f.DB.prepare(
    "SELECT status FROM meeting_reminders WHERE meeting_id=? AND user_id=? AND kind=?",
  )
    .bind(meetingId, userId, kind)
    .first<string>("status");

test("the day-before reminder goes once, inside its window, to members who did not say no", async () => {
  const yes = await session(f.DB);
  const unanswered = await session(f.DB);
  const no = await session(f.DB);
  const optedOut = await session(f.DB);
  await f.DB.prepare("UPDATE users SET meeting_emails=0 WHERE id=?")
    .bind(optedOut.id)
    .run();
  const excluded = [
    no,
    optedOut,
    await session(f.DB, "member", "pending"),
    await session(f.DB, "member", "suspended"),
    admin,
  ];
  const startsAt = base();
  const id = await meeting(startsAt);
  await answer(id, yes.id, "yes");
  await answer(id, no.id, "no");

  const send = delivered();
  await run(send, startsAt - 24 * hour - 15 * minute);
  expect(send).not.toHaveBeenCalled();
  await run(send, startsAt - 24 * hour);
  const recipients = recipientsOf(send);
  expect(recipients).toContain(yes.email);
  expect(recipients).toContain(unanswered.email);
  for (const member of excluded) expect(recipients).not.toContain(member.email);
  expect(new Set(recipients).size).toBe(recipients.length);
  const message = messageTo(send, yes.email);
  expect(message.subject).toMatch(/^Amanhã: Encontro de teste · /);

  // Later runs in the same window send nothing new, and the window closes at 23h.
  send.mockClear();
  await run(send, startsAt - 23 * hour - 15 * minute);
  await run(send, startsAt - 23 * hour);
  expect(send).not.toHaveBeenCalled();
});

test("the one-hour reminder has the meeting page and personal presence buttons, but no call link", async () => {
  const member = await session(f.DB);
  const startsAt = base();
  const id = await meeting(startsAt);
  const send = delivered();
  await run(send, startsAt - 75 * minute - 15 * minute);
  expect(recipientsOf(send)).not.toContain(member.email);
  await run(send, startsAt - 60 * minute);
  const message = messageTo(send, member.email);
  expect(message.subject).toMatch(/^Em 1 hora: Encontro de teste · /);
  const page = f.env.APP_ORIGIN + "/encontros/" + id;
  expect(message.text).toContain(page);
  expect(message.html).toContain(page);
  const token = /\/presenca\?resposta=sim#([0-9a-f]{64})/.exec(
    message.text!,
  )![1]!;
  expect(message.text).toContain("/presenca?resposta=nao#" + token);
  expect(message.html).toContain("/presenca?resposta=sim#" + token);
  for (const part of [message.text, message.html])
    expect(part).not.toContain("private-call-sentinel");
  expect(await reminderStatus(id, member.id, "h1")).toBe("sent");

  // The reminder's link answers like the invitation's.
  const put = await app.request(
    "/api/rsvp",
    {
      method: "PUT",
      headers: {
        origin: f.env.APP_ORIGIN,
        "content-type": "application/json",
      },
      body: JSON.stringify({ token, response: "no" }),
    },
    f.env,
  );
  expect(put.status).toBe(200);
  expect(
    await f.DB.prepare(
      "SELECT response FROM meeting_rsvps WHERE meeting_id=? AND user_id=?",
    )
      .bind(id, member.id)
      .first("response"),
  ).toBe("no");

  send.mockClear();
  await run(send, startsAt - 45 * minute);
  expect(send).not.toHaveBeenCalled();
});

test("overlapping runs send each reminder once, in batches", async () => {
  for (let i = 0; i <= reminderBatchSize; i++) await session(f.DB);
  const startsAt = base();
  const id = await meeting(startsAt);
  const send = delivered();
  await Promise.all([
    run(send, startsAt - 60 * minute),
    run(send, startsAt - 60 * minute),
  ]);
  const recipients = recipientsOf(send);
  expect(recipients.length).toBeGreaterThan(reminderBatchSize);
  expect(new Set(recipients).size).toBe(recipients.length);
  const sent = await f.DB.prepare(
    "SELECT COUNT(*) AS total FROM meeting_reminders WHERE meeting_id=? AND kind='h1' AND status='sent'",
  )
    .bind(id)
    .first<number>("total");
  expect(sent).toBe(recipients.length);
});

test("known failures are retried in the window; unknown outcomes stay locked", async () => {
  const known = await session(f.DB);
  const unknown = await session(f.DB);
  const startsAt = base();
  const id = await meeting(startsAt);
  const send = vi.fn<Send>(async (message) => {
    const to = (message as EmailMessageBuilder).to;
    if (to === known.email)
      throw Object.assign(new Error("private details"), {
        code: "E_DELIVERY_FAILED",
      });
    if (to === unknown.email) throw new Error("connection reset");
    return { messageId: crypto.randomUUID() };
  });
  await run(send, startsAt - 24 * hour);
  expect(await reminderStatus(id, known.id, "d1")).toBe("failed");
  expect(await reminderStatus(id, unknown.id, "d1")).toBe("sending");
  // Each run tries a known failure once, not in a loop.
  expect(recipientsOf(send).filter((to) => to === known.email)).toHaveLength(1);

  const retry = delivered();
  await run(retry, startsAt - 23 * hour - 45 * minute);
  expect(recipientsOf(retry)).toEqual([known.email]);
  expect(await reminderStatus(id, known.id, "d1")).toBe("sent");
  expect(await reminderStatus(id, unknown.id, "d1")).toBe("sending");
});

test("cancelled meetings get no reminder, and the digest schedule sends none", async () => {
  await session(f.DB);
  const cancelledAt = base();
  await meeting(cancelledAt, "cancelled");
  const send = delivered();
  await run(send, cancelledAt - 60 * minute);
  expect(send).not.toHaveBeenCalled();

  const startsAt = base();
  await meeting(startsAt);
  // A time outside the digest hours: the digest cron sends nothing at all.
  await run(send, startsAt - 60 * minute, "0 12,21 * * *");
  expect(send).not.toHaveBeenCalled();
});

test("deleting the account removes its reminders", async () => {
  const member = await session(f.DB);
  const startsAt = base();
  const id = await meeting(startsAt);
  await run(delivered(), startsAt - 60 * minute);
  expect(await reminderStatus(id, member.id, "h1")).toBe("sent");
  await f.DB.prepare("DELETE FROM users WHERE id=?").bind(member.id).run();
  expect(
    await f.DB.prepare(
      "SELECT COUNT(*) AS total FROM meeting_reminders WHERE user_id=?",
    )
      .bind(member.id)
      .first("total"),
  ).toBe(0);
});
