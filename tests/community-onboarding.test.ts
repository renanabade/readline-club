import { test, expect } from "vitest";
import { fixture, session } from "./helpers";
import { createApp } from "../worker/index";
import type { CommunityAccess } from "../shared/contracts";

test("invites require an approved account and a persisted, explicit acknowledgment", async () => {
  const f = await fixture();
  const app = createApp();
  try {
    await f.DB.prepare(
      "UPDATE settings SET whatsapp_url='https://chat.whatsapp.com/PRIVATE',discord_url='https://discord.gg/PRIVATE' WHERE id=1",
    ).run();
    const member = await session(f.DB);
    const read = () =>
      app.request(
        "/api/community",
        { headers: { cookie: member.cookie } },
        f.env,
      );
    const acknowledge = (
      cookie: string,
      body: unknown,
      origin = f.env.APP_ORIGIN,
    ) =>
      app.request(
        "/api/community/acknowledge",
        {
          method: "POST",
          headers: { cookie, origin, "content-type": "application/json" },
          body: JSON.stringify(body),
        },
        f.env,
      );
    const before = (await (await read()).json()) as CommunityAccess;
    expect(before.onboardingRequired).toBe(true);
    expect(before.whatsapp_url).toBe("");
    expect(before.discord_url).toBe("");
    expect(before.currentBookTitle).toBe("Entendendo Algoritmos");
    expect(
      (
        await acknowledge(member.cookie, {
          version: "community-v1",
          confirmed: false,
        })
      ).status,
    ).toBe(400);
    expect(
      (await acknowledge(member.cookie, { version: "old", confirmed: true }))
        .status,
    ).toBe(400);
    expect(
      (
        await acknowledge(
          member.cookie,
          { version: "community-v1", confirmed: true },
          "https://evil.example",
        )
      ).status,
    ).toBe(403);
    const pending = await session(f.DB, "member", "pending");
    expect(
      (
        await acknowledge(pending.cookie, {
          version: "community-v1",
          confirmed: true,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await acknowledge(member.cookie, {
          version: "community-v1",
          confirmed: true,
        })
      ).status,
    ).toBe(200);
    const after = (await (await read()).json()) as CommunityAccess;
    expect(after.onboardingRequired).toBe(false);
    expect(after.whatsapp_url).toContain("PRIVATE");
    expect(after.discord_url).toBe("https://discord.gg/PRIVATE");
    expect(
      await f.DB.prepare(
        "SELECT version FROM community_onboarding WHERE user_id=?",
      )
        .bind(member.id)
        .first("version"),
    ).toBe("community-v1");
    await f.DB.prepare(
      "UPDATE applications SET status='suspended' WHERE email=?",
    )
      .bind(member.email)
      .run();
    expect((await read()).status).toBe(403);
  } finally {
    await f.mf.dispose();
  }
});

test("the next meeting tells whether there is a call link without exposing it", async () => {
  const f = await fixture();
  const app = createApp();
  try {
    const startsAt = new Date(Date.now() + 7 * 86400000).toISOString();
    await f.DB.prepare(
      "INSERT INTO meetings(id,cycle_id,title,starts_at,meeting_url) VALUES('future','primeira-leitura','Próximo',?,'https://meet.google.com/private-call-sentinel')",
    )
      .bind(startsAt)
      .run();
    const member = await session(f.DB);
    const read = async () => {
      const response = await app.request(
        "/api/community",
        { headers: { cookie: member.cookie } },
        f.env,
      );
      const raw = await response.text();
      expect(raw).not.toContain("private-call-sentinel");
      expect(raw).not.toContain("meeting_url");
      return (JSON.parse(raw) as CommunityAccess).nextMeeting;
    };
    expect(await read()).toMatchObject({ id: "future", has_call_link: true });
    await f.DB.prepare(
      "UPDATE meetings SET meeting_url='' WHERE id='future'",
    ).run();
    expect(await read()).toMatchObject({ id: "future", has_call_link: false });
  } finally {
    await f.mf.dispose();
  }
});
