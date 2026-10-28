// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import EmailConfirm from "../src/pages/EmailConfirm";
import { routesKey } from "../src/app";
import { useSession } from "../src/lib/session";
const mocks = vi.hoisted(() => ({
  save: vi.fn(async () => ({ ok: true })),
  session: { pending: true, listeners: new Set<() => void>() },
}));
vi.mock("../src/lib/api", () => ({ save: mocks.save, api: vi.fn() }));
// A signed-in session whose access opens up once refresh() reloads it.
vi.mock("../src/lib/session", async () => {
  const { useSyncExternalStore } = await import("react");
  const { session } = mocks;
  const subscribe = (listener: () => void) => {
    session.listeners.add(listener);
    return () => session.listeners.delete(listener);
  };
  return {
    useSession: () => {
      const pending = useSyncExternalStore(subscribe, () => session.pending);
      return {
        user: { emailConfirmationPending: pending },
        home: null,
        refresh: async () => {
          session.pending = false;
          session.listeners.forEach((listener) => listener());
        },
      };
    },
  };
});
afterEach(() => {
  cleanup();
  window.location.hash = "";
  mocks.session.pending = true;
});

function AppRoutes() {
  const { user } = useSession();
  const location = useLocation();
  return (
    <Routes key={routesKey(user, location.pathname)}>
      <Route path="/confirmar-email" element={<EmailConfirm />} />
      <Route path="/" element={<p>Início</p>} />
    </Routes>
  );
}

test("confirming with an open session keeps the success message", async () => {
  window.location.hash = "#" + "a".repeat(64);
  render(
    <MemoryRouter initialEntries={["/confirmar-email"]}>
      <AppRoutes />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirmar meu e-mail" }));
  await waitFor(() => expect(mocks.session.pending).toBe(false));
  expect(
    screen.getByRole("heading", { name: "E-mail confirmado." }),
  ).toBeTruthy();
  expect(screen.getByRole("status").textContent).toContain(
    "Seu acesso ao clube está liberado",
  );
  expect(mocks.save).toHaveBeenCalledTimes(1);
});

test("other pages still mount again when the email gets confirmed", () => {
  const pending = { emailConfirmationPending: true };
  const open = { emailConfirmationPending: false };
  expect(routesKey(pending, "/biblioteca")).not.toBe(
    routesKey(open, "/biblioteca"),
  );
  expect(routesKey(pending, "/confirmar-email/")).toBe(
    routesKey(open, "/confirmar-email"),
  );
});
