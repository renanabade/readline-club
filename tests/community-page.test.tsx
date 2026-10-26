// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../src/app";

beforeEach(() => {
  window.scrollTo = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const startsAt = new Date(Date.now() + 7 * 86400000).toISOString();
const nextMeeting = {
  id: "next",
  title: "Encontro 2",
  chapters: "Capítulos 3 e 4",
  starts_at: startsAt,
  duration_minutes: 60,
  status: "scheduled",
  book_title: "Livro teste",
};
const home = {
  memberCount: 3,
  nextMeeting,
  settings: { club_name: "Clube teste", description: "Leitura em grupo" },
  books: [],
  currentBook: null,
  turnstileSiteKey: "",
};
function visit(me: unknown) {
  const responses: Record<string, unknown> = {
    "/api/me": me,
    "/api/public/home": home,
    "/api/community": {
      onboardingRequired: false,
      whatsapp_url: "https://chat.whatsapp.com/invite",
      discord_url: "",
    },
    "/api/meetings/next": {
      meeting: { ...nextMeeting, meeting_url: "" },
      resources: [],
      rsvp: null,
    },
  };
  const fetch = vi.fn(async (url: string) =>
    url in responses
      ? Response.json(responses[url])
      : Response.json({ error: "Não encontrado." }, { status: 404 }),
  );
  vi.stubGlobal("fetch", fetch);
  render(
    <MemoryRouter initialEntries={["/comunidade"]}>
      <App />
    </MemoryRouter>,
  );
  return fetch;
}
const user = (status: string, mustChangePassword = false) => ({
  userId: "u1",
  name: "Pessoa Teste",
  email: "pessoa@example.test",
  role: "member",
  status,
  mustChangePassword,
});

test("visitors keep the sign-up and login calls", async () => {
  const fetch = visit(null);
  expect(
    await screen.findByRole("link", { name: /Participe gratuitamente/ }),
  ).toBeTruthy();
  expect(
    screen.getByRole("link", { name: /Já tenho conta · Entrar/ }),
  ).toBeTruthy();
  expect(fetch.mock.calls.some(([u]) => u === "/api/community")).toBe(false);
});

test("approved members see their next meeting and the group access instead of the calls", async () => {
  visit(user("approved"));
  expect(
    await screen.findByRole("link", { name: /Entrar no grupo do WhatsApp/ }),
  ).toBeTruthy();
  expect(screen.getByText(/Seu próximo encontro/)).toBeTruthy();
  expect(
    screen.getByRole("link", { name: /Ver pauta e materiais/ }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("link", { name: /Participe gratuitamente/ }),
  ).toBeNull();
  expect(screen.queryByRole("link", { name: /Já tenho conta/ })).toBeNull();
});

test("pending, rejected and suspended accounts see where their approval stands", async () => {
  for (const [status, title] of [
    ["pending", "Confirme seu e-mail para entrar."],
    ["rejected", "Sua inscrição não foi aprovada neste momento."],
    ["suspended", "Seu acesso está suspenso."],
  ]) {
    const fetch = visit(user(status));
    expect(await screen.findByRole("heading", { name: title })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Ver meu cadastro/ })).toBeTruthy();
    expect(
      screen.queryByRole("link", { name: /Participe gratuitamente/ }),
    ).toBeNull();
    expect(screen.queryByRole("link", { name: /Já tenho conta/ })).toBeNull();
    expect(fetch.mock.calls.some(([u]) => u === "/api/community")).toBe(false);
    cleanup();
  }
});
