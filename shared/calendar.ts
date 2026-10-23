import type { Meeting } from "./contracts";
type CalendarMeeting = Pick<
  Meeting,
  "id" | "title" | "chapters" | "starts_at" | "duration_minutes"
> & { meeting_url?: string };
const stamp = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
export const meetingPageUrl = (id: string, origin: string) =>
  origin + "/encontros/" + encodeURIComponent(id);
// Calendar events leave the platform, so they point to the meeting page and
// never carry the call link itself.
export function calendarDetails(meeting: CalendarMeeting, origin: string) {
  return [
    meeting.chapters,
    meeting.meeting_url
      ? "O link da chamada está na página do encontro, para membros:"
      : "O link da chamada será informado no clube.",
    meetingPageUrl(meeting.id, origin),
  ]
    .filter(Boolean)
    .join("\n");
}
// Opens Google Calendar's own "new event" form: nothing reaches Google unless
// the person clicks the link.
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
    details: calendarDetails(meeting, origin),
  });
  return "https://calendar.google.com/calendar/render?" + params.toString();
}
