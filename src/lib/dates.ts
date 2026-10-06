import type { Meeting } from "../../shared/contracts";
export function isUpcoming(meeting: Meeting, now = Date.now()) {
  return (
    meeting.status !== "completed" &&
    (!meeting.starts_at ||
      Date.parse(meeting.starts_at) + meeting.duration_minutes * 60000 > now)
  );
}
export function dateLabel(value: string | null, withTime = true) {
  if (!value) return "Data a definir";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}
export function inputDate(value: string | null) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
  return parts.replace(" ", "T");
}
