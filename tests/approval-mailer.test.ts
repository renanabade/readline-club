import { beforeAll, afterAll, test, expect, vi } from "vitest";
import { fixture, session } from "./helpers";
import mailer from "../worker/approval-mailer";
let f: Awaited<ReturnType<typeof fixture>>;
beforeAll(async () => {
  f = await fixture();
});
afterAll(async () => {
  await f.mf.dispose();
});
const sendRequest = (id: string, send: SendEmail["send"]) =>
  mailer.fetch(
    new Request("https://internal/", {
      method: "POST",
      body: JSON.stringify({ applicationId: id }),
    }),
    {
      DB: f.DB,
      EMAIL: { send },
      EMAIL_FROM: "club@example.test",
      APP_ORIGIN: "https://readline.club",
    },
  );
test("concurrent notifications send once and keep the group invitation out of mail", async () => {
  const member = await session(f.DB);
  const send = vi.fn(async (_message: EmailMessage | EmailMessageBuilder) => ({
    messageId: "message-1",
  }));
  const results = await Promise.all([
    sendRequest(member.id, send),
    sendRequest(member.id, send),
  ]);
  expect(results.every((r) => r.ok)).toBe(true);
  expect(send).toHaveBeenCalledOnce();
  const message = send.mock.calls[0]![0] as EmailMessageBuilder;
  expect(message.to).toBe(member.email);
  expect(message.from).toEqual({
    email: "club@example.test",
    name: "readline club",
  });
  expect(message.text).toContain("https://readline.club/entrar");
  expect(message.html).not.toContain("chat.whatsapp.com");
  expect(
    await f.DB.prepare(
      "SELECT status FROM approval_notifications WHERE application_id=?",
    )
      .bind(member.id)
      .first("status"),
  ).toBe("sent");
  await sendRequest(member.id, send);
  expect(send).toHaveBeenCalledOnce();
});
const sentMessage = async () => {
  const member = await session(f.DB);
  const send = vi.fn(async (_message: EmailMessage | EmailMessageBuilder) => ({
    messageId: "message-" + member.id,
  }));
  await sendRequest(member.id, send);
  return send.mock.calls[0]![0] as EmailMessageBuilder & {
    text: string;
    html: string;
  };
};
test("approval email brings the next meeting, the reading and three steps in HTML and plain text", async () => {
  const meetingId = crypto.randomUUID();
  const startsAt = new Date(Date.now() + 3 * 86400000).toISOString();
  await f.DB.prepare(
    "INSERT INTO meetings(id,cycle_id,title,chapters,starts_at) VALUES(?,'primeira-leitura',?,?,?)",
  )
    .bind(meetingId, "Busca <binária>", "Capítulos 1 e 2", startsAt)
    .run();
  const message = await sentMessage();
  for (const part of [message.text, message.html]) {
    expect(part).toContain("Entendendo Algoritmos");
    expect(part).toContain("Capítulos 1 e 2");
    expect(part).toContain("horário de Brasília");
    expect(part).toContain("Entre no grupo do WhatsApp.");
    expect(part).toContain("Confirme presença no próximo encontro.");
    expect(part).toContain("Mande uma pergunta.");
  }
  expect(message.text).toContain("Busca <binária>");
  expect(message.html).toContain("Busca &lt;binária&gt;");
  expect(message.html).not.toContain("<binária>");
  expect(message.html).toContain('href="https://readline.club/comunidade"');
  // Every link of the HTML part is also in the plain text part.
  const links = [...message.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  expect(links).toContain("https://readline.club/encontros/" + meetingId);
  expect(links).toContain(
    "https://readline.club/livros/entendendo-algoritmos/materiais",
  );
  for (const link of links) expect(message.text).toContain(link);
  await f.DB.prepare("DELETE FROM meetings WHERE id=?").bind(meetingId).run();
});
test("without a scheduled meeting, approval email shows the current reading and the agenda", async () => {
  const message = await sentMessage();
  expect(message.text).toContain("Leitura atual: Entendendo Algoritmos");
  expect(message.text).not.toContain("Próximo encontro:");
  expect(message.text).toContain("https://readline.club/agenda");
  expect(message.html).toContain('href="https://readline.club/agenda"');
  expect(message.text).toContain("https://readline.club/comunidade");
  for (const part of [message.text, message.html])
    expect(part).toContain(
      "https://readline.club/livros/entendendo-algoritmos/materiais",
    );
});
test("pending and suspended applicants cannot receive approval notifications", async () => {
  const send = vi.fn();
  for (const status of ["pending", "suspended"]) {
    const member = await session(f.DB, "member", status);
    expect((await sendRequest(member.id, send)).status).toBe(409);
  }
  expect(send).not.toHaveBeenCalled();
});
test("provider failure is recorded without leaking provider details; retry is throttled", async () => {
  const member = await session(f.DB);
  const send = vi.fn(async () => {
    throw Object.assign(new Error("private details"), {
      code: "E_DELIVERY_FAILED",
    });
  });
  const response = await sendRequest(member.id, send);
  expect(await response.json()).toMatchObject({ emailStatus: "failed" });
  expect(
    await f.DB.prepare(
      "SELECT error_code FROM approval_notifications WHERE application_id=?",
    )
      .bind(member.id)
      .first("error_code"),
  ).toBe("E_DELIVERY_FAILED");
  await sendRequest(member.id, send);
  expect(send).toHaveBeenCalledOnce();
  await f.DB.prepare(
    "UPDATE approval_notifications SET attempted_at='2020-01-01' WHERE application_id=?",
  )
    .bind(member.id)
    .run();
  const success = vi.fn(async () => ({ messageId: "retry-success" }));
  expect(await (await sendRequest(member.id, success)).json()).toMatchObject({
    emailStatus: "sent",
  });
});
test("unknown delivery outcome is not retried automatically", async () => {
  const member = await session(f.DB);
  const send = vi.fn(async () => {
    throw new Error("lost connection after acceptance");
  });
  expect(await (await sendRequest(member.id, send)).json()).toMatchObject({
    emailStatus: "sending",
  });
  await sendRequest(member.id, send);
  expect(send).toHaveBeenCalledOnce();
});
