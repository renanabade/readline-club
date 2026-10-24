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
import { AdminAttendance } from "../src/components/AdminAttendance";
import { AttendanceHistory } from "../src/pages/Members";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const startsAt = new Date(Date.now() - 86400000).toISOString();
function stub(routes: Record<string, unknown>) {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "PUT")
      return Response.json({
        present: JSON.parse(String(init.body)).userIds.length,
      });
    return Response.json(routes[url]);
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

test("the panel shows totals and marks the listed members in bulk", async () => {
  const fetch = stub({
    "/api/admin/attendance": [
      {
        meeting_id: "m2",
        title: "Capítulo 2",
        book_title: "Livro",
        starts_at: startsAt,
        previous_title: "Capítulo 1",
        present: 3,
        also_previous: 2,
      },
    ],
    "/api/admin/meetings/m2/attendance": {
      meeting: { id: "m2", title: "Capítulo 2", starts_at: startsAt },
      members: [
        {
          user_id: "u1",
          name: "Ana Souza",
          email: "ana@example.test",
          present: true,
        },
        {
          user_id: "u2",
          name: "Bruno Lima",
          email: "bruno@example.test",
          present: false,
        },
        {
          user_id: "u3",
          name: "Bianca Reis",
          email: "bianca@example.test",
          present: false,
        },
      ],
    },
  });
  render(<AdminAttendance />);
  expect(
    await screen.findByText(/3 presentes · 2 também em “Capítulo 1”/),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Marcar presentes" }));
  expect(await screen.findByText("1 de 3 marcados")).toBeTruthy();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "bi" } });
  expect(screen.queryByLabelText(/Bruno Lima/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Marcar os 1 listados" }));
  expect(screen.getByText("2 de 3 marcados")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Salvar presença" }));
  expect(await screen.findByText("Presença salva: 2 presentes.")).toBeTruthy();
  const put = fetch.mock.calls.find(([, init]) => init?.method === "PUT");
  expect(put?.[0]).toBe("/api/admin/meetings/m2/attendance");
  expect(JSON.parse(String(put?.[1]?.body)).userIds.sort()).toEqual([
    "u1",
    "u3",
  ]);
  await waitFor(() =>
    expect(
      fetch.mock.calls.filter(([url]) => url === "/api/admin/attendance"),
    ).toHaveLength(2),
  );
});

test("members see their attendance history or an empty state", async () => {
  stub({
    "/api/attendance": [
      {
        id: "m1",
        title: "Capítulo 1",
        book_title: "Livro",
        starts_at: startsAt,
      },
    ],
  });
  render(
    <MemoryRouter>
      <AttendanceHistory />
    </MemoryRouter>,
  );
  const link = await screen.findByRole("link", { name: /Capítulo 1 · Livro/ });
  expect(link.getAttribute("href")).toBe("/encontros/m1");
  cleanup();
  stub({ "/api/attendance": [] });
  render(
    <MemoryRouter>
      <AttendanceHistory />
    </MemoryRouter>,
  );
  expect(
    await screen.findByText(/Ainda não há presença registrada/),
  ).toBeTruthy();
});
