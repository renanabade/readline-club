import { beforeAll, afterAll, expect, test } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFileSync, existsSync } from "node:fs";
let mf: Miniflare;
let db: D1Database;
beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default {fetch(){return new Response("ok")}}',
      d1Databases: ["DB"],
      compatibilityDate: "2026-09-27",
    }),
  );
  db = await mf.getD1Database("DB");
  for (const file of ["0001_initial.sql", "0002_initial_book.sql"])
    if (existsSync("migrations/" + file)) {
      const sql = readFileSync("migrations/" + file, "utf8");
      for (const stmt of sql
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean))
        await db.prepare(stmt).run();
    }
});
afterAll(async () => {
  await mf?.dispose();
});
test("schema persists the first book without fabricated meetings or members", async () => {
  const tables = await db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all<{ name: string }>();
  expect(tables.results.map((t) => t.name)).toContain("books");
  expect(await db.prepare("SELECT count(*) n FROM books").first("n")).toBe(1);
  expect(await db.prepare("SELECT count(*) n FROM meetings").first("n")).toBe(
    0,
  );
  expect(await db.prepare("SELECT count(*) n FROM users").first("n")).toBe(0);
});
test("duplicate email cannot create a second application", async () => {
  await db
    .prepare(
      "INSERT INTO applications(id,name,email,experience) VALUES('a','Ana','ana@example.test','beginner')",
    )
    .run();
  await expect(
    db
      .prepare(
        "INSERT INTO applications(id,name,email,experience) VALUES('b','Ana','ana@example.test','beginner')",
      )
      .run(),
  ).rejects.toThrow();
});
test("meeting can have no date but must reference a real reading cycle", async () => {
  await db
    .prepare(
      "INSERT INTO meetings(id,cycle_id,title) VALUES('m','primeira-leitura','Primeiro encontro')",
    )
    .run();
  expect(
    await db
      .prepare("SELECT starts_at FROM meetings WHERE id='m'")
      .first("starts_at"),
  ).toBeNull();
  await expect(
    db
      .prepare(
        "INSERT INTO meetings(id,cycle_id,title) VALUES('bad','missing','Bad')",
      )
      .run(),
  ).rejects.toThrow();
});
