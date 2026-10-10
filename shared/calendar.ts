import type { Meeting } from "./contracts";
type CalendarMeeting = Pick<
  Meeting,
  "id" | "title" | "chapters" | "starts_at" | "duration_minutes"
>;
const stamp = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
// Opens Google Calendar's own "new event" form: nothing reaches Google unless
// the person clicks the link. The call link stays inside the platform.
export function googleCalendarUrl(meeting: CalendarMeeting, origin: string) {
  if (!meeting.starts_at) return null;
  const start = new Date(meeting.starts_at);
  if (!Number.isFinite(start.getTime())) return null;
  const end = new Date(start.getTime() + meeting.duration_minutes * 60000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: meeting.title,
    dates: stamp(start) + "/" + stamp(end),
    ctz: "America/Sao_Paulo",
    details:
      meeting.chapters +
      "\nO link da chamada será informado no clube.\n" +
      origin +
      "/encontros/" +
      encodeURIComponent(meeting.id),
  });
  return "https://calendar.google.com/calendar/render?" + params.toString();
}
