import { beforeAll, afterAll, test, expect, vi } from "vitest";
import { fixture, session } from "./helpers";
import { createApp } from "../worker/index";
import mailer, { meetingEmailsCron } from "../worker/approval-mailer";
import { digest } from "../worker/auth/password";

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
const drain = (send: Send) =>
  mailer.scheduled(
    {
      cron: meetingEmailsCron,
      scheduledTime: Date.now(),
    } as ScheduledController,
    {
      DB: f.DB,
      EMAIL: { send },
      EMAIL_FROM: "club@example.test",
      APP_ORIGIN: f.env.APP_ORIGIN,
    },
  );
const call = (
  path: string,
  body: unknown,
  method = "POST",
  headers: Record<string, string> = {},
) =>
  app.request(
    "/api" + path,
    {
      method,
      headers: {
        origin: f.env.APP_ORIGIN,
        "content-type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    },
    f.env,
  );
async function meeting(startsAt = Date.now() + 7 * 86400000) {
  const id = crypto.randomUUID();
  await f.DB.prepare(
    "INSERT INTO meetings(id,cycle_id,title,chapters,starts_at,meeting_url,summary) VALUES(?,'primeira-leitura','Encontro por e-mail','Capítulo 1',?,'https://meet.example.test/private-call-sentinel','PRIVATE_NOTES_SENTINEL')",
  )
    .bind(id, new Date(startsAt).toISOString())
    .run();
  return id;
}
// Sends the real invitation through the mailer and returns each member's
// personal token, read from the link in the email.
async function invite(meetingId: string) {
  const send = vi.fn<Send>(async () => ({ messageId: crypto.randomUUID() }));
  const queued = await app.request(
    "/api/admin/meetings/" + meetingId + "/invitations",
    {
      method: "POST",
      headers: {
        cookie: admin.cookie,
        origin: f.env.APP_ORIGIN,
        "content-type": "application/json",
      },
      body: "{}",
    },
    f.env,
  );
  expect(queued.status).toBe(200);
  await drain(send);
  const tokens = new Map<string, string>();
  for (const [message] of send.mock.calls) {
    const msg = message as EmailMessageBuilder;
    const yes = /\/presenca\?resposta=sim#([0-9a-f]{64})/.exec(msg.text!);
    expect(yes, "yes link").not.toBeNull();
    expect(msg.text).toContain("/presenca?resposta=nao#" + yes![1]);
    expect(msg.html).toContain("/presenca?resposta=sim#" + yes![1]);
    tokens.set(msg.to as string, yes![1]);
  }
  return tokens;
}
const answer = (meetingId: string, userId: string) =>
  f.DB.prepare(
    "SELECT response FROM meeting_rsvps WHERE meeting_id=? AND user_id=?",
  )
    .bind(meetingId, userId)
    .first<string>("response");

test("the email link answers the RSVP without a session and reveals nothing private", async () => {
  const member = await session(f.DB);
  const id = await meeting();
  const token = (await invite(id)).get(member.email)!;
  // Only the hash is stored.
  expect(
    await f.DB.prepare(
      "SELECT rsvp_token_hash FROM meeting_invitations WHERE meeting_id=? AND user_id=?",
    )
      .bind(id, member.id)
      .first("rsvp_token_hash"),
  ).toBe(digest(token));

  const lookup = await call("/rsvp/lookup", { token });
  expect(lookup.status).toBe(200);
  const raw = await lookup.text();
  for (const hidden of [
    "private-call-sentinel",
    "PRIVATE_NOTES_SENTINEL",
    member.email,
    member.id,
    "Pessoa",
  ])
    expect(raw).not.toContain(hidden);
  const data = JSON.parse(raw);
  expect(Object.keys(data).sort()).toEqual(["meeting", "open", "rsvp"]);
  expect(Object.keys(data.meeting).sort()).toEqual(
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
  expect(data).toMatchObject({ open: true, rsvp: null });
  // Looking the link up never answers by itself.
  expect(await answer(id, member.id)).toBeNull();

  const yes = await call("/rsvp", { token, response: "yes" }, "PUT");
  expect(yes.status).toBe(200);
  expect(await answer(id, member.id)).toBe("yes");
  expect((await call("/rsvp", { token, response: "no" }, "PUT")).status).toBe(
    200,
  );
  expect(await answer(id, member.id)).toBe("no");
});

test("email links reject other origins, malformed and unknown tokens", async () => {
  const member = await session(f.DB);
  const id = await meeting();
  const token = (await invite(id)).get(member.email)!;
  const crossSite = await call("/rsvp", { token, response: "yes" }, "PUT", {
    origin: "https://evil.example.test",
  });
  expect(crossSite.status).toBe(403);
  expect(await answer(id, member.id)).toBeNull();
  expect((await call("/rsvp/lookup", { token: "abc" })).status).toBe(400);
  expect((await call("/rsvp/lookup", { token: "0".repeat(64) })).status).toBe(
    404,
  );
  expect(
    (await call("/rsvp", { token, response: "talvez" }, "PUT")).status,
  ).toBe(400);
});

test("links stop working for suspended or deleted members and after the meeting starts", async () => {
  const suspended = await session(f.DB);
  const deleted = await session(f.DB);
  const late = await session(f.DB);
  const id = await meeting();
  const tokens = await invite(id);
  await f.DB.prepare("UPDATE applications SET status='suspended' WHERE id=?")
    .bind(suspended.id)
    .run();
  await f.DB.prepare("DELETE FROM users WHERE id=?").bind(deleted.id).run();
  for (const person of [suspended, deleted]) {
    const token = tokens.get(person.email)!;
    expect((await call("/rsvp/lookup", { token })).status).toBe(404);
    expect(
      (await call("/rsvp", { token, response: "yes" }, "PUT")).status,
    ).toBe(404);
  }
  // The meeting moves to the past: the link shows it but no longer answers.
  await f.DB.prepare("UPDATE meetings SET starts_at=? WHERE id=?")
    .bind(new Date(Date.now() - 60000).toISOString(), id)
    .run();
  const token = tokens.get(late.email)!;
  const lookup = await call("/rsvp/lookup", { token });
  expect(await lookup.json()).toMatchObject({ open: false });
  expect((await call("/rsvp", { token, response: "yes" }, "PUT")).status).toBe(
    409,
  );
  expect(await answer(id, late.id)).toBeNull();
});
