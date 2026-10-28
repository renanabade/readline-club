import { beforeAll, afterAll, afterEach, test, expect, vi } from "vitest";
import { createHash } from "node:crypto";
import { fixture, session } from "./helpers";
import { createApp } from "../worker/index";
import type {
  BookMaterials,
  CommunityAccess,
  Identity,
  Meeting,
  MeetingDetail,
} from "../shared/contracts";
const app = createApp();
let f: Awaited<ReturnType<typeof fixture>>;
let fileUrl: string;
beforeAll(async () => {
  f = await fixture();
  await f.DB.batch([
    f.DB.prepare(
      "UPDATE settings SET whatsapp_url='https://chat.whatsapp.com/PRIVATE',discord_url='https://discord.gg/PRIVATE' WHERE id=1",
    ),
    f.DB.prepare(
      "INSERT INTO meetings(id,cycle_id,title,status) VALUES('gravado','primeira-leitura','Encontro gravado','completed')",
    ),
    f.DB.prepare(
      "INSERT INTO recordings(id,meeting_id,youtube_id,published) VALUES('r1','gravado','abcdefghijk',1)",
    ),
  ]);
  const key = crypto.randomUUID();
  fileUrl = f.env.APP_ORIGIN + "/api/files/" + key;
  await (f.env.FILES as unknown as R2Bucket).put(
    key,
    new TextEncoder().encode("%PDF-1.7\n%%EOF"),
    {
      httpMetadata: { contentType: "application/pdf" },
      customMetadata: { type: "pdf" },
    },
  );
  await f.DB.prepare(
    "INSERT INTO resources(id,meeting_id,title,url,kind) VALUES('m1','gravado','Resumo',?,'summary_pdf')",
  )
    .bind(fileUrl)
    .run();
});
afterAll(async () => {
  await f.mf.dispose();
});
afterEach(() => vi.unstubAllGlobals());
// A signup after access became immediate: approved, email not confirmed.
async function newSignup() {
  const member = await session(f.DB);
  await f.DB.prepare(
    "UPDATE applications SET email_confirmation_required=1 WHERE id=?",
  )
    .bind(member.id)
    .run();
  return member;
}
const get = (path: string, cookie: string) =>
  app.request(path, { headers: { cookie } }, f.env);
const json = async <T>(path: string, cookie: string) =>
  (await (await get(path, cookie)).json()) as T;
