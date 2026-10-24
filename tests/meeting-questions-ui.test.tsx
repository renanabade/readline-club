// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MeetingQuestions } from "../src/components/MeetingQuestions";
import { AdminQuestions } from "../src/components/AdminQuestions";
import type { Meeting } from "../shared/contracts";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const question = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  body: "Pergunta " + id,
  first_name: "Ana",
  votes: 0,
  voted: false,
  mine: false,
  agenda: false,
  created_at: "2026-10-01T12:00:00Z",
  ...extra,
});
function stub(get: () => unknown) {
  const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method ? Response.json({ ok: true }) : Response.json(get()),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

test("members send questions and mark others as also wanting to discuss", async () => {
  const fetch = stub(() => ({
    open: true,
    remaining: 2,
    questions: [
      question("q1", { votes: 1, agenda: true }),
      question("q2", { mine: true, first_name: "Bruno" }),
    ],
  }));
  render(<MeetingQuestions meetingId="m1" />);
  expect(await screen.findByText("Pergunta q1")).toBeTruthy();
  expect(screen.getByText("Na pauta")).toBeTruthy();
  expect(screen.getByText("Sua pergunta")).toBeTruthy();
  expect(screen.getByText(/você pode mandar mais 2/)).toBeTruthy();
  // Own questions can be deleted, not voted.
  expect(
    screen.getAllByRole("button", { name: "Também quero discutir" }),
  ).toHaveLength(1);
  fireEvent.click(
    screen.getByRole("button", { name: "Também quero discutir" }),
  );
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      "/api/meetings/m1/questions/q1/vote",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ vote: true }),
      }),
    ),
  );
  fireEvent.change(screen.getByLabelText("Sua pergunta"), {
    target: { value: "Como fica a complexidade?" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Enviar pergunta/ }));
  expect(await screen.findByText("Pergunta enviada.")).toBeTruthy();
  expect(fetch).toHaveBeenCalledWith(
    "/api/meetings/m1/questions",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ body: "Como fica a complexidade?" }),
    }),
  );
});

test("the form disappears after three questions and when the meeting starts", async () => {
  stub(() => ({ open: true, remaining: 0, questions: [question("q1")] }));
  render(<MeetingQuestions meetingId="m1" />);
  expect(
    await screen.findByText("Você já mandou as 3 perguntas deste encontro."),
  ).toBeTruthy();
  expect(screen.queryByLabelText("Sua pergunta")).toBeNull();
  cleanup();
  stub(() => ({ open: false, remaining: 3, questions: [question("q1")] }));
  render(<MeetingQuestions meetingId="m1" />);
  expect(
    await screen.findByText("As perguntas deste encontro estão encerradas."),
  ).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
});

test("the panel sorts, hides and marks questions for the agenda", async () => {
  const meetings = [
    {
      id: "m1",
      title: "Encontro 1",
      starts_at: new Date(Date.now() + 86400000).toISOString(),
      status: "scheduled",
    },
  ] as Meeting[];
  const fetch = stub(() => [
    {
      id: "a",
      body: "Antiga",
      author: "Ana Souza",
      votes: 1,
      hidden: false,
      agenda: false,
      created_at: "2026-10-01T12:00:00Z",
    },
    {
      id: "b",
      body: "Votada",
      author: "Bruno Reis",
      votes: 5,
      hidden: true,
      agenda: false,
      created_at: "2026-10-02T12:00:00Z",
    },
  ]);
  render(<AdminQuestions meetings={meetings} />);
  await screen.findByText("Antiga");
  const bodies = () =>
    screen
      .getAllByRole("listitem")
      .map((li) => li.querySelector("p")?.textContent);
  // Agenda first, then visible before hidden.
  expect(bodies()).toEqual(["Antiga", "Votada"]);
  fireEvent.change(screen.getByLabelText("Ordenar perguntas"), {
    target: { value: "votes" },
  });
  expect(bodies()).toEqual(["Votada", "Antiga"]);
  const votada = screen.getAllByRole("listitem")[0];
  expect(within(votada).getByText("Oculta")).toBeTruthy();
  fireEvent.click(
    within(votada).getByRole("button", { name: "Mostrar aos membros" }),
  );
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      "/api/admin/questions/b",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ hidden: false }),
      }),
    ),
  );
  fireEvent.click(
    await screen
      .findAllByRole("button", { name: "Marcar como pauta" })
      .then((buttons) => buttons[0]),
  );
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/admin\/questions\//),
      expect.objectContaining({ body: JSON.stringify({ agenda: true }) }),
    ),
  );
});
