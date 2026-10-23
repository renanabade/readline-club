// @vitest-environment jsdom
import { afterEach, test, expect, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { WhatsAppAccess } from "../src/components/WhatsAppAccess";
const state = vi.hoisted(() => ({
  user: null as null | {
    role: string;
    status: string;
    mustChangePassword: boolean;
  },
  loading: false,
}));
vi.mock("../src/lib/session", () => ({ useSession: () => state }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const renderAccess = (guidelines = false) =>
  render(
    <MemoryRouter>
      <WhatsAppAccess guidelines={guidelines} />
    </MemoryRouter>,
  );
test("visitors and unapproved accounts see approval instructions without requesting the private invitation", () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  for (const [user, heading] of [
    [null, "A conversa continua no WhatsApp e no Discord."],
    [
      { role: "member", status: "pending", mustChangePassword: false },
      "Seu cadastro está em análise.",
    ],
    [
      { role: "member", status: "suspended", mustChangePassword: false },
      "Seu acesso está suspenso.",
    ],
    [
      { role: "admin", status: "approved", mustChangePassword: true },
      "Defina sua senha para continuar.",
    ],
  ] as const) {
    state.user = user;
    renderAccess();
    expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
    expect(
      !!screen.queryByRole("link", { name: /Participe gratuitamente/ }),
    ).toBe(!user);
    expect(
      screen.queryByRole("link", { name: /Entrar no grupo do WhatsApp/ }),
    ).toBeNull();
    cleanup();
  }
  expect(fetch).not.toHaveBeenCalled();
});
test("nothing shows while the session is loading", () => {
  vi.stubGlobal("fetch", vi.fn());
  state.user = null;
  state.loading = true;
  renderAccess();
  expect(screen.queryByRole("link")).toBeNull();
  state.loading = false;
});
test("approved members see the real link; failures allow retry", async () => {
  state.user = {
    role: "member",
    status: "approved",
    mustChangePassword: false,
  };
  const invite = "https://chat.whatsapp.com/MemberInvite";
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({ error: "Temporarily unavailable" }, { status: 503 }),
    )
    .mockResolvedValueOnce(Response.json({ whatsapp_url: invite }));
  vi.stubGlobal("fetch", fetch);
  renderAccess();
  fireEvent.click(
    await screen.findByRole("button", { name: "Tentar novamente" }),
  );
  const link = await screen.findByRole("link", {
    name: /Entrar no grupo do WhatsApp/,
  });
  expect(link.getAttribute("href")).toBe(invite);
  expect(link.getAttribute("rel")).toBe("noreferrer");
  expect(fetch.mock.calls.every(([path]) => path === "/api/community")).toBe(
    true,
  );
});
test("approved readers confirm the introduction before receiving invitations", async () => {
  state.user = {
    role: "member",
    status: "approved",
    mustChangePassword: false,
  };
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        onboardingRequired: true,
        onboardingVersion: "community-v1",
        currentBookTitle: "Entendendo Algoritmos",
        nextMeeting: null,
        whatsapp_url: "",
        discord_url: "",
      }),
    )
    .mockResolvedValueOnce(Response.json({ ok: true }))
    .mockResolvedValueOnce(
      Response.json({
        onboardingRequired: false,
        whatsapp_url: "https://chat.whatsapp.com/invite",
        discord_url: "https://discord.gg/invite",
      }),
    );
  vi.stubGlobal("fetch", fetch);
  renderAccess(true);
  const button = await screen.findByRole("button", {
    name: "Confirmar e liberar os convites",
  });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByRole("link", { name: "Entrar no Discord" })).toBeNull();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(button);
  expect(
    await screen.findByRole("link", { name: "Entrar no Discord" }),
  ).toBeTruthy();
  expect(fetch.mock.calls[1][0]).toBe("/api/community/acknowledge");
});
test("the introduction points to the meeting page when the call link is set", async () => {
  state.user = {
    role: "member",
    status: "approved",
    mustChangePassword: false,
  };
  const onboarding = (has_call_link: boolean) =>
    Response.json({
      onboardingRequired: true,
      onboardingVersion: "community-v1",
      currentBookTitle: null,
      nextMeeting: {
        id: "next",
        title: "Encontro",
        chapters: "Capítulo 1",
        starts_at: new Date(Date.now() + 86400000).toISOString(),
        duration_minutes: 60,
        has_call_link,
      },
      whatsapp_url: "",
      discord_url: "",
    });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(onboarding(true)));
  renderAccess(true);
  const page = await screen.findByRole("link", { name: "página do encontro" });
  expect(page.getAttribute("href")).toBe("/encontros/next");
  expect(screen.queryByText(/será informado pelo clube/)).toBeNull();
  cleanup();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(onboarding(false)));
  renderAccess(true);
  expect(await screen.findByText(/será informado pelo clube/)).toBeTruthy();
  expect(screen.queryByRole("link", { name: "página do encontro" })).toBeNull();
});
const approved = {
  role: "member",
  status: "approved",
  mustChangePassword: false,
};
const pendingIntroduction = (discordAvailable: boolean) =>
  Response.json({
    onboardingRequired: true,
    onboardingVersion: "community-v1",
    discordAvailable,
    currentBookTitle: null,
    nextMeeting: null,
    whatsapp_url: "",
    discord_url: "",
  });
test("home and account page point to the club page until the introduction is confirmed", async () => {
  state.user = approved;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(pendingIntroduction(true)));
  renderAccess();
  const join = await screen.findByRole("link", {
    name: /Entrar no grupo do WhatsApp/,
  });
  expect(join.getAttribute("href")).toBe("/comunidade");
  expect(screen.queryByRole("checkbox")).toBeNull();
});
test("the club page keeps the confirmation next to the group button, without Discord when it is not set", async () => {
  state.user = approved;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(pendingIntroduction(false)));
  renderAccess(true);
  expect(
    await screen.findByRole("heading", { name: "Grupo do WhatsApp do clube." }),
  ).toBeTruthy();
  expect(screen.getByRole("checkbox")).toBeTruthy();
  expect(screen.queryByText(/Discord/)).toBeNull();
});
test("clicking to join a group is recorded without blocking the link", async () => {
  state.user = approved;
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        onboardingRequired: false,
        discordAvailable: false,
        whatsapp_url: "https://chat.whatsapp.com/invite",
        discord_url: "",
      }),
    )
    .mockResolvedValue(Response.json({ error: "Falhou." }, { status: 500 }));
  vi.stubGlobal("fetch", fetch);
  renderAccess(true);
  const link = await screen.findByRole("link", {
    name: /Entrar no grupo do WhatsApp/,
  });
  expect(screen.queryByRole("link", { name: /Discord/ })).toBeNull();
  link.addEventListener("click", (e) => e.preventDefault());
  fireEvent.click(link);
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect(fetch.mock.calls[1][0]).toBe("/api/community/join");
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
    channel: "whatsapp",
  });
  expect(link.getAttribute("href")).toBe("https://chat.whatsapp.com/invite");
});
