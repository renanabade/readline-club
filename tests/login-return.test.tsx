// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import Auth, { returnPath } from "../src/pages/Auth";
import { Protected } from "../src/app";
const mocks = vi.hoisted(() => ({
  save: vi.fn(async () => ({ ok: true })),
  refresh: vi.fn(async () => {}),
}));
vi.mock("../src/lib/api", () => ({ save: mocks.save, api: vi.fn() }));
vi.mock("../src/lib/session", () => ({
  useSession: () => ({ user: null, home: null, refresh: mocks.refresh }),
}));
afterEach(cleanup);

test("only same-site paths are used after login", () => {
  expect(returnPath("/encontros/primeiro?x=1")).toBe("/encontros/primeiro?x=1");
  for (const voltar of [
    null,
    "",
    "https://evil.example.test/",
    "//evil.example.test/",
    "/\\evil.example.test/",
    "encontros/x",
  ])
    expect(returnPath(voltar)).toBe("/");
});

function login(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/entrar" element={<Auth mode="login" />} />
        <Route path="/encontros/:id" element={<p>Página do encontro</p>} />
        <Route path="/" element={<p>Início</p>} />
        <Route path="/conta" element={<p>Minha conta</p>} />
      </Routes>
    </MemoryRouter>,
  );
  const form = document.querySelector("form")!;
  fireEvent.change(form.querySelector("input[type=email]")!, {
    target: { value: "pessoa@example.test" },
  });
  fireEvent.change(form.querySelector("input[type=password]")!, {
    target: { value: "a-long-password-123" },
  });
  fireEvent.submit(form);
}

test("logging in from an invitation link returns to the meeting", async () => {
  login("/entrar?voltar=%2Fencontros%2Fprimeiro");
  expect(await screen.findByText("Página do encontro")).toBeTruthy();
});

test("logging in directly opens the home page", async () => {
  login("/entrar");
  expect(await screen.findByText("Início")).toBeTruthy();
});

test("an external return address falls back to the home page", async () => {
  login("/entrar?voltar=%2F%2Fevil.example.test%2F");
  expect(await screen.findByText("Início")).toBeTruthy();
});

test("protected pages send visitors to login with the way back", async () => {
  function LoginProbe() {
    const { pathname, search } = useLocation();
    return <p>{pathname + search}</p>;
  }
  render(
    <MemoryRouter initialEntries={["/encontros/primeiro?origem=email"]}>
      <Routes>
        <Route
          path="/encontros/:id"
          element={
            <Protected>
              <p>Conteúdo</p>
            </Protected>
          }
        />
        <Route path="/entrar" element={<LoginProbe />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(
    await screen.findByText(
      "/entrar?voltar=%2Fencontros%2Fprimeiro%3Forigem%3Demail",
    ),
  ).toBeTruthy();
});
