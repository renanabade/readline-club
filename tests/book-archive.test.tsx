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
