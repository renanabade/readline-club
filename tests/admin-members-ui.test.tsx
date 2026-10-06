// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  within,
} from "@testing-library/react";
import Admin from "../src/pages/Admin";
const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  reload: vi.fn(async () => {}),
  data: {} as Record<string, unknown>,
}));
vi.mock("../src/lib/api", () => ({ save: mocks.save, api: vi.fn() }));
vi.mock("../src/lib/useData", () => ({
  useData: () => ({
    data: mocks.data,
    loading: false,
    error: "",
    reload: mocks.reload,
  }),
}));
beforeEach(() => {
  mocks.save.mockReset();
  mocks.reload.mockClear();
  mocks.data = {
    applications: [
      { id: "first", name: "Primeira pessoa", status: "pending" },
      { id: "second", name: "Segunda pessoa", status: "pending" },
      { id: "active", name: "Pessoa ativa", status: "approved" },
      { id: "suspended", name: "Pessoa suspensa", status: "suspended" },
    ].map((a) => ({
      ...a,
      email: `${a.id}@example.test`,
      created_at: "2026-09-28T12:00:00Z",
      experience: "beginner",
      motivation: "",
    })),
    books: [],
    meetings: [],
    cycles: [],
    categories: [],
    resources: [],
    recordings: [],
    settings: {},
  };
});
afterEach(cleanup);
test("accept all confirms the count and submits only the pending snapshot", async () => {
  mocks.save.mockResolvedValue({
    approved: 2,
    notified: 2,
    notificationFailures: 0,
  });
  render(<Admin />);
  fireEvent.click(screen.getByRole("button", { name: "Aceitar todos (2)" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByRole("heading").textContent).toContain(
    "Aceitar 2 cadastros pendentes",
  );
  expect(mocks.save).not.toHaveBeenCalled();
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Confirmar e aceitar todos" }),
  );
  await waitFor(() =>
    expect(mocks.save).toHaveBeenCalledWith("/admin/applications/approve-all", {
      ids: ["first", "second"],
    }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.getByRole("status").textContent).toContain(
    "2 cadastros aprovados",
  );
});
test("suspension requires confirmation and can be cancelled without changing access", async () => {
  mocks.save.mockResolvedValue({ ok: true });
  render(<Admin />);
  fireEvent.click(screen.getByRole("button", { name: "Suspender acesso" }));
  expect(mocks.save).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog").textContent).toContain("Pessoa ativa");
  fireEvent.click(
    within(screen.getByRole("dialog")).getAllByRole("button", {
      name: "Cancelar",
    })[1],
  );
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(mocks.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Suspender acesso" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar suspensão" }));
  await waitFor(() =>
    expect(mocks.save).toHaveBeenCalledWith(
      "/admin/applications/active",
      { status: "suspended" },
      "PATCH",
    ),
  );
});
test("suspended accounts offer an explicit restore action", async () => {
  mocks.save.mockResolvedValue({ ok: true, emailStatus: "sent" });
  render(<Admin />);
  fireEvent.click(
    screen.getByRole("button", { name: "Liberar acesso novamente" }),
  );
  await waitFor(() =>
    expect(mocks.save).toHaveBeenCalledWith(
      "/admin/applications/suspended",
      { status: "approved" },
      "PATCH",
    ),
  );
  expect(screen.getByRole("status").textContent).toBe(
    "Acesso liberado novamente.",
  );
});
