// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RsvpLink from "../src/pages/RsvpLink";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.location.hash = "";
});
const token = "a".repeat(64);
const link = (rsvp: string | null, open = true) => ({
  meeting: {
    id: "m1",
    title: "Encontro sobre grafos",
    chapters: "Capítulo 6",
    starts_at: new Date(Date.now() + 86400000).toISOString(),
    duration_minutes: 60,
    status: "scheduled",
    book_title: "Livro de teste",
  },
  rsvp,
  open,
});
function renderPage(search = "?resposta=sim") {
  window.location.hash = token;
  render(
    <MemoryRouter initialEntries={["/presenca" + search]}>
      <RsvpLink />
    </MemoryRouter>,
  );
}

test("opening the email link shows the meeting but only a click answers", async () => {
  const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
    Response.json(init?.method === "PUT" ? link("yes") : link(null)),
  );
  vi.stubGlobal("fetch", fetch);
  renderPage();
  expect(
    await screen.findByRole("heading", { name: "Encontro sobre grafos" }),
  ).toBeTruthy();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith(
    "/api/rsvp/lookup",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Vou participar" }));
  expect(await screen.findByText("Presença confirmada. Até lá!")).toBeTruthy();
  expect(fetch).toHaveBeenLastCalledWith(
    "/api/rsvp",
    expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ token, response: "yes" }),
    }),
  );
});

test("closed meetings and invalid links explain what to do", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(link(null, false))),
  );
  renderPage();
  expect(
    await screen.findByText(
      "A confirmação de presença está encerrada para este encontro.",
    ),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Vou participar" })).toBeNull();
  cleanup();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json(
        { error: "Este link de confirmação não vale mais." },
        {
          status: 404,
        },
      ),
    ),
  );
  renderPage();
  expect(
    await screen.findByText("Este link de confirmação não vale mais."),
  ).toBeTruthy();
  expect(
    screen.getByRole("link", { name: /Entrar e ver os encontros/ }),
  ).toBeTruthy();
});
