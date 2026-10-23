import { test, expect } from "vitest";
import { parseYouTubeId } from "../worker/lib/youtube";
import { meetingToIcs } from "../worker/lib/calendar";
test("YouTube URL parser rejects lookalike hosts and arbitrary embed URLs", () => {
  expect(
    parseYouTubeId("https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ"),
  ).toBeNull();
  expect(parseYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  expect(parseYouTubeId("javascript:alert(1)")).toBeNull();
});
test("calendar preserves UTC instant, cancellation and escaping without meeting link", () => {
  const ics = meetingToIcs({
    id: "test",
    cycle_id: "cycle",
    title: "Introdução, parte 1",
    chapters: "Capítulo 1\nDúvidas",
    starts_at: "2026-10-10T19:00:00-03:00",
    duration_minutes: 60,
    status: "cancelled",
    agenda: "",
    summary: "",
    meeting_url: "https://private.test",
    updated_at: "2026-09-27T00:00:00Z",
  });
  expect(ics).toContain("DTSTART:20261010T220000Z");
  expect(ics).toContain("DTEND:20261010T230000Z");
  expect(ics).toContain("STATUS:CANCELLED");
  expect(ics).not.toContain("private.test");
  expect(ics).toContain("Introdução\\, parte 1");
});
test("calendar description points to the meeting page, never to the call", () => {
  const meeting = {
    id: "page-test",
    cycle_id: "cycle",
    title: "Encontro",
    chapters: "Capítulo 2",
    starts_at: "2026-10-10T19:00:00-03:00",
    duration_minutes: 60,
    status: "scheduled" as const,
    agenda: "",
    summary: "",
    meeting_url: "https://private.test/call",
    updated_at: "2026-09-27T00:00:00Z",
  };
  const unfold = (s: string) => s.replace(/\r\n /g, "");
  const withLink = unfold(meetingToIcs(meeting, "https://club.example.test"));
  expect(withLink).toContain(
    "O link da chamada está na página do encontro\\, para membros:\\nhttps://club.example.test/encontros/page-test",
  );
  expect(withLink).toContain(
    "URL:https://club.example.test/encontros/page-test",
  );
  expect(withLink).not.toContain("private.test");
  const withoutLink = unfold(
    meetingToIcs({ ...meeting, meeting_url: "" }, "https://club.example.test"),
  );
  expect(withoutLink).toContain("O link da chamada será informado no clube.");
});
