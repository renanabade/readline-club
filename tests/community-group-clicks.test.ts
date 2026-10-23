import { afterAll, beforeAll, expect, test } from "vitest";
import { fixture, session } from "./helpers";
import { createApp } from "../worker/index";
import type { AdminData, CommunityAccess } from "../shared/contracts";

const app = createApp();
let f: Awaited<ReturnType<typeof fixture>>;
beforeAll(async () => {
  f = await fixture();
  await f.DB.prepare(
    "UPDATE settings SET whatsapp_url='https://chat.whatsapp.com/PRIVATE',discord_url='' WHERE id=1",
  ).run();
});
afterAll(async () => {
  await f.mf.dispose();
});
const join = (cookie: string, body: unknown, origin = f.env.APP_ORIGIN) =>
  app.request(
    "/api/community/join",
    {
      method: "POST",
      headers: { cookie, origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    f.env,
  );
const acknowledge = (cookie: string) =>
  app.request(
    "/api/community/acknowledge",
    {
      method: "POST",
      headers: {
        cookie,
        origin: f.env.APP_ORIGIN,
        "content-type": "application/json",
      },
      body: JSON.stringify({ version: "community-v1", confirmed: true }),
    },
    f.env,
  );
async function clicks(userId: string) {
  const rows = await f.DB.prepare(
    "SELECT channel,clicked_at FROM community_group_clicks WHERE user_id=? ORDER BY channel",
  )
    .bind(userId)
    .all<{ channel: string; clicked_at: string }>();
  return rows.results;
}

test("only approved members who confirmed the introduction record a click, once per group", async () => {
  expect(
    (await app.request("/api/community/join", { method: "POST" }, f.env))
      .status,
  ).toBe(403);
  const visitor = await app.request(
    "/api/community/join",
    {
      method: "POST",
      headers: {
        origin: f.env.APP_ORIGIN,
        "content-type": "application/json",
      },
      body: JSON.stringify({ channel: "whatsapp" }),
    },
    f.env,
  );
  expect(visitor.status).toBe(401);
  const pending = await session(f.DB, "member", "pending");
  expect((await join(pending.cookie, { channel: "whatsapp" })).status).toBe(
    403,
  );
  const member = await session(f.DB);
  expect((await join(member.cookie, { channel: "whatsapp" })).status).toBe(409);
  expect(await clicks(member.id)).toEqual([]);
  expect((await acknowledge(member.cookie)).status).toBe(200);
  expect((await join(member.cookie, { channel: "telegram" })).status).toBe(400);
  expect(
    (
      await join(
        member.cookie,
        { channel: "whatsapp" },
        "https://evil.example.test",
      )
    ).status,
  ).toBe(403);
  expect((await join(member.cookie, { channel: "whatsapp" })).status).toBe(200);
  const [first] = await clicks(member.id);
  expect((await join(member.cookie, { channel: "whatsapp" })).status).toBe(200);
  expect(await clicks(member.id)).toEqual([first]);
  expect(first.channel).toBe("whatsapp");
});

test("the panel gets only totals, and deleting the account removes the clicks", async () => {
  const admin = await session(f.DB, "admin");
  f.env.ADMIN_EMAIL = admin.email;
  const before = await app.request(
    "/api/admin/overview",
    { headers: { cookie: admin.cookie } },
    f.env,
  );
  const base = ((await before.json()) as AdminData).communityFunnel;
  const member = await session(f.DB);
  await acknowledge(member.cookie);
  await join(member.cookie, { channel: "whatsapp" });
  await join(member.cookie, { channel: "discord" });
  const response = await app.request(
    "/api/admin/overview",
    { headers: { cookie: admin.cookie } },
    f.env,
  );
  const funnel = ((await response.json()) as AdminData).communityFunnel;
  expect(funnel).toEqual({
    acknowledged: base.acknowledged + 1,
    whatsapp: base.whatsapp + 1,
    discord: base.discord + 1,
  });
  await f.DB.prepare("DELETE FROM users WHERE id=?").bind(member.id).run();
  expect(await clicks(member.id)).toEqual([]);
});

test("Discord stays out until an invitation is set, without revealing it early", async () => {
  const member = await session(f.DB);
  const read = async () =>
    (await (
      await app.request(
        "/api/community",
        { headers: { cookie: member.cookie } },
        f.env,
      )
    ).json()) as CommunityAccess;
  expect((await read()).discordAvailable).toBe(false);
  await f.DB.prepare(
    "UPDATE settings SET discord_url='https://discord.gg/PRIVATE' WHERE id=1",
  ).run();
  const before = await read();
  expect(before.discordAvailable).toBe(true);
  expect(before.discord_url).toBe("");
  await acknowledge(member.cookie);
  expect((await read()).discord_url).toBe("https://discord.gg/PRIVATE");
  await f.DB.prepare("UPDATE settings SET discord_url='' WHERE id=1").run();
});
