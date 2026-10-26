import { beforeAll, afterAll, test, expect } from "vitest";
import { fixture, session } from "./helpers";
import { createApp } from "../worker/index";
let f: Awaited<ReturnType<typeof fixture>>,
  admin: { cookie: string; id: string; email: string };
const app = createApp();
const pdf = new TextEncoder().encode("%PDF-1.7\nresumo de teste\n%%EOF");
const epub = new TextEncoder().encode(
  "PK\x03\x04\x0a\x00\x00\x00\x00\x00mimetypeapplication/epub+zip",
);
beforeAll(async () => {
  f = await fixture();
  admin = await session(f.DB, "admin");
  f.env.ADMIN_EMAIL = admin.email;
  await f.DB.prepare(
    "INSERT INTO meetings(id,cycle_id,title) VALUES('files','primeira-leitura','Com material')",
  ).run();
});
afterAll(async () => {
  await f.mf.dispose();
});
function form(
  bytes: Uint8Array<ArrayBuffer>,
  fields: Record<string, string> = {},
) {
  const body = new FormData();
  body.set("meeting_id", "files");
  body.set("title", "Resumo do encontro");
  body.set("kind", "summary_pdf");
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  body.set("file", new File([bytes], "resumo.pdf"));
  return body;
}
const send = (
  body: FormData,
  cookie = admin.cookie,
  origin = f.env.APP_ORIGIN,
) =>
  app.request(
    "/api/admin/files",
    { method: "POST", headers: { origin, cookie }, body },
    f.env,
  );
const download = (url: string, cookie?: string) =>
  app.request(
    new URL(url).pathname,
    { headers: cookie ? { cookie } : {} },
    f.env,
  );
async function uploaded(
  bytes: Uint8Array<ArrayBuffer>,
  fields?: Record<string, string>,
) {
  const r = await send(form(bytes, fields));
  expect(r.status).toBe(201);
  const { id } = (await r.json()) as { id: string };
  return (await f.DB.prepare("SELECT url,kind FROM resources WHERE id=?")
    .bind(id)
    .first<{ url: string; kind: string }>())!;
}
test("administrator uploads a PDF that only approved members can download", async () => {
  const resource = await uploaded(pdf);
  expect(resource.url).toMatch(
    new RegExp("^" + f.env.APP_ORIGIN + "/api/files/[0-9a-f-]{36}$"),
  );
  const member = await session(f.DB);
  const ok = await download(resource.url, member.cookie);
  expect(ok.status).toBe(200);
  expect(ok.headers.get("content-type")).toBe("application/pdf");
  expect(ok.headers.get("content-disposition")).toBe(
    'inline; filename="Resumo-do-encontro.pdf"',
  );
  expect(new Uint8Array(await ok.arrayBuffer())).toEqual(pdf);
  expect((await download(resource.url)).status).toBe(401);
  for (const status of ["pending", "rejected", "suspended"]) {
    const blocked = await session(f.DB, "member", status);
    expect((await download(resource.url, blocked.cookie)).status).toBe(403);
  }
});
test("EPUB files download as attachments with their own type", async () => {
  const resource = await uploaded(epub, { kind: "summary_epub" });
  expect(resource.kind).toBe("summary_epub");
  const member = await session(f.DB);
  const r = await download(resource.url, member.cookie);
  expect(r.headers.get("content-type")).toBe("application/epub+zip");
  expect(r.headers.get("content-disposition")).toMatch(
    /^attachment;.*\.epub"$/,
  );
});
test("uploads accept only PDF or EPUB content for an existing meeting", async () => {
  const html = new TextEncoder().encode("<script>alert(1)</script>");
  expect((await send(form(html))).status).toBe(400);
  expect((await send(form(pdf, { meeting_id: "missing" }))).status).toBe(400);
  expect((await send(form(pdf, { title: "" }))).status).toBe(400);
  expect((await send(form(pdf, { kind: "video" }))).status).toBe(400);
  const big = new Uint8Array(20 * 1024 * 1024 + 1);
  big.set(pdf);
  expect((await send(form(big))).status).toBe(413);
  expect(
    await f.DB.prepare(
      "SELECT COUNT(*) total FROM resources WHERE meeting_id='files'",
    ).first<number>("total"),
  ).toBe(2);
});
test("only administrators upload, and only from the club origin", async () => {
  const member = await session(f.DB);
  expect((await send(form(pdf), member.cookie)).status).toBe(403);
  expect((await send(form(pdf), "")).status).toBe(401);
  expect(
    (await send(form(pdf), admin.cookie, "https://evil.example.test")).status,
  ).toBe(403);
});
test("deleting the material removes the stored file", async () => {
  const resource = await uploaded(pdf);
  const key = new URL(resource.url).pathname.split("/").pop()!;
  const { id } = (await f.DB.prepare("SELECT id FROM resources WHERE url=?")
    .bind(resource.url)
    .first<{ id: string }>())!;
  const r = await app.request(
    "/api/admin/resources/" + id,
    {
      method: "DELETE",
      headers: { origin: f.env.APP_ORIGIN, cookie: admin.cookie },
    },
    f.env,
  );
  expect(r.status).toBe(200);
  expect(await (f.env.FILES as unknown as R2Bucket).get(key)).toBeNull();
  const member = await session(f.DB);
  expect((await download(resource.url, member.cookie)).status).toBe(404);
});
test("files are unavailable when storage is not configured", async () => {
  const r = await app.request(
    "/api/admin/files",
    {
      method: "POST",
      headers: { origin: f.env.APP_ORIGIN, cookie: admin.cookie },
      body: form(pdf),
    },
    { ...f.env, FILES: undefined },
  );
  expect(r.status).toBe(503);
});
