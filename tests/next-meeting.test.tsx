// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextMeetingNotice } from "../src/components/NextMeetingNotice";
import type { PublicMeeting } from "../shared/contracts";
const state = vi.hoisted(() => ({
  user: null,
  home: null as null | { nextMeeting: PublicMeeting | null },
}));
vi.mock("../src/lib/session", () => ({ useSession: () => state }));
afterEach(cleanup);

test("no announcement is shown without a scheduled meeting", () => {
  state.home = { nextMeeting: null };
  const { container } = render(<NextMeetingNotice />);
  expect(container.innerHTML).toBe("");
});

test("announcement comes from the next meeting saved by the administrator", () => {
  state.home = {
    nextMeeting: {
      id: "m1",
      title: "Encontro sobre grafos",
      chapters: "Capítulos 6 e 7",
      starts_at: "2026-11-14T17:00:00.000Z",
      duration_minutes: 90,
      status: "scheduled",
      book_title: "Livro de teste",
    },
  };
  render(<NextMeetingNotice />);
  expect(screen.getByText("Próximo encontro · Livro de teste")).toBeTruthy();
  expect(screen.getByText("Encontro sobre grafos")).toBeTruthy();
  expect(screen.getByRole("heading").textContent).toContain("14 de novembro");
  expect(screen.getByText(/Capítulos 6 e 7/).textContent).toContain(
    "90 minutos",
  );
});
