// @vitest-environment jsdom
import { afterEach, test, expect, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  act,
  renderHook,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { BookPage } from "../src/pages/Members";
import BookMaterials from "../src/pages/BookMaterials";
import { useData } from "../src/lib/useData";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("book recordings are filtered inside their own cycle folders", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        book: {
          id: "book",
          title: "Livro técnico",
          author: "Autor",
          description: "",
          level: "Iniciante",
          edition: "",
          categories: [],
        },
        cycles: [
          { id: "first", title: "Primeiro ciclo", is_current: 1 },
          { id: "second", title: "Releitura", is_current: 0 },
        ],
        meetings: [
          {
            id: "recorded",
            cycle_id: "first",
            title: "Busca binária",
            youtube_id: "abcdefghijk",
            starts_at: null,
            status: "completed",
          },
          {
            id: "scheduled",
            cycle_id: "first",
            title: "Próximo capítulo",
            youtube_id: null,
            starts_at: null,
            status: "scheduled",
          },
          {
            id: "revisit",
            cycle_id: "second",
            title: "Revisitando busca",
            youtube_id: "12345678901",
            starts_at: null,
            status: "completed",
          },
        ],
      }),
    ),
  );
  render(
    <MemoryRouter initialEntries={["/livros/book"]}>
      <Routes>
        <Route path="/livros/:id" element={<BookPage />} />
      </Routes>
    </MemoryRouter>,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: /Gravações \(2\)/ }),
  );
  expect(screen.queryByText("Próximo capítulo")).toBeNull();
  const folder = screen.getByRole("group", { name: /Primeiro ciclo/ });
  expect(
    within(folder)
      .getByRole("link", { name: /Busca binária/ })
      .getAttribute("href"),
  ).toBe("/encontros/recorded");
  expect(within(folder).queryByText("Revisitando busca")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Todos os encontros/ }));
  expect(await screen.findByText("Próximo capítulo")).toBeTruthy();
  expect(
    screen
      .getByRole("link", { name: /Todos os materiais por capítulo/ })
      .getAttribute("href"),
  ).toBe("/livros/book/materiais");
});

test("the materials page lists recordings and materials of every meeting, by chapter", async () => {
  const fetch = vi.fn(async () =>
    Response.json({
      book: { id: "book", title: "Livro técnico", author: "Autor" },
      meetings: [
        {
          id: "first",
          title: "Primeiro encontro",
          chapters: "Capítulos 1 e 2",
          starts_at: "2026-01-10T22:00:00Z",
          youtube_id: "abcdefghijk",
          resources: [
            {
              id: "r1",
              meeting_id: "first",
              title: "Resumo dos capítulos 1 e 2",
              url: "https://files.example.test/resumo.pdf",
              kind: "summary_pdf",
            },
          ],
        },
        {
          id: "second",
          title: "Segundo encontro",
          chapters: "",
          starts_at: "2026-01-24T22:00:00Z",
          youtube_id: null,
          resources: [
            {
              id: "r2",
              meeting_id: "second",
              title: "Slides do segundo encontro",
              url: "https://files.example.test/slides",
              kind: "slides",
            },
          ],
        },
      ],
    }),
  );
  vi.stubGlobal("fetch", fetch);
  render(
    <MemoryRouter initialEntries={["/livros/book/materiais"]}>
      <Routes>
        <Route path="/livros/:id/materiais" element={<BookMaterials />} />
      </Routes>
    </MemoryRouter>,
  );
  const first = await screen.findByRole("region", {
    name: "Capítulos 1 e 2",
  });
  expect(fetch).toHaveBeenCalledWith(
    "/api/books/book/materials",
    expect.anything(),
  );
  expect(
    within(first)
      .getByRole("link", { name: /Assistir ao encontro/ })
      .getAttribute("href"),
  ).toBe("/encontros/first");
  expect(
    within(first)
      .getByRole("link", { name: /Resumo em PDF/ })
      .getAttribute("href"),
  ).toBe("https://files.example.test/resumo.pdf");
  const second = screen.getByRole("region", { name: "Segundo encontro" });
  expect(within(second).queryByText(/Assistir ao encontro/)).toBeNull();
  expect(within(second).getByRole("link", { name: /Slides/ })).toBeTruthy();
});

test("the materials page says when nothing is published yet", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        book: { id: "book", title: "Livro técnico", author: "Autor" },
        meetings: [],
      }),
    ),
  );
  render(
    <MemoryRouter initialEntries={["/livros/book/materiais"]}>
      <Routes>
        <Route path="/livros/:id/materiais" element={<BookMaterials />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(
    await screen.findByText("Ainda não há materiais publicados."),
  ).toBeTruthy();
});

test("switching books cannot let a slow previous response overwrite the new book", async () => {
  let finishOld!: (response: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      url === "/api/books/old"
        ? new Promise<Response>((resolve) => {
            finishOld = resolve;
          })
        : Promise.resolve(Response.json({ title: "Livro novo" })),
    ),
  );
  const { result, rerender } = renderHook(
    ({ path }) => useData<{ title: string }>(path),
    { initialProps: { path: "/books/old" } },
  );
  rerender({ path: "/books/new" });
  await waitFor(() => expect(result.current.data?.title).toBe("Livro novo"));
  await act(async () => {
    finishOld(Response.json({ title: "Livro antigo" }));
  });
  expect(result.current.data?.title).toBe("Livro novo");
});
