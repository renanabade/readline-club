// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Account } from "../src/pages/Members";
const state = vi.hoisted(() => ({
  user: null as null | Record<string, unknown>,
  refresh: vi.fn(async () => {}),
}));
vi.mock("../src/lib/session", () => ({ useSession: () => state }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const user = (role: string, status: string) => ({
  userId: "u1",
  email: "pessoa@example.test",
  name: "Pessoa Teste",
  role,
  status,
  mustChangePassword: false,
});
function renderAccount() {
  render(
    <MemoryRouter initialEntries={["/conta"]}>
      <Routes>
        <Route path="/conta" element={<Account />} />
        <Route path="/" element={<p>Página inicial</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

test("the administrator account has no self-deletion form", () => {
  state.user = user("admin", "approved");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({})),
  );
  renderAccount();
  expect(
    screen.queryByRole("heading", { name: "Excluir minha conta" }),
  ).toBeNull();
});

test("members confirm with their password and leave the account area", async () => {
  state.user = user("member", "pending");
  const fetch = vi.fn(async () => Response.json({ ok: true }));
  vi.stubGlobal("fetch", fetch);
  renderAccount();
  const form = screen
    .getByRole("heading", { name: "Excluir minha conta" })
    .closest("form")!;
  fireEvent.change(form.querySelector("input[type=password]")!, {
    target: { value: "account-password-123" },
  });
  fireEvent.click(form.querySelector("input[type=checkbox]")!);
  fireEvent.submit(form);
  expect(await screen.findByText("Página inicial")).toBeTruthy();
  expect(fetch).toHaveBeenCalledWith(
    "/api/auth/account/delete",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ password: "account-password-123" }),
    }),
  );
  expect(state.refresh).toHaveBeenCalled();
});
