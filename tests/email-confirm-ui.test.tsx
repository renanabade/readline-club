// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import EmailConfirm from "../src/pages/EmailConfirm";
import { EmailConfirmation } from "../src/components/EmailConfirmation";
const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  data: null as { verified: boolean } | null,
}));
vi.mock("../src/lib/api", () => ({ save: mocks.save, api: vi.fn() }));
vi.mock("../src/lib/useData", () => ({
  useData: () => ({
    data: mocks.data,
    loading: false,
    error: "",
    reload: vi.fn(),
  }),
}));
beforeEach(() => {
  mocks.save.mockReset();
  window.location.hash = "";
});
afterEach(cleanup);
const page = () =>
  render(
    <MemoryRouter>
      <EmailConfirm />
    </MemoryRouter>,
  );
test("opening the link does not confirm, one click does", async () => {
  window.location.hash = "#" + "a".repeat(64);
  mocks.save.mockResolvedValue({ ok: true });
  page();
  expect(mocks.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar meu e-mail" }));
  await waitFor(() =>
    expect(mocks.save).toHaveBeenCalledWith("/auth/verify-email", {
      token: "a".repeat(64),
    }),
  );
  expect((await screen.findByRole("status")).textContent).toContain(
    "Seu acesso ao clube está liberado",
  );
});
test("an incomplete link explains what to do and offers no button", () => {
  page();
  expect(screen.getByRole("alert").textContent).toContain("incompleto");
  expect(screen.queryByRole("button")).toBeNull();
});
test("pending accounts can ask for a new link until the email is confirmed", async () => {
  mocks.data = { verified: false };
  mocks.save.mockResolvedValue({
    message: "Enviamos um novo link para o seu e-mail.",
  });
  const { rerender } = render(<EmailConfirmation />);
  fireEvent.click(
    screen.getByRole("button", { name: "Enviar novo link de confirmação" }),
  );
  await waitFor(() =>
    expect(mocks.save).toHaveBeenCalledWith("/auth/email-verification", {}),
  );
  expect((await screen.findByRole("status")).textContent).toContain(
    "novo link",
  );
  mocks.data = { verified: true };
  rerender(<EmailConfirmation />);
  expect(screen.getByRole("status").textContent).toContain(
    "E-mail confirmado.",
  );
  expect(screen.queryByRole("button")).toBeNull();
});
