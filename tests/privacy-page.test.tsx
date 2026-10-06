// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../src/app";
import { instance } from "../src/instance";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function renderAt(path: string) {
  window.scrollTo = vi.fn();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      Response.json(
        url === "/api/me"
          ? null
          : {
              settings: { club_name: "Clube teste", description: "Leitura" },
              memberCount: 0,
              nextMeeting: null,
              books: [],
              currentBook: null,
              turnstileSiteKey: "",
            },
      ),
    ),
  );
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

test("visitors can read the privacy policy with the configured contact", async () => {
  renderAt("/privacidade");
  expect(
    await screen.findByRole("heading", {
      name: "Como cuidamos dos seus dados.",
    }),
  ).toBeTruthy();
  const contacts = screen.getAllByRole("link", {
    name: instance.privacy.contact,
  });
  expect(contacts[0].getAttribute("href")).toBe(
    "mailto:" + instance.privacy.contact,
  );
  expect(
    within(screen.getByRole("main")).getByText(
      new RegExp(instance.privacy.controller),
    ),
  ).toBeTruthy();
});

test("the footer links to the privacy policy on every page", async () => {
  renderAt("/");
  const footer = await screen.findByRole("contentinfo");
  expect(
    within(footer)
      .getByRole("link", { name: "Privacidade" })
      .getAttribute("href"),
  ).toBe("/privacidade");
});
