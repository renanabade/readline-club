import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
export async function fixture() {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default {fetch(){return new Response("ok")}}',
      d1Databases: ["DB"],
      compatibilityDate: "2026-09-27",
    }),
  );
  const DB = await mf.getD1Database("DB");
  for (const file of [
    "0001_initial.sql",
    "0002_initial_book.sql",
    "0003_readme_club.sql",
    "0004_technical_presentation.sql",
    "0005_readline_club.sql",
    "0006_approval_notifications.sql",
    "0007_admin_digests.sql",
    "0008_whatsapp_access_notices.sql",
    "0009_landing_copy.sql",
    "0010_first_meeting.sql",
    "0011_community_onboarding.sql",
    "0012_meeting_invitations.sql",
  ])
    for (const stmt of readFileSync("migrations/" + file, "utf8")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await DB.prepare(stmt).run();
  const env = {
    DB,
    APP_ORIGIN: "https://club.example",
    TURNSTILE_SECRET: "test-secret",
    TURNSTILE_SITE_KEY: "test-site",
    ADMIN_EMAIL: "admin@example.test",
  };
  return { mf, DB, env };
}
export async function session(
  db: D1Database,
  role = "member",
  status = "approved",
) {
  const id = crypto.randomUUID(),
    token = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO users(id,email,name,password_hash,role) VALUES(?,?,?,?,?)",
    )
    .bind(id, id + "@example.test", "Pessoa", "unused", role)
    .run();
  await db
    .prepare(
      "INSERT INTO applications(id,email,name,experience,status) VALUES(?,?,?,?,?)",
    )
    .bind(id, id + "@example.test", "Pessoa", "beginner", status)
    .run();
  await db
    .prepare(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",
    )
    .bind(
      createHash("sha256").update(token).digest("hex"),
      id,
      Date.now() + 60000,
    )
    .run();
  return { id, email: id + "@example.test", cookie: "club_session=" + token };
}
