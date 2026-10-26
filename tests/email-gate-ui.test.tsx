// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  EmailGateProvider,
  EmailGateBanner,
} from "../src/components/EmailGate";
import { ResourceLink } from "../src/components/ResourceLink";
const state = vi.hoisted(() => ({
  user: null as null | Record<string, unknown>,
  refresh: vi.fn(async () => {}),
}));
vi.mock("../src/lib/session", () => ({ useSession: () => state }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const user = (emailConfirmationPending: boolean) => ({
  userId: "u1",
  email: "pessoa@example.test",
  name: "Pessoa Teste",
  role: "member",
  status: "approved",
  mustChangePassword: false,
  emailConfirmationPending,
});
const locked = {
  id: "r1",
  meeting_id: "m1",
  title: "Resumo do encontro",
  url: "",
  kind: "summary_pdf" as const,
  locked: true,
};

test("a locked material asks for the email confirmation instead of opening", async () => {
  state.user = user(true);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ verified: false })),
  );
  render(
    <EmailGateProvider>
      <EmailGateBanner />
      <ResourceLink resource={locked} />
    </EmailGateProvider>,
  );
  expect(screen.queryByRole("link")).toBeNull();
  expect(
    screen.getByText(
      "Confirme seu e-mail para liberar os grupos, as gravações e os resumos.",
    ),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Resumo do encontro/ }));
  expect(
    await screen.findByRole("dialog", {
      name: "Confirme seu e-mail para liberar.",
    }),
  ).toBeTruthy();
  expect(
    await screen.findByRole("button", {
      name: "Enviar novo link de confirmação",
    }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Já confirmei" }));
  expect(state.refresh).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("confirmed accounts see neither the banner nor the dialog", () => {
  state.user = user(false);
  render(
    <EmailGateProvider>
      <EmailGateBanner />
      <ResourceLink
        resource={{ ...locked, url: "https://club.example/f", locked: false }}
      />
    </EmailGateProvider>,
  );
  expect(screen.queryByRole("complementary")).toBeNull();
  expect(screen.getByRole("link").getAttribute("href")).toBe(
    "https://club.example/f",
  );
});
