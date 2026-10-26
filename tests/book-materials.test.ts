import { beforeAll, afterAll, test, expect } from "vitest";
import { createApp } from "../worker/index";
import { fixture, session } from "./helpers";
import type { BookMaterials } from "../shared/contracts";

const app = createApp();
let f: Awaited<ReturnType<typeof fixture>>;
beforeAll(async () => {
  f = await fixture();
  // Seeded book and cycle: 'entendendo-algoritmos' / 'primeira-leitura'.
  await f.DB.batch([
    f.DB.prepare(
      "INSERT INTO books(id,title,author,status) VALUES('other-book','Outro livro','Autor','planned'),('archived-book','Livro arquivado','Autor','archived')",
    ),
    f.DB.prepare(
      "INSERT INTO reading_cycles(id,book_id,title,is_current) VALUES('other-cycle','other-book','Outro ciclo',0),('archived-cycle','archived-book','Ciclo arquivado',0)",
    ),
    f.DB.prepare(
      "INSERT INTO meetings(id,cycle_id,title,chapters,starts_at,status,agenda,meeting_url) VALUES" +
        "('m-second','primeira-leitura','Segundo','Capítulos 3 e 4','2026-02-10T22:00:00Z','completed','AGENDA_SENTINEL','https://call.example.test/private')," +
        "('m-first','primeira-leitura','Primeiro','Capítulos 1 e 2','2026-01-10T22:00:00Z','completed','','')," +
        "('m-hidden','primeira-leitura','Sem nada publicado','Capítulo 5','2026-03-10T22:00:00Z','completed','','')," +
        "('m-other','other-cycle','Outro encontro','','2026-01-01T22:00:00Z','completed','','')," +
        "('m-archived','archived-cycle','Encontro arquivado','','2026-01-01T22:00:00Z','completed','','')",
    ),
    f.DB.prepare(
      "INSERT INTO recordings(id,meeting_id,youtube_id,published) VALUES('rec-first','m-first','abcdefghijk',1),('rec-hidden','m-hidden','unpublished',0)",
    ),
    f.DB.prepare(
      "INSERT INTO resources(id,meeting_id,title,url,kind) VALUES" +
        "('slides','m-first','Slides 1 e 2','https://files.example.test/slides','slides')," +
        "('pdf','m-first','Resumo 1 e 2','https://files.example.test/resumo.pdf','summary_pdf')," +
        "('epub','m-second','Resumo 3 e 4','https://files.example.test/resumo.epub','summary_epub')," +
        "('other','m-other','Material de outro livro','https://files.example.test/other','link')," +
        "('archived','m-archived','Material arquivado','https://files.example.test/archived','link')",
    ),
  ]);
});
afterAll(async () => {
  await f.mf.dispose();
});
const path = "/api/books/entendendo-algoritmos/materials";

test("only approved members and the administrator read the materials page", async () => {
  expect((await app.request(path, {}, f.env)).status).toBe(401);
  for (const status of ["pending", "suspended", "rejected"]) {
    const s = await session(f.DB, "member", status);
    expect(
      (await app.request(path, { headers: { cookie: s.cookie } }, f.env))
        .status,
    ).toBe(403);
  }
  for (const s of [await session(f.DB), await session(f.DB, "admin")])
    expect(
      (await app.request(path, { headers: { cookie: s.cookie } }, f.env))
        .status,
    ).toBe(200);
});

test("the materials page lists what each meeting of the book published, in order", async () => {
  const member = await session(f.DB);
  const response = await app.request(
    path,
    { headers: { cookie: member.cookie } },
    f.env,
  );
  const body = (await response.json()) as BookMaterials;
  expect(body.book).toEqual({
    id: "entendendo-algoritmos",
    title: "Entendendo Algoritmos",
    author: expect.any(String),
  });
  expect(body.meetings.map((m) => m.id)).toEqual(["m-first", "m-second"]);
  const [first, second] = body.meetings;
  expect(first).toMatchObject({
    chapters: "Capítulos 1 e 2",
    youtube_id: "abcdefghijk",
  });
  expect(first!.resources.map((r) => r.id)).toEqual(["pdf", "slides"]);
  expect(second!.youtube_id).toBeNull();
  expect(second!.resources.map((r) => r.id)).toEqual(["epub"]);
  // Unpublished recordings, other books and private meeting fields stay out.
  const raw = JSON.stringify(body);
  for (const hidden of [
    "unpublished",
    "Material de outro livro",
    "AGENDA_SENTINEL",
    "call.example.test",
  ])
    expect(raw).not.toContain(hidden);
});

test("archived and unknown books have no materials page", async () => {
  const member = await session(f.DB);
  for (const id of ["archived-book", "missing"])
    expect(
      (
        await app.request(
          `/api/books/${id}/materials`,
          { headers: { cookie: member.cookie } },
          f.env,
        )
      ).status,
    ).toBe(404);
});
