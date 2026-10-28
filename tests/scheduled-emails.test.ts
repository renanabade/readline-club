import { beforeAll, afterAll, test, expect, vi } from "vitest";
import { fixture, session } from "./helpers";
import { createApp } from "../worker/index";
import mailer, { meetingEmailsCron } from "../worker/approval-mailer";
import type {
  ScheduledEmail,
  ScheduledEmailPreview,
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

type Send = (
  message: EmailMessage | EmailMessageBuilder,
) => Promise<EmailSendResult>;
const delivered = () =>
  vi.fn<Send>(async () => ({ messageId: crypto.randomUUID() }));
const mailerEnv = (send: Send) => ({
  DB: f.DB,
  EMAIL: { send },
  EMAIL_FROM: "club@example.test",
  APP_ORIGIN: f.env.APP_ORIGIN,
});
// One run of the mailer's every-15-minutes cron.
const drain = (send: Send) =>
  mailer.scheduled(
    {
      cron: meetingEmailsCron,
      scheduledTime: Date.now(),
    } as ScheduledController,
    mailerEnv(send),
  );
const callSentinel = "https://meet.example.test/private-call-sentinel";
async function meeting(overrides: Record<string, unknown> = {}) {
  const data = {
    id: crypto.randomUUID(),
    title: "Encontro de teste",
    starts_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    status: "scheduled",
    ...overrides,
  };
  await f.DB.prepare(
    "INSERT INTO meetings(id,cycle_id,title,chapters,starts_at,status,meeting_url) VALUES(?,'primeira-leitura',?,'Capítulos 1 a 4',?,?,?)",
  )
    .bind(data.id, data.title, data.starts_at, data.status, callSentinel)
    .run();
  return data;
}
const request = (
  path: string,
  cookie: string,
  body?: unknown,
  method = "POST",
  env: object = f.env,
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
    env,
  );
const draft = (meetingId: string) => ({
  meetingId,
  subject: "Encontro 2 no domingo",
  body: "Oi, pessoal!\n\nNos vemos no domingo.",
});
async function schedule(meetingId: string) {
  const response = await request("/admin/emails", admin.cookie, {
    ...draft(meetingId),
    sendAt: new Date(Date.now() + 3600000).toISOString(),
  });
  expect(response.status).toBe(201);
  return ((await response.json()) as { id: string }).id;
}
const makeDue = (id: string) =>
  f.DB.prepare("UPDATE scheduled_emails SET send_at=? WHERE id=?")
    .bind(new Date(Date.now() - 60000).toISOString(), id)
    .run();
const unconfirmed = async () => {
  const member = await session(f.DB);
  await f.DB.prepare(
    "UPDATE applications SET email_confirmation_required=1 WHERE id=?",
  )
    .bind(member.id)
    .run();
  return member;
};
const acceptRules = (userId: string) =>
  f.DB.prepare(
    "INSERT INTO community_onboarding(user_id,version,accepted_at) VALUES(?,'community-v1',?)",
  )
    .bind(userId, new Date().toISOString())
    .run();
const messageTo = (send: ReturnType<typeof vi.fn<Send>>, email: string) =>
  send.mock.calls
    .map((call) => call[0] as EmailMessageBuilder)
    .filter((m) => m.to === email);
const token = (text: string, path: string) =>
  text.match(
    new RegExp(path.replace("?", "\\?") + "[^#\\s]*#([0-9a-f]{64})"),
  )?.[1];
const recipient = (emailId: string, userId: string) =>
  f.DB.prepare(
    "SELECT version,status FROM scheduled_email_recipients WHERE email_id=? AND user_id=?",
  )
    .bind(emailId, userId)
    .first<{ version: string; status: string }>();

test("only admins write scheduled emails, with the site's origin", async () => {
  const m = await meeting();
  const member = await session(f.DB);
  const body = {
    ...draft(m.id),
    sendAt: new Date(Date.now() + 3600000).toISOString(),
  };
  expect((await request("/admin/emails", "", body)).status).toBe(401);
  expect((await request("/admin/emails", member.cookie, body)).status).toBe(
    403,
  );
  for (const status of ["pending", "suspended"]) {
    const other = await session(f.DB, "member", status);
    expect((await request("/admin/emails", other.cookie, body)).status).toBe(
      403,
    );
  }
  const crossSite = await app.request(
    "/api/admin/emails",
    {
      method: "POST",
      headers: {
        cookie: admin.cookie,
        origin: "https://evil.example.test",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
    f.env,
  );
  expect(crossSite.status).toBe(403);
  const total = () =>
    f.DB.prepare(
      "SELECT COUNT(*) AS total FROM scheduled_emails",
    ).first<number>("total");
  const before = await total();
  expect((await request("/admin/emails", admin.cookie, body)).status).toBe(201);
  expect(await total()).toBe(before! + 1);
});

test("the send time must be in the future and before the meeting", async () => {
  const m = await meeting();
  const at = (ms: number) => ({
    ...draft(m.id),
    sendAt: new Date(ms).toISOString(),
  });
  expect(
    (await request("/admin/emails", admin.cookie, at(Date.now() - 60000)))
      .status,
  ).toBe(400);
  expect(
    (
      await request(
        "/admin/emails",
        admin.cookie,
        at(Date.parse(m.starts_at) + 60000),
      )
    ).status,
  ).toBe(400);
  const past = await meeting({
    starts_at: new Date(Date.now() - 86400000).toISOString(),
  });
  expect(
    (
      await request("/admin/emails", admin.cookie, {
        ...draft(past.id),
        sendAt: new Date(Date.now() + 60000).toISOString(),
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await request("/admin/emails", admin.cookie, {
        ...draft(m.id),
        subject: "",
        sendAt: new Date(Date.now() + 60000).toISOString(),
      })
    ).status,
  ).toBe(400);
});

test("at the chosen time each member gets one version, once", async () => {
  const m = await meeting();
  const ready = await session(f.DB);
  await acceptRules(ready.id);
  const noRules = await session(f.DB);
  const locked = await unconfirmed();
  // Accounts from before the email gate count as confirmed.
  const legacy = await session(f.DB);
  const optedOut = await session(f.DB);
  await f.DB.prepare("UPDATE users SET meeting_emails=0 WHERE id=?")
    .bind(optedOut.id)
    .run();
  const excluded = [
    optedOut,
    await session(f.DB, "member", "pending"),
    await session(f.DB, "member", "suspended"),
    admin,
  ];
  const id = await schedule(m.id);
  const send = delivered();
  await drain(send);
  expect(messageTo(send, ready.email)).toHaveLength(0);

  await makeDue(id);
  // Overlapping cron runs claim disjoint rows.
  await Promise.all([drain(send), drain(send)]);
  await drain(send);
  const recipients = send.mock.calls.map(
    (call) => (call[0] as EmailMessageBuilder).to,
  );
  expect(new Set(recipients).size).toBe(recipients.length);
  for (const member of excluded) expect(recipients).not.toContain(member.email);
  for (const member of [ready, noRules, legacy])
    expect(await recipient(id, member.id)).toEqual({
      version: "full",
      status: "sent",
    });
  expect(await recipient(id, locked.id)).toEqual({
    version: "locked",
    status: "sent",
  });
  expect(
    await f.DB.prepare("SELECT status FROM scheduled_emails WHERE id=?")
      .bind(id)
      .first<string>("status"),
  ).toBe("done");

  const [full] = messageTo(send, ready.email);
  expect(full!.subject).toBe("Encontro 2 no domingo");
  expect(full!.text).toContain("Nos vemos no domingo.");
  expect(full!.text).toContain("/presenca?resposta=sim#");
  expect(full!.attachments?.[0]?.filename).toBe("readline-encontro.ics");
  expect(full!.text).not.toContain("combinados");
  expect(messageTo(send, noRules.email)[0]!.text).toContain("combinados");

  const [lockedMessage] = messageTo(send, locked.email);
  for (const part of [lockedMessage!.text!, lockedMessage!.html!]) {
    expect(part).not.toContain("/presenca");
    expect(part).not.toContain(callSentinel);
    expect(part).toContain("/confirmar-email#");
    expect(part).toContain("/comunidade");
  }
  expect(lockedMessage!.attachments).toBeUndefined();
});

test("the full version counts as the invitation and its buttons answer", async () => {
  const m = await meeting();
  const member = await session(f.DB);
  const id = await schedule(m.id);
  await makeDue(id);
  const send = delivered();
  await drain(send);
  const rsvp = token(messageTo(send, member.email)[0]!.text!, "/presenca?");
  expect(rsvp).toBeTruthy();
  const answer = await app.request(
    "/api/rsvp",
    {
      method: "PUT",
      headers: {
        origin: f.env.APP_ORIGIN,
        "content-type": "application/json",
      },
      body: JSON.stringify({ token: rsvp, response: "yes" }),
    },
    f.env,
  );
  expect(answer.status).toBe(200);
  expect(
    await f.DB.prepare(
      "SELECT response FROM meeting_rsvps WHERE meeting_id=? AND user_id=?",
    )
      .bind(m.id, member.id)
      .first<string>("response"),
  ).toBe("yes");
  expect(
    await f.DB.prepare(
      "SELECT status FROM meeting_invitations WHERE meeting_id=? AND user_id=?",
    )
      .bind(m.id, member.id)
      .first<string>("status"),
  ).toBe("sent");
  // "Send invitations" afterwards skips who already got the full version.
  await request(`/admin/meetings/${m.id}/invitations`, admin.cookie);
  const later = delivered();
  await drain(later);
  expect(messageTo(later, member.email)).toHaveLength(0);
});

test("the locked version's button confirms the email without another email", async () => {
  const m = await meeting();
  const member = await unconfirmed();
  const id = await schedule(m.id);
  await makeDue(id);
  const send = delivered();
  await drain(send);
  const messages = messageTo(send, member.email);
  expect(messages).toHaveLength(1);
  const confirm = token(messages[0]!.text!, "/confirmar-email");
  expect(confirm).toBeTruthy();
  const response = await app.request(
    "/api/auth/verify-email",
    {
      method: "POST",
      headers: {
        origin: f.env.APP_ORIGIN,
        "content-type": "application/json",
      },
      body: JSON.stringify({ token: confirm }),
    },
    f.env,
  );
  expect(response.status).toBe(200);
  expect(
    await f.DB.prepare("SELECT email_verified_at FROM applications WHERE id=?")
      .bind(member.id)
      .first<string | null>("email_verified_at"),
  ).toBeTruthy();
  // No invitation is recorded: "send invitations" can reach the person now.
  expect(
    await f.DB.prepare(
      "SELECT COUNT(*) AS total FROM meeting_invitations WHERE meeting_id=? AND user_id=?",
    )
      .bind(m.id, member.id)
      .first<number>("total"),
  ).toBe(0);
});

test("a cancelled email never goes out, and one already sending can't be cancelled", async () => {
  const m = await meeting();
  const member = await session(f.DB);
  const cancelled = await schedule(m.id);
  expect(
    (
      await request(
        `/admin/emails/${cancelled}`,
        admin.cookie,
        undefined,
        "DELETE",
      )
    ).status,
  ).toBe(200);
  await makeDue(cancelled);
  const started = await schedule(m.id);
  await makeDue(started);
  const send = delivered();
  await drain(send);
  expect(await recipient(cancelled, member.id)).toBeNull();
  expect((await recipient(started, member.id))?.status).toBe("sent");
  expect(
    (
      await request(
        `/admin/emails/${started}`,
        admin.cookie,
        undefined,
        "DELETE",
      )
    ).status,
  ).toBe(409);
  const list = (await (
    await request(
      `/admin/meetings/${m.id}/emails`,
      admin.cookie,
      undefined,
      "GET",
    )
  ).json()) as ScheduledEmail[];
  expect(list.find((e) => e.id === cancelled)?.status).toBe("cancelled");
  const sent = list.find((e) => e.id === started)!;
  expect(sent.status).toBe("done");
  expect(sent.totals.some((t) => t.status === "sent" && t.total > 0)).toBe(
    true,
  );
});

test("the test send reaches only the admin, with both versions, and records nothing", async () => {
  const m = await meeting();
  const send = delivered();
  // The API reaches the mailer through the service binding.
  const env = {
    ...f.env,
    APPROVAL_EMAIL: {
      fetch: (url: string, init: RequestInit) =>
        mailer.fetch(new Request(url, init), mailerEnv(send)),
    },
  };
  const response = await request(
    "/admin/emails/test",
    admin.cookie,
    draft(m.id),
    "POST",
    env,
  );
  expect(response.status).toBe(200);
  const messages = send.mock.calls.map((c) => c[0] as EmailMessageBuilder);
  expect(messages.map((msg) => msg.to)).toEqual([admin.email, admin.email]);
  expect(messages.map((msg) => msg.subject)).toEqual([
    "[Teste · completa] Encontro 2 no domingo",
    "[Teste · sem link] Encontro 2 no domingo",
  ]);
  expect(messages[1]!.text).not.toContain("/presenca");
  const count = (table: string) =>
    f.DB.prepare(`SELECT COUNT(*) AS total FROM ${table} WHERE user_id=?`)
      .bind(admin.id)
      .first<number>("total");
  for (const table of [
    "scheduled_email_recipients",
    "meeting_invitations",
    "email_verifications",
  ])
    expect(await count(table)).toBe(0);
  const member = await session(f.DB);
  expect(
    (
      await request(
        "/admin/emails/test",
        member.cookie,
        draft(m.id),
        "POST",
        env,
      )
    ).status,
  ).toBe(403);
});

test("the preview shows both versions and how many get each", async () => {
  const m = await meeting();
  await unconfirmed();
  const response = await request(
    "/admin/emails/preview",
    admin.cookie,
    draft(m.id),
  );
  expect(response.status).toBe(200);
  const preview = (await response.json()) as ScheduledEmailPreview;
  expect(preview.full.text).toContain("/presenca?resposta=sim");
  expect(preview.locked.text).not.toContain("/presenca");
  expect(preview.locked.text).toContain("/confirmar-email");
  expect(preview.recipients.locked).toBeGreaterThan(0);
  expect(preview.recipients.full).toBeGreaterThan(0);
});
