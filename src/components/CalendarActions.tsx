import { CalendarDays } from "lucide-react";
import { useSession } from "../lib/session";
import type { Meeting } from "../../shared/contracts";

export function CalendarActions({
  meeting,
}: {
  meeting: Pick<
    Meeting,
    "id" | "title" | "chapters" | "starts_at" | "duration_minutes" | "status"
  >;
}) {
  const { user } = useSession();
  if (
    !user ||
    user.mustChangePassword ||
    !meeting.starts_at ||
    meeting.status !== "scheduled"
  )
    return null;
  const start = new Date(meeting.starts_at);
  if (!Number.isFinite(start.getTime())) return null;
  const end = new Date(start.getTime() + meeting.duration_minutes * 60000);
  const stamp = (date: Date) =>
    date
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: meeting.title,
    dates: stamp(start) + "/" + stamp(end),
    ctz: "America/Sao_Paulo",
    details:
      meeting.chapters +
      "\nO link da chamada será informado no clube.\n" +
      window.location.origin +
      "/encontros/" +
      encodeURIComponent(meeting.id),
  });
  const member = user.role === "admin" || user.status === "approved";
  return (
    <div className="calendar-actions">
      <p>
        <CalendarDays size={17} aria-hidden="true" /> Adicionar ao calendário
      </p>
      <div className="whatsapp-actions">
        <a
          className="button"
          href={
            "https://calendar.google.com/calendar/render?" + params.toString()
          }
          target="_blank"
          rel="noopener noreferrer"
        >
          Google Agenda
        </a>
        {member && (
          <a
            className="button"
            href={
              "/api/meetings/" +
              encodeURIComponent(meeting.id) +
              "/calendar.ics"
            }
            download="readline-encontro.ics"
          >
            Apple / Outlook (.ics)
          </a>
        )}
      </div>
    </div>
  );
}
