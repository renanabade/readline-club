// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CalendarActions } from "../src/components/CalendarActions";
const state = vi.hoisted(() => ({
  user: null as null | {
    role: string;
    status: string;
    mustChangePassword: boolean;
  },
}));
vi.mock("../src/lib/session", () => ({ useSession: () => state }));
afterEach(cleanup);
const meeting = {
  id: "first",
  title: "Encontro",
  chapters: "Capítulos 1 a 4",
  starts_at: "2026-10-17T17:00:00.000Z",
  duration_minutes: 60,
  status: "scheduled" as const,
};
test("visitors have no calendar actions", () => {
  state.user = null;
  render(<CalendarActions meeting={meeting} />);
  expect(screen.queryByRole("link")).toBeNull();
});
test("members get correctly timed Google event and authenticated ICS download", () => {
  state.user = {
    role: "member",
    status: "approved",
    mustChangePassword: false,
  };
  render(<CalendarActions meeting={meeting} />);
  const url = new URL(
    screen.getByRole("link", { name: "Google Agenda" }).getAttribute("href")!,
  );
  expect(url.searchParams.get("dates")).toBe(
    "20261017T170000Z/20261017T180000Z",
  );
  expect(url.searchParams.get("ctz")).toBe("America/Sao_Paulo");
  expect(
    screen
      .getByRole("link", { name: "Apple / Outlook (.ics)" })
      .getAttribute("href"),
  ).toBe("/api/meetings/first/calendar.ics");
});
test("pending users can save public announcement without accessing protected ICS", () => {
  state.user = { role: "member", status: "pending", mustChangePassword: false };
  render(<CalendarActions meeting={meeting} />);
  expect(screen.getByRole("link", { name: "Google Agenda" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: /Apple/ })).toBeNull();
});
test("cancelled meetings have no save action", () => {
  state.user = {
    role: "member",
    status: "approved",
    mustChangePassword: false,
  };
  render(<CalendarActions meeting={{ ...meeting, status: "cancelled" }} />);
  expect(screen.queryByRole("link")).toBeNull();
});
