// @vitest-environment jsdom
import { afterEach, test, expect, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../src/app";
const home = {
  memberCount: 45,
  books: [],
  currentBook: null,
  turnstileSiteKey: "",
  settings: { club_name: "readline club", description: "Conteúdo recuperado" },
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function setup(path: string, responses: Array<Response>) {
  window.scrollTo = vi.fn();
  const fetch = vi.fn(async (url: string) =>
    url === "/api/me"
      ? Response.json(null)
      : (responses.shift() ?? Response.json(home)),
  );
  vi.stubGlobal("fetch", fetch);
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
  return fetch;
}
test("initial home automatically recovers from one temporary API failure", async () => {
  const fetch = setup("/", [
    Response.json({ error: "Unavailable" }, { status: 503 }),
    Response.json(home),
  ]);
  expect(
    await screen.findByText("Conteúdo recuperado", {}, { timeout: 3000 }),
  ).toBeTruthy();
  expect(
    fetch.mock.calls.filter(([url]) => url === "/api/public/home"),
  ).toHaveLength(2);
});
test.each(["/", "/biblioteca"])(
  "persistent home failure has an actionable retry at %s",
  async (path) => {
    setup(path, [
      Response.json({ error: "Unavailable" }, { status: 500 }),
      Response.json({ error: "Unavailable" }, { status: 500 }),
      Response.json(home),
    ]);
    const retry = await screen.findByRole(
      "button",
      { name: "Tentar novamente" },
      { timeout: 3000 },
    );
    expect(screen.queryByText("Carregando…")).toBeNull();
    fireEvent.click(retry);
    expect(
      await screen.findByText(
        path === "/" ? "Conteúdo recuperado" : "Nossa biblioteca.",
      ),
    ).toBeTruthy();
  },
);
