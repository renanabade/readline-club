// @vitest-environment jsdom
import { afterEach, beforeEach, test, expect, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  act,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Admin from "../src/pages/Admin";
import { MemberNextMeeting } from "../src/components/MemberNextMeeting";
import App from "../src/app";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("owner tools stay inside the account page, outside the navigation bar", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      Response.json(
        url === "/api/me"
          ? {
              userId: "owner",
              name: "Admin",
              email: "admin@example.test",
              role: "admin",
              status: null,
              mustChangePassword: false,
            }
          : {
              settings: { ...settings, club_name: "readline club" },
              memberCount: 0,
              books: [],
              currentBook: null,
              turnstileSiteKey: "",
            },
      ),
    ),
  );
  render(
    <MemoryRouter initialEntries={["/conta"]}>
      <App />
    </MemoryRouter>,
  );
  expect(
    await screen.findByRole("link", { name: /Abrir administração/ }),
  ).toBeTruthy();
  expect(within(screen.getByRole("banner")).queryByText(/admin/i)).toBeNull();
  expect(
    within(screen.getByRole("banner")).getByText("readline club"),
  ).toBeTruthy();
  expect(
    within(screen.getByRole("banner")).getByRole("link", {
      name: "Minha conta",
    }),
  ).toBeTruthy();
});
beforeEach(() => {
  window.scrollTo = vi.fn();
});
const settings = {
  id: 1,
  club_name: "Clube teste",
  description: "Leitura em grupo",
  whatsapp_url: "",
  community_guidelines: "Respeito",
};
const overview = {
  applications: [],
  books: [],
  cycles: [],
  meetings: [],
  categories: [],
  resources: [],
  recordings: [],
  settings,
};

test("admin can save singleton settings from the actual editor", async () => {
  let saved = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/admin/overview") return Response.json(overview);
      if (url === "/api/admin/settings" && init?.method === "PATCH") {
        saved = true;
        expect(JSON.parse(String(init.body)).club_name).toBe(
          "Clube atualizado",
        );
        return Response.json({ ok: true });
      }
      return Response.json({ error: "Endereço inexistente" }, { status: 404 });
    }),
  );
  render(<Admin />);
  fireEvent.click(await screen.findByRole("button", { name: "O clube" }));
  fireEvent.click(screen.getByRole("button", { name: "Editar informações" }));
  fireEvent.change(screen.getByLabelText("Nome do clube"), {
    target: { value: "Clube atualizado" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(saved).toBe(true));
  expect(await screen.findByText("Conteúdo salvo.")).toBeTruthy();
});

test("administrator account starts with the required first-password screen", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      Response.json(
        url === "/api/me"
          ? {
              userId: "admin",
              name: "Organizador",
              email: "admin@example.test",
              role: "admin",
              status: null,
              mustChangePassword: true,
            }
          : {
              settings,
              memberCount: 0,
              books: [],
              currentBook: null,
              turnstileSiteKey: "",
            },
      ),
    ),
  );
  render(
    <MemoryRouter initialEntries={["/conta"]}>
      <App />
    </MemoryRouter>,
  );
  expect(
    await screen.findByRole("heading", { name: "Defina sua senha." }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("link", { name: /Abrir administração/ }),
  ).toBeNull();
});

test("moving from login to signup clears the previous form state", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      Response.json(
        url === "/api/me"
          ? null
          : {
              settings,
              memberCount: 0,
              books: [],
              currentBook: null,
              turnstileSiteKey: "",
            },
      ),
    ),
  );
  render(
    <MemoryRouter initialEntries={["/entrar"]}>
      <App />
    </MemoryRouter>,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Esqueci minha senha" }),
  );
  expect(screen.getByText(/Peça à organização/)).toBeTruthy();
  fireEvent.click(screen.getByRole("link", { name: "Venha para o clube" }));
  expect(
    await screen.findByRole("heading", { name: "Faça parte do clube." }),
  ).toBeTruthy();
  expect(screen.queryByText(/Peça à organização/)).toBeNull();
});

test("public presentation uses the club description saved by the administrator", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      Response.json(
        url === "/api/me"
          ? null
          : {
              settings,
              memberCount: 0,
              books: [],
              currentBook: null,
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
  expect(await screen.findByText("Leitura em grupo")).toBeTruthy();
  expect(screen.getByText("0 membros no clube")).toBeTruthy();
});

test("a scheduled meeting whose time has passed appears in previous meetings", async () => {
  const meetings = [
    {
      id: "past",
      title: "Encontro antigo",
      starts_at: "2000-01-01T20:00:00Z",
      duration_minutes: 60,
      status: "scheduled",
    },
    {
      id: "future",
      title: "Encontro futuro",
      starts_at: "2099-01-01T20:00:00Z",
      duration_minutes: 60,
      status: "scheduled",
    },
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      Response.json(
        url === "/api/me"
          ? {
              userId: "member",
              name: "Leitor",
              email: "member@example.test",
              role: "member",
              status: "approved",
              mustChangePassword: false,
            }
          : url === "/api/meetings"
            ? meetings
            : { settings, books: [], currentBook: null, turnstileSiteKey: "" },
      ),
    ),
  );
  render(
    <MemoryRouter initialEntries={["/agenda"]}>
      <App />
    </MemoryRouter>,
  );
  await screen.findByText("Encontro futuro");
  expect(screen.queryByText("Encontro antigo")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Encontros anteriores" }));
  expect(await screen.findByText("Encontro antigo")).toBeTruthy();
});

test("the next meeting card keeps the announcement when details arrive incomplete", async () => {
  let delivered = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      delivered = true;
      return Response.json({ resources: [] });
    }),
  );
  render(
    <MemoryRouter>
      <MemberNextMeeting
        meeting={{
          id: "future",
          title: "Encontro futuro",
          chapters: "",
          starts_at: "2099-01-01T20:00:00Z",
          duration_minutes: 60,
          status: "scheduled",
          book_title: "Livro de teste",
        }}
      />
    </MemoryRouter>,
  );
  await waitFor(() => expect(delivered).toBe(true));
  await act(async () => {});
  expect(screen.getByText("Encontro futuro")).toBeTruthy();
});

test("the member home shows the same future scheduled meeting as the public home", async () => {
  const meeting = {
    id: "future",
    title: "Encontro futuro",
    chapters: "Capítulos 1 e 2",
    starts_at: "2099-01-01T20:00:00Z",
    duration_minutes: 60,
    status: "scheduled",
    book_title: "Livro de teste",
  };
  // The meeting list and details never arrive: the announcement must not
  // depend on them.
  const pending = new Promise<Response>(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.startsWith("/api/meetings")
        ? pending
        : Response.json(
            url === "/api/me"
              ? {
                  userId: "member",
                  name: "Leitor",
                  email: "member@example.test",
                  role: "member",
                  status: "approved",
                  mustChangePassword: false,
                }
              : url === "/api/community"
                ? { onboardingRequired: true, nextMeeting: null }
                : {
                    settings,
                    memberCount: 1,
                    nextMeeting: meeting,
                    books: [],
                    currentBook: null,
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
  expect(
    await screen.findByText("Seu próximo encontro · Livro de teste"),
  ).toBeTruthy();
  expect(screen.getByText("Encontro futuro")).toBeTruthy();
  expect(
    screen.queryByText("Nenhum encontro marcado por enquanto."),
  ).toBeNull();
});
