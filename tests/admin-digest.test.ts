import { beforeAll, afterAll, test, expect, vi } from "vitest";
import { fixture, session } from "./helpers";
import { sendPendingDigest } from "../worker/lib/admin-digest";
let f: Awaited<ReturnType<typeof fixture>>;
beforeAll(async () => {
  f = await fixture();
});
afterAll(async () => {
  await f.mf.dispose();
});
const env = (send: SendEmail["send"]) => ({
  DB: f.DB,
  EMAIL: { send },
  EMAIL_FROM: "club@example.test",
  ADMIN_NOTIFY_EMAIL: "organizer@example.test",
  APP_ORIGIN: "https://readline.club",
});
test("empty queue sends no email", async () => {
  const send = vi.fn();
  expect(
    await sendPendingDigest(env(send), Date.parse("2026-10-01T12:00:00Z")),
  ).toBe("empty");
  expect(send).not.toHaveBeenCalled();
});
test("9h and 18h reminders summarize only pending members without personal details or duplicates", async () => {
  const member = await session(f.DB, "member", "pending");
  await session(f.DB, "member", "approved");
  await session(f.DB, "member", "suspended");
  const send = vi.fn(async (_message: EmailMessage | EmailMessageBuilder) => ({
    messageId: "digest-1",
  }));
  const morning = Date.parse("2026-10-01T12:00:00Z");
  await Promise.all([
    sendPendingDigest(env(send), morning),
    sendPendingDigest(env(send), morning),
  ]);
  expect(send).toHaveBeenCalledOnce();
  const message = send.mock.calls[0][0] as EmailMessageBuilder;
  expect(message.to).toBe("organizer@example.test");
  expect(message.text).toContain("1 cadastro pendente");
  expect(message.text).toContain("https://readline.club/admin");
  expect(JSON.stringify(message)).not.toContain(member.email);
  expect(
    await sendPendingDigest(env(send), Date.parse("2026-10-01T21:00:00Z")),
  ).toBe("sent");
  expect(send).toHaveBeenCalledTimes(2);
  expect(
    await sendPendingDigest(env(send), Date.parse("2026-10-01T15:00:00Z")),
  ).toBe("outside_schedule");
  expect(send).toHaveBeenCalledTimes(2);
  await f.DB.prepare(
    "UPDATE applications SET status='approved' WHERE status='pending'",
  ).run();
  expect(
    await sendPendingDigest(env(send), Date.parse("2026-10-02T12:00:00Z")),
  ).toBe("empty");
  expect(send).toHaveBeenCalledTimes(2);
});
test("failed delivery is recorded and a repeat of the slot can recover", async () => {
  await session(f.DB, "member", "pending");
  const fail = vi.fn(async () => {
    throw Object.assign(new Error("provider private detail"), {
      code: "E_DELIVERY_FAILED",
    });
  });
  const slot = Date.parse("2026-10-03T12:00:00Z");
  await expect(sendPendingDigest(env(fail), slot)).rejects.toThrow(
    "admin_digest_failed",
  );
  expect(
    await f.DB.prepare(
      "SELECT status FROM admin_digest_notifications WHERE slot=?",
    )
      .bind("2026-10-03T12")
      .first("status"),
  ).toBe("failed");
  const send = vi.fn(async () => ({ messageId: "recovered" }));
  expect(await sendPendingDigest(env(send), slot)).toBe("sent");
});
