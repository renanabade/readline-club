// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
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
const meeting = (id: string, startsAt: number, status = "scheduled") => ({
  id,
  cycle_id: "c1",
  title: "Encontro " + id,
  chapters: "",
  starts_at: new Date(startsAt).toISOString(),
  duration_minutes: 60,
  status,
  agenda: "",
  summary: "",
  meeting_url: "",
  updated_at: "2026-10-01T00:00:00Z",
  book_title: "Livro",
});
beforeEach(() => {
  mocks.save.mockReset();
  mocks.reload.mockClear();
  mocks.data = {
    applications: [],
    books: [],
    meetings: [
      meeting("next", Date.now() + 86400000),
      meeting("past", Date.now() - 86400000, "completed"),
    ],
    cycles: [],
    categories: [],
    resources: [],
    recordings: [],
    settings: {},
    invitations: [
      { meeting_id: "next", status: "sent", total: 3 },
      { meeting_id: "next", status: "queued", total: 2 },
    ],
    rsvps: [
      { meeting_id: "next", response: "yes", total: 2 },
      { meeting_id: "next", response: "no", total: 1 },
    ],
  };
});
afterEach(cleanup);
const openMeetings = () => {
  render(<Admin />);
  fireEvent.click(screen.getByRole("button", { name: /Encontros/ }));
};

test("upcoming meetings show totals and offer the invitation; past ones do not", () => {
  openMeetings();
  expect(
    screen.getByText(
      "3 convites enviados · 2 na fila · 2 confirmaram presença · 1 não vai",
    ),
  ).toBeTruthy();
  expect(
    screen.getAllByRole("button", { name: "Enviar convite por e-mail" }),
  ).toHaveLength(1);
});

test("confirming only queues the invitation and says the page can be closed", async () => {
  mocks.save.mockResolvedValueOnce({ added: 25, queued: 25 });
  openMeetings();
  fireEvent.click(
    screen.getByRole("button", { name: "Enviar convite por e-mail" }),
  );
  const dialog = screen.getByRole("dialog");
  expect(dialog.textContent).toContain("exceto quem desligou os avisos");
  expect(mocks.save).not.toHaveBeenCalled();
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Confirmar e enviar" }),
  );
  expect(
    await screen.findByText(
      /25 convites na fila\. .*você pode fechar esta página/,
    ),
  ).toBeTruthy();
  expect(mocks.save).toHaveBeenCalledOnce();
  expect(mocks.save).toHaveBeenCalledWith(
    "/admin/meetings/next/invitations",
    {},
  );
  await waitFor(() => expect(mocks.reload).toHaveBeenCalled());
});