const post = (path: string, cookie: string, body: unknown) =>
  app.request(
    path,
    {
      method: "POST",
      headers: {
        cookie,
        origin: f.env.APP_ORIGIN,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
    f.env,
  );
async function acknowledged(cookie: string) {
  const { onboardingVersion } = await json<CommunityAccess>(
    "/api/community",
    cookie,
  );
  await post("/api/community/acknowledge", cookie, {
    version: onboardingVersion,
    confirmed: true,
  });
}

test("a new signup enters right away, without groups, recordings or materials", async () => {
  const member = await newSignup();
  const me = await json<Identity>("/api/me", member.cookie);
  expect(me.status).toBe("approved");
  expect(me.emailConfirmationPending).toBe(true);
  // The rest of the platform is open.
  expect((await get("/api/meetings", member.cookie)).status).toBe(200);

  await acknowledged(member.cookie);
  const community = await json<CommunityAccess>(
    "/api/community",
    member.cookie,
  );
  expect(community.emailConfirmationRequired).toBe(true);
  expect(community.onboardingRequired).toBe(false);
  expect(JSON.stringify(community)).not.toContain("PRIVATE");
  expect(community.discordAvailable).toBe(true);
  expect(
    (await post("/api/community/join", member.cookie, { channel: "whatsapp" }))
      .status,
  ).toBe(409);

  const detail = await json<MeetingDetail>(
    "/api/meetings/gravado",
    member.cookie,
  );
  expect(detail.meeting.youtube_id).toBeNull();
  expect(detail.meeting.recording_locked).toBe(true);
  expect(detail.resources).toEqual([
    expect.objectContaining({ title: "Resumo", url: "", locked: true }),
  ]);
  const list = await json<Meeting[]>("/api/meetings", member.cookie);
  expect(JSON.stringify(list)).not.toContain("abcdefghijk");
  const book = await json<{ meetings: Meeting[] }>(
    "/api/books/" + "entendendo-algoritmos",
    member.cookie,
  );
  expect(JSON.stringify(book)).not.toContain("abcdefghijk");
  const materials = await json<BookMaterials>(
    "/api/books/entendendo-algoritmos/materials",
    member.cookie,
  );
  const body = JSON.stringify(materials);
  expect(body).not.toContain("abcdefghijk");
  expect(body).not.toContain(fileUrl);
  expect(materials.meetings[0]).toMatchObject({ recording_locked: true });

  expect((await get(new URL(fileUrl).pathname, member.cookie)).status).toBe(
    403,
  );
});

test("confirming the email unlocks everything; older accounts are never locked", async () => {
  const member = await newSignup();
  await f.DB.prepare("UPDATE applications SET email_verified_at=? WHERE id=?")
    .bind(new Date().toISOString(), member.id)
    .run();
  const legacy = await session(f.DB);
  for (const { cookie } of [member, legacy]) {
    expect(
      (await json<Identity>("/api/me", cookie)).emailConfirmationPending,
    ).toBe(false);
    await acknowledged(cookie);
    const community = await json<CommunityAccess>("/api/community", cookie);
    expect(community.whatsapp_url).toContain("PRIVATE");
    expect(community.emailConfirmationRequired).toBe(false);
    const detail = await json<MeetingDetail>("/api/meetings/gravado", cookie);
    expect(detail.meeting.youtube_id).toBe("abcdefghijk");
    expect(detail.resources[0].url).toBe(fileUrl);
    expect((await get(new URL(fileUrl).pathname, cookie)).status).toBe(200);
  }
});

test("the confirmation link sends the welcome email to an account that is already in", async () => {
  const member = await newSignup();
  const token = "a".repeat(64);
  await f.DB.prepare(
    "INSERT INTO email_verifications(user_id,token_hash,expires_at,status,attempted_at) VALUES(?,?,?,'sent',?)",
  )
    .bind(
      member.id,
      createHash("sha256").update(token).digest("hex"),
      Date.now() + 60000,
      new Date().toISOString(),
    )
    .run();
  const fetch = vi.fn(async () => Response.json({ emailStatus: "sent" }));
  const env = { ...f.env, APPROVAL_EMAIL: { fetch } };
  const confirmed = await app.request(
    "/api/auth/verify-email",
    {
      method: "POST",
      headers: {
        origin: f.env.APP_ORIGIN,
        "content-type": "application/json",
      },
      body: JSON.stringify({ token }),
    },
    env,
  );
  expect(confirmed.status).toBe(200);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(fetch.mock.calls[0])).toContain(member.id);
  expect(
    (await json<Identity>("/api/me", member.cookie)).emailConfirmationPending,
  ).toBe(false);
});

test("meeting emails skip addresses that were never confirmed", async () => {
  const admin = await session(f.DB, "admin");
  const pending = await newSignup();
  const confirmed = await session(f.DB);
  await f.DB.prepare(
    "INSERT INTO meetings(id,cycle_id,title,starts_at,status) VALUES('convite','primeira-leitura','Próximo',?,'scheduled')",
  )
    .bind(new Date(Date.now() + 7 * 86400000).toISOString())
    .run();
  const queued = await app.request(
    "/api/admin/meetings/convite/invitations",
    {
      method: "POST",
      headers: { cookie: admin.cookie, origin: f.env.APP_ORIGIN },
    },
    { ...f.env, ADMIN_EMAIL: admin.email },
  );
  expect(queued.status).toBeLessThan(300);
  const invited = (
    await f.DB.prepare(
      "SELECT user_id FROM meeting_invitations WHERE meeting_id='convite'",
    ).all<{ user_id: string }>()
  ).results.map((r: { user_id: string }) => r.user_id);
  expect(invited).toContain(confirmed.id);
  expect(invited).not.toContain(pending.id);
});

test("the call link stays out of the API until the email is confirmed", async () => {
  const callUrl = "https://meet.example.test/call-link-sentinel";
  const id = crypto.randomUUID();
  await f.DB.prepare(
    "INSERT INTO meetings(id,cycle_id,title,status,starts_at,meeting_url) VALUES(?,'primeira-leitura','Próximo encontro','scheduled',?,?)",
  )
    .bind(id, new Date(Date.now() + 86400000).toISOString(), callUrl)
    .run();
  const bookId = await f.DB.prepare(
    "SELECT book_id FROM reading_cycles WHERE id='primeira-leitura'",
  ).first<string>("book_id");
  const paths = [
    "/api/meetings",
    "/api/meetings/" + id,
    "/api/books/" + bookId,
  ];
  const pending = await newSignup();
  for (const path of paths) {
    const body = await (await get(path, pending.cookie)).text();
    expect(body).not.toContain("call-link-sentinel");
  }
  const detail = await json<MeetingDetail>(
    "/api/meetings/" + id,
    pending.cookie,
  );
  expect(detail.meeting.call_locked).toBe(true);
  expect(detail.meeting.meeting_url).toBe("");
  // Confirmed accounts, accounts from before the gate and admins see it.
  const confirmed = await newSignup();
  await f.DB.prepare("UPDATE applications SET email_verified_at=? WHERE id=?")
    .bind(new Date().toISOString(), confirmed.id)
    .run();
  for (const member of [
    confirmed,
    await session(f.DB),
    await session(f.DB, "admin"),
  ])
    for (const path of paths)
      expect(await (await get(path, member.cookie)).text()).toContain(
        "call-link-sentinel",
      );
});
