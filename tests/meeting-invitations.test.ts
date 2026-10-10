import { beforeAll, afterAll, test, expect, vi } from "vitest";
import { fixture, session } from "./helpers";
import { createApp } from "../worker/index";
import mailer, { invitationCron } from "../worker/approval-mailer";
import {
  invitationBatchSize,
  invitationWhen,
} from "../worker/lib/meeting-invitation";
import type { AdminData } from "../shared/contracts";

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
// One run of the mailer's every-minute cron.
const drain = (send: Send, cron = invitationCron) =>
  mailer.scheduled({ cron, scheduledTime: Date.now() } as ScheduledController, {
    DB: f.DB,
    EMAIL: { send },
    EMAIL_FROM: "club@example.test",
    APP_ORIGIN: f.env.APP_ORIGIN,
    ADMIN_NOTIFY_EMAIL: "admin@example.test",
  });
async function meeting(overrides: Record<string, unknown> = {}) {
  const data = {
    id: crypto.randomUUID(),
    title: "Encontro de teste",
    chapters: "Capítulos 1 a 4",
    starts_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    status: "scheduled",
    meeting_url: "https://meet.example.test/private-call-sentinel",
    ...overrides,
  };
  await f.DB.prepare(
    "INSERT INTO meetings(id,cycle_id,title,chapters,starts_at,status,meeting_url) VALUES(?,'primeira-leitura',?,?,?,?,?)",
  )
    .bind(
      data.id,
      data.title,
      data.chapters,
      data.starts_at,
      data.status,
      data.meeting_url,
    )
    .run();
  return data;
}
const request = (
  path: string,
  cookie: string,
  testEnv: object,
  method = "POST",
  body?: unknown,
) =>
  app.request(
    "/api" + path,
    {
      method,
      headers: {
        cookie,
        origin: f.env.APP_ORIGIN,
        "content-type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    testEnv,
  );
const queue = async (id: string) => {
  const response = await request(
    `/admin/meetings/${id}/invitations`,
    admin.cookie,
    f.env,
  );
  expect(response.status).toBe(200);
  return (await response.json()) as { added: number; queued: number };
};
const queued = (id: string) =>
  f.DB.prepare(
    "SELECT COUNT(*) AS total FROM meeting_invitations WHERE meeting_id=? AND status='queued'",
  )
    .bind(id)
    .first<number>("total");
async function inviteAll(id: string, send: Send) {
  await queue(id);
  while (await queued(id)) await drain(send);
}
const recipientsOf = (send: ReturnType<typeof vi.fn<Send>>) =>
  send.mock.calls.map((call) => (call[0] as EmailMessageBuilder).to);
const invitationStatus = (meetingId: string, userId: string) =>
  f.DB.prepare(
    "SELECT status FROM meeting_invitations WHERE meeting_id=? AND user_id=?",
  )
    .bind(meetingId, userId)
    .first<string>("status");

test("queueing answers at once and the cron invites each approved member once", async () => {
  const approved = [];
  for (let i = 0; i < invitationBatchSize + 5; i++)
    approved.push(await session(f.DB));
  const optedOut = await session(f.DB);
  await f.DB.prepare("UPDATE users SET meeting_emails=0 WHERE id=?")
    .bind(optedOut.id)
    .run();
  const excluded = [
    optedOut,
    await session(f.DB, "member", "pending"),
    await session(f.DB, "member", "suspended"),
    await session(f.DB, "member", "rejected"),
    admin,
  ];
  const m = await meeting();
  const send = delivered();
  const { queued: total } = await queue(m.id);
  expect(total).toBeGreaterThanOrEqual(approved.length);
  expect(send).not.toHaveBeenCalled();
  // Overlapping cron runs claim disjoint rows.
  await Promise.all([drain(send), drain(send)]);
  await inviteAll(m.id, send);
  const recipients = recipientsOf(send);
  expect(recipients).toHaveLength(total);
  expect(new Set(recipients).size).toBe(recipients.length);
  for (const member of approved) expect(recipients).toContain(member.email);
  for (const member of excluded) expect(recipients).not.toContain(member.email);

  // Inviting again later only reaches members who were not invited yet.
  const newcomer = await session(f.DB);
  send.mockClear();
  expect((await queue(m.id)).added).toBe(1);
  await drain(send);
  expect(recipientsOf(send)).toEqual([newcomer.email]);
});

test("the digest schedule does not send invitations, and the invitation cron sends no digest", async () => {
  await session(f.DB, "member", "pending");
  const m = await meeting();
  await queue(m.id);
  const send = delivered();
  const notDigestHour = Date.UTC(2026, 9, 10, 15, 0);
  await mailer.scheduled(
    {
      cron: "0 12,21 * * *",
      scheduledTime: notDigestHour,
    } as ScheduledController,
    {
      DB: f.DB,
      EMAIL: { send },
      EMAIL_FROM: "club@example.test",
      APP_ORIGIN: f.env.APP_ORIGIN,
      ADMIN_NOTIFY_EMAIL: "admin@example.test",
    },
  );
  expect(send).not.toHaveBeenCalled();
  while (await queued(m.id)) await drain(send);
  expect(recipientsOf(send)).not.toContain("admin@example.test");
});

test("the invitation has date, confirmation, calendar links and an .ics, but no call link", async () => {
  const member = await session(f.DB);
  await f.DB.prepare("UPDATE users SET name=? WHERE id=?")
    .bind("<b>Ana</b> Teste", member.id)
    .run();
  const m = await meeting({ title: "Encontro\nespecial" });
  const send = delivered();
  await inviteAll(m.id, send);
  const message = send.mock.calls
    .map((call) => call[0] as EmailMessageBuilder)
    .find((msg) => msg.to === member.email)!;
  expect(message.from).toEqual({
    email: "club@example.test",
    name: "readline club",
  });
  expect(message.subject).toBe(
    "Encontro especial · " + invitationWhen(m.starts_at),
  );
  const confirm = f.env.APP_ORIGIN + "/encontros/" + m.id;
  expect(message.text).toContain(confirm);
  expect(message.html).toContain(confirm);
  expect(message.html).toContain(
    "https://calendar.google.com/calendar/render?",
  );
  expect(message.html).toContain("&lt;b&gt;Ana&lt;/b&gt;");
  expect(message.html).not.toContain("<b>Ana</b>");
  const attachment = message.attachments![0]!;
  expect(attachment.filename).toBe("readline-encontro.ics");
  expect(String(attachment.content)).toContain("BEGIN:VCALENDAR");
  for (const part of [message.text, message.html, String(attachment.content)])
    expect(part).not.toContain("private-call-sentinel");
});

test("known failures are retried on the next invite; unknown outcomes stay locked", async () => {
  const known = await session(f.DB);
  const unknown = await session(f.DB);
  const m = await meeting();
  const send = vi.fn<Send>(async (message) => {
    const to = (message as EmailMessageBuilder).to;
    if (to === known.email)
      throw Object.assign(new Error("private details"), {
        code: "E_DELIVERY_FAILED",
      });
    if (to === unknown.email) throw new Error("connection reset");
    return { messageId: crypto.randomUUID() };
  });
  await inviteAll(m.id, send);
  expect(await invitationStatus(m.id, known.id)).toBe("failed");
  expect(await invitationStatus(m.id, unknown.id)).toBe("sending");

  const retry = delivered();
  await drain(retry);
  expect(retry).not.toHaveBeenCalled();
  await inviteAll(m.id, retry);
  expect(recipientsOf(retry)).toEqual([known.email]);
  expect(await invitationStatus(m.id, known.id)).toBe("sent");
  expect(await invitationStatus(m.id, unknown.id)).toBe("sending");
});

test("members suspended or opted out after queueing, and meetings cancelled after queueing, are skipped", async () => {
  const suspended = await session(f.DB);
  const optedOut = await session(f.DB);
  const m = await meeting();
  const send = delivered();
  await queue(m.id);
  await f.DB.batch([
    f.DB.prepare("UPDATE applications SET status='suspended' WHERE id=?").bind(
      suspended.id,
    ),
    f.DB.prepare("UPDATE users SET meeting_emails=0 WHERE id=?").bind(
      optedOut.id,
    ),
  ]);
  while (await queued(m.id)) await drain(send);
  expect(recipientsOf(send)).not.toContain(suspended.email);
  expect(recipientsOf(send)).not.toContain(optedOut.email);
  expect(await invitationStatus(m.id, suspended.id)).toBe("skipped");

  const cancelled = await meeting();
  await queue(cancelled.id);
  await f.DB.prepare("UPDATE meetings SET status='cancelled' WHERE id=?")
    .bind(cancelled.id)
    .run();
  send.mockClear();
  await drain(send);
  expect(send).not.toHaveBeenCalled();
  expect(await queued(cancelled.id)).toBe(0);
});

test("queueing is admin-only and limited to upcoming scheduled meetings", async () => {
  const m = await meeting();
  const path = `/admin/meetings/${m.id}/invitations`;
  expect((await request(path, "", f.env)).status).toBe(401);
  expect(
    (
      await request(
        path,
        (await session(f.DB, "member", "pending")).cookie,
        f.env,
      )
    ).status,
  ).toBe(403);
  expect(
    (await request(path, (await session(f.DB)).cookie, f.env)).status,
  ).toBe(403);
  const crossSite = await app.request(
    "/api" + path,
    { method: "POST", headers: { cookie: admin.cookie } },
    f.env,
  );
  expect(crossSite.status).toBe(403);
  expect(await queued(m.id)).toBe(0);
  expect(
    (await request("/admin/meetings/missing/invitations", admin.cookie, f.env))
      .status,
  ).toBe(404);
  for (const closed of [
    await meeting({ starts_at: new Date(Date.now() - 3600000).toISOString() }),
    await meeting({ status: "cancelled" }),
  ])
    expect(
      (
        await request(
          `/admin/meetings/${closed.id}/invitations`,
          admin.cookie,
          f.env,
        )
      ).status,
    ).toBe(409);
});

test("members confirm presence and the panel shows only totals", async () => {
  const member = await session(f.DB);
  const other = await session(f.DB);
  const m = await meeting();
  const testEnv = f.env;
  const rsvp = (cookie: string, response: unknown) =>
    request(`/meetings/${m.id}/rsvp`, cookie, testEnv, "PUT", { response });
  const detail = async (cookie: string) =>
    (await (
      await app.request(
        `/api/meetings/${m.id}`,
        { headers: { cookie } },
        testEnv,
      )
    ).json()) as { rsvp: string | null };

  expect((await detail(member.cookie)).rsvp).toBeNull();
  expect((await rsvp(member.cookie, "yes")).status).toBe(200);
  expect((await detail(member.cookie)).rsvp).toBe("yes");
  expect((await rsvp(member.cookie, "no")).status).toBe(200);
  expect((await rsvp(other.cookie, "yes")).status).toBe(200);
  expect((await detail(member.cookie)).rsvp).toBe("no");
  expect((await detail(other.cookie)).rsvp).toBe("yes");

  expect((await rsvp(member.cookie, "maybe")).status).toBe(400);
  expect((await rsvp("", "yes")).status).toBe(401);
  expect(
    (await rsvp((await session(f.DB, "member", "pending")).cookie, "yes"))
      .status,
  ).toBe(403);
  const past = await meeting({
    starts_at: new Date(Date.now() - 3600000).toISOString(),
  });
  expect(
    (
      await request(
        `/meetings/${past.id}/rsvp`,
        member.cookie,
        testEnv,
        "PUT",
        {
          response: "yes",
        },
      )
    ).status,
  ).toBe(409);

  const overview = (await (
    await app.request(
      "/api/admin/overview",
      { headers: { cookie: admin.cookie } },
      testEnv,
    )
  ).json()) as AdminData;
  const totals = overview.rsvps.filter((r) => r.meeting_id === m.id);
  expect(totals).toEqual(
    expect.arrayContaining([
      { meeting_id: m.id, response: "yes", total: 1 },
      { meeting_id: m.id, response: "no", total: 1 },
    ]),
  );
  expect(JSON.stringify(overview.rsvps)).not.toContain(member.id);
});

test("members can turn meeting emails off, and deleting the account removes invitations and answers", async () => {
  const member = await session(f.DB);
  const testEnv = f.env;
  const preferences = async () =>
    (await (
      await app.request(
        "/api/auth/preferences",
        { headers: { cookie: member.cookie } },
        testEnv,
      )
    ).json()) as { meetingEmails: boolean };
  expect((await preferences()).meetingEmails).toBe(true);
  expect(
    (
      await request("/auth/preferences", member.cookie, testEnv, "PATCH", {
        meetingEmails: false,
      })
    ).status,
  ).toBe(200);
  expect((await preferences()).meetingEmails).toBe(false);
  expect((await app.request("/api/auth/preferences", {}, testEnv)).status).toBe(
    401,
  );
  expect(
    (
      await request("/auth/preferences", member.cookie, testEnv, "PATCH", {
        meetingEmails: "no",
      })
    ).status,
  ).toBe(400);

  const m = await meeting();
  await f.DB.batch([
    f.DB.prepare(
      "INSERT INTO meeting_invitations(meeting_id,user_id,status) VALUES(?,?,'sent')",
    ).bind(m.id, member.id),
    f.DB.prepare(
      "INSERT INTO meeting_rsvps(meeting_id,user_id,response,updated_at) VALUES(?,?,'yes',?)",
    ).bind(m.id, member.id, new Date().toISOString()),
  ]);
  await f.DB.prepare("DELETE FROM users WHERE id=?").bind(member.id).run();
  for (const table of ["meeting_invitations", "meeting_rsvps"])
    expect(
      await f.DB.prepare(
        `SELECT COUNT(*) AS total FROM ${table} WHERE user_id=?`,
      )
        .bind(member.id)
        .first("total"),
    ).toBe(0);
});
