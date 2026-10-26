// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Auth from "../src/pages/Auth";
const mocks = vi.hoisted(() => ({
  save: vi.fn(async (_path: string, _body: object) => ({ ok: true })),
}));
vi.mock("../src/lib/api", () => ({ save: mocks.save, api: vi.fn() }));
vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    user: null,
    home: { turnstileSiteKey: "site-key" },
    refresh: vi.fn(),
  }),
}));
vi.mock("../src/components/Turnstile", async () => {
  const { useEffect } = await import("react");
  return {
    Turnstile: ({ onToken }: { onToken: (t: string) => void }) => {
      useEffect(() => onToken("challenge-token"), [onToken]);
      return null;
    },
  };
});
beforeEach(() => mocks.save.mockClear());
afterEach(cleanup);
function renderSignup() {
  render(
    <MemoryRouter>
      <Auth mode="signup" />
    </MemoryRouter>,
  );
}
function fill(password: string, confirm: string) {
  const values: [RegExp, string][] = [
    [/^Seu nome/, "Ana Leitora"],
    [/^E-mail/, "ana@example.test"],
    [/^Celular com DDD/, "(11) 91234-5678"],
    [/^Senha/, password],
    [/^Confirme a senha/, confirm],
    [/^Como está sua jornada/, "learning"],
  ];
  for (const [label, value] of values)
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole("checkbox", { name: /Concordo/ }));
}
async function send() {
  const button = screen.getByRole("button", { name: /Enviar meu cadastro/ });
  await waitFor(() => expect(button).toHaveProperty("disabled", false));
  fireEvent.click(button);
}
test("signup explains what it asks for and shows the password rules up front", () => {
  renderSignup();
  expect(document.body.textContent).toContain(
    "Pedimos nome, e-mail, celular e uma senha",
  );
  const password = screen.getByLabelText(/^Senha/);
  const rules = document.getElementById(
    password.getAttribute("aria-describedby") ?? "",
  );
  expect(rules?.textContent).toContain("10 a 128 caracteres");
  expect(screen.queryByRole("alert")).toBeNull();
});
test("experience starts empty and is required", () => {
  renderSignup();
  const select = screen.getByLabelText(/^Como está sua jornada/);
  expect(select).toHaveProperty("value", "");
  expect(select).toHaveProperty("required", true);
});
test("show password reveals both password fields", () => {
  renderSignup();
  const password = screen.getByLabelText(/^Senha/);
  const confirm = screen.getByLabelText("Confirme a senha");
  expect(password.getAttribute("type")).toBe("password");
  fireEvent.click(screen.getByLabelText("Mostrar senha"));
  expect(password.getAttribute("type")).toBe("text");
  expect(confirm.getAttribute("type")).toBe("text");
});
test("mismatched passwords are not sent and focus goes to the confirmation", async () => {
  renderSignup();
  fill("uma-senha-forte-123", "outra-senha-123");
  await send();
  const confirm = screen.getByLabelText("Confirme a senha");
  expect(screen.getByRole("alert").textContent).toContain(
    "As senhas não conferem",
  );
  expect(document.activeElement).toBe(confirm);
  expect(confirm.getAttribute("aria-invalid")).toBe("true");
  expect(confirm.getAttribute("aria-describedby")).toBe("form-error");
  expect(mocks.save).not.toHaveBeenCalled();
});
test("matching passwords send the signup without the confirmation", async () => {
  renderSignup();
  fill("uma-senha-forte-123", "uma-senha-forte-123");
  await send();
  await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
  const [path, body] = mocks.save.mock.calls[0];
  expect(path).toBe("/auth/register");
  expect(body).toMatchObject({
    password: "uma-senha-forte-123",
    experience: "learning",
    consent: true,
  });
  expect(body).not.toHaveProperty("passwordConfirm");
  const status = await screen.findByRole("status");
  expect(status.textContent).toContain("a senha que você acabou de criar");
  expect(status.textContent).not.toContain("use sua senha anterior");
});
test("a server error takes the focus to its message", async () => {
  mocks.save.mockRejectedValueOnce(
    new Error("Conte como está sua jornada na computação."),
  );
  renderSignup();
  fill("uma-senha-forte-123", "uma-senha-forte-123");
  await send();
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Conte como está sua jornada");
  await waitFor(() =>
    expect(document.activeElement).toBe(document.getElementById("form-error")),
  );
});
