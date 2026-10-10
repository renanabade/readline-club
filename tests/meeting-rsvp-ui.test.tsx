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
import { MeetingRsvp } from "../src/components/MeetingRsvp";
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
const upcoming = {
  id: "meeting-1",
  status: "scheduled" as const,
  starts_at: new Date(Date.now() + 86400000).toISOString(),
};
const user = (role: string, status: string) => ({
  userId: "u1",
  email: "pessoa@example.test",
  name: "Pessoa Teste",
  role,
  status,
  mustChangePassword: false,
});

test("members confirm presence and can change the answer", async () => {
  const fetch = vi.fn(async (_url: string, init: RequestInit) =>
    Response.json({ rsvp: JSON.parse(String(init.body)).response }),
  );
  vi.stubGlobal("fetch", fetch);
  render(<MeetingRsvp meeting={upcoming} initial={null} />);
  const yes = screen.getByRole("button", { name: "Vou participar" });
  expect(yes.getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(yes);
  expect(await screen.findByText("Presença confirmada. Até lá!")).toBeTruthy();
  expect(yes.getAttribute("aria-pressed")).toBe("true");
  expect(fetch).toHaveBeenCalledWith(
    "/api/meetings/meeting-1/rsvp",
    expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ response: "yes" }),
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Não vou poder" }));
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Não vou poder" })
        .getAttribute("aria-pressed"),
    ).toBe("true"),
  );
});

test("past and cancelled meetings do not ask for confirmation", () => {
  for (const meeting of [
    { ...upcoming, starts_at: new Date(Date.now() - 60000).toISOString() },
    { ...upcoming, status: "cancelled" as const },
  ]) {
    const { container } = render(
      <MeetingRsvp meeting={meeting} initial="yes" />,
    );
    expect(container.textContent).toBe("");
    cleanup();
  }
});

test("approved members can turn meeting emails off in their account", async () => {
  state.user = user("member", "approved");
  const fetch = vi.fn(async (url: string, init?: RequestInit) =>
    url === "/api/auth/preferences"
      ? Response.json(
          init?.method === "PATCH"
            ? JSON.parse(String(init.body))
            : { meetingEmails: true },
        )
      : Response.json({}),
  );
  vi.stubGlobal("fetch", fetch);
  render(
    <MemoryRouter>
      <Account />
    </MemoryRouter>,
  );
  const toggle = await screen.findByRole("checkbox", {
    name: "Receber avisos de encontros por e-mail",
  });
  await waitFor(() =>
    expect((toggle as HTMLInputElement).disabled).toBe(false),
  );
  expect((toggle as HTMLInputElement).checked).toBe(true);
  fireEvent.click(toggle);
  await waitFor(() => expect((toggle as HTMLInputElement).checked).toBe(false));
  expect(fetch).toHaveBeenCalledWith(
    "/api/auth/preferences",
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ meetingEmails: false }),
    }),
  );
});

test("pending accounts and the administrator have no meeting email setting", () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({})),
  );
  for (const account of [
    user("member", "pending"),
    user("admin", "approved"),
  ]) {
    state.user = account;
    render(
      <MemoryRouter>
        <Account />
      </MemoryRouter>,
    );
    expect(
      screen.queryByRole("heading", { name: "Avisos de encontros" }),
    ).toBeNull();
    cleanup();
  }
});
