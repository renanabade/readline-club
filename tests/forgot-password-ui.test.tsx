// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
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
  save: vi.fn(async () => ({
    ok: true,
    message: "Se houver uma conta com este e-mail, enviamos um link.",
  })),
  action: "",
}));
vi.mock("../src/lib/api", () => ({ save: mocks.save, api: vi.fn() }));
vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    user: null,
    home: { turnstileSiteKey: "site-key" },
    refresh: vi.fn(),
  }),
}));
// The challenge is solved at once, and the action it was rendered with is kept.
vi.mock("../src/components/Turnstile", async () => {
  const { useEffect } = await import("react");
  return {
    Turnstile: ({
      onToken,
      action,
    }: {
      onToken: (t: string) => void;
      action?: string;
    }) => {
      useEffect(() => {
        mocks.action = action ?? "signup";
        onToken("challenge-token");
      }, [onToken, action]);
      return null;
    },
  };
});
afterEach(cleanup);
test("forgot password sends the email with its own challenge and shows the same answer", async () => {
  render(
    <MemoryRouter>
      <Auth mode="forgot" />
    </MemoryRouter>,
  );
  expect(screen.queryByLabelText("Senha")).toBeNull();
  fireEvent.change(screen.getByLabelText("E-mail"), {
    target: { value: "pessoa@example.test" },
  });
  const button = screen.getByRole("button", { name: /Enviar link/ });
  await waitFor(() => expect(button).toHaveProperty("disabled", false));
  expect(mocks.action).toBe("reset");
  fireEvent.click(button);
  await waitFor(() =>
    expect(mocks.save).toHaveBeenCalledWith("/auth/forgot", {
      email: "pessoa@example.test",
      turnstileToken: "challenge-token",
    }),
  );
  expect((await screen.findByRole("status")).textContent).toContain(
    "Se houver uma conta com este e-mail",
  );
});
