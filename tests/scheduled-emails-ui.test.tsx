// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ScheduledEmails } from "../src/components/ScheduledEmails";
import type { Meeting, ScheduledEmail } from "../shared/contracts";
const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  reload: vi.fn(),
  data: [] as ScheduledEmail[],
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
  mocks.data = [];
});
afterEach(cleanup);
const meeting = {
  id: "encontro-2",
  title: "Encontro 2",
  status: "scheduled",
  starts_at: new Date(Date.now() + 7 * 86400000).toISOString(),
} as Meeting;
const email = (
  status: ScheduledEmail["status"],
  totals: ScheduledEmail["totals"] = [],
): ScheduledEmail => ({
  id: status,
  meeting_id: meeting.id,
  subject: "Assunto " + status,
  body: "Texto",
  send_at: new Date(Date.now() + 86400000).toISOString(),
  status,
  created_at: new Date().toISOString(),
  totals,
});

test("only emails that have not started can be cancelled, and totals show", () => {
  mocks.data = [
    email("scheduled"),
    email("done", [
      { version: "full", status: "sent", total: 10 },
      { version: "locked", status: "sent", total: 2 },
      { version: "full", status: "failed", total: 1 },
    ]),
  ];
  render(<ScheduledEmails meeting={meeting} />);
  expect(
    screen.getAllByRole("button", { name: "Cancelar envio" }),
  ).toHaveLength(1);
  expect(document.body.textContent).toContain(
    "12 enviados · 2 deles sem link, para quem não confirmou o e-mail · 1 falharam",
  );
});

test("scheduling sends the Brasília time in UTC, and the preview shows both versions", async () => {
  render(<ScheduledEmails meeting={meeting} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Agendar e-mail para os membros" }),
  );
  fireEvent.change(screen.getByLabelText("Assunto"), {
    target: { value: "Encontro no domingo" },
  });
  fireEvent.change(screen.getByLabelText("Texto"), {
    target: { value: "Oi!" },
  });
  mocks.save.mockResolvedValueOnce({
    full: { subject: "Encontro no domingo", text: "completa /presenca" },
    locked: { subject: "Encontro no domingo", text: "sem link /confirmar" },
    recipients: { full: 10, locked: 2 },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ver prévia" }));
  expect(await screen.findByText("completa /presenca")).toBeTruthy();
  expect(screen.getByText("sem link /confirmar")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Agendar" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Escolha a data e a hora",
  );
  fireEvent.change(screen.getByLabelText("Enviar em · Brasília"), {
    target: { value: "2026-10-30T10:00" },
  });
  mocks.save.mockResolvedValueOnce({ id: "novo" });
  fireEvent.click(screen.getByRole("button", { name: "Agendar" }));
  await waitFor(() =>
    expect(mocks.save).toHaveBeenLastCalledWith("/admin/emails", {
      meetingId: "encontro-2",
      subject: "Encontro no domingo",
      body: "Oi!",
      sendAt: "2026-10-30T13:00:00.000Z",
    }),
  );
  expect(mocks.reload).toHaveBeenCalled();
});
