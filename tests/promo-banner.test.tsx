// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../src/app";
import { instance } from "../src/instance";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});
function renderHome() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      Response.json(
        url === "/api/me"
          ? null
          : {
              settings: {
                club_name: "readline club",
                description: "Um clube.",
              },
              memberCount: 0,
              books: [],
              currentBook: null,
              nextMeeting: null,
              turnstileSiteKey: "",
            },
      ),
    ),
  );
  render(
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>,
  );
}

test.runIf(instance.promo)(
  "the promo banner closes and stays closed for that promotion",
  () => {
    renderHome();
    const banner = () =>
      screen.queryByRole("complementary", {
        name: "Conheça o " + instance.promo!.name,
      });
    expect(banner()).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Fechar aviso" }));
    expect(banner()).toBeNull();
    cleanup();
    renderHome();
    expect(banner()).toBeNull();
    // A different promotion is shown again.
    localStorage.setItem("club-promo-closed", "outra divulgação");
    cleanup();
    renderHome();
    expect(banner()).toBeTruthy();
  },
);
