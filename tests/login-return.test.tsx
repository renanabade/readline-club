// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Auth, { returnPath } from "../src/pages/Auth";
const mocks = vi.hoisted(() => ({
  save: vi.fn(async () => ({ ok: true })),
  refresh: vi.fn(async () => {}),
}));
vi.mock("../src/lib/api", () => ({ save: mocks.save, api: vi.fn() }));
vi.mock("../src/lib/session", () => ({
  useSession: () => ({ home: null, refresh: mocks.refresh }),
}));
afterEach(cleanup);

test("only same-site paths are used after login", () => {
  expect(returnPath({ from: "/encontros/primeiro?x=1" })).toBe(
    "/encontros/primeiro?x=1",
  );
  for (const state of [
    null,
    {},
    { from: 42 },
    { from: "https://evil.example.test/" },
    { from: "//evil.example.test/" },
    { from: "/\\evil.example.test/" },
    { from: "encontros/x" },
  ])
    expect(returnPath(state)).toBe("/conta");
});

function login(state?: unknown) {
  render(
    <MemoryRouter initialEntries={[{ pathname: "/entrar", state }]}>
      <Routes>
        <Route path="/entrar" element={<Auth mode="login" />} />
        <Route path="/encontros/:id" element={<p>Página do encontro</p>} />
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
  login({ from: "/encontros/primeiro" });
  expect(await screen.findByText("Página do encontro")).toBeTruthy();
});

test("logging in directly still opens the account", async () => {
  login();
  expect(await screen.findByText("Minha conta")).toBeTruthy();
});

test("protected pages remember where the visitor was going", async () => {
  const { Protected } = await import("../src/app");
  const { useLocation } = await import("react-router-dom");
  function LoginProbe() {
    return <p>{returnPath(useLocation().state)}</p>;
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
    await screen.findByText("/encontros/primeiro?origem=email"),
  ).toBeTruthy();
});
