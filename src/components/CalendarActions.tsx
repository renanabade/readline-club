import { CalendarDays } from "lucide-react";
import { useSession } from "../lib/session";
import type { Meeting } from "../../shared/contracts";
import { googleCalendarUrl } from "../../shared/calendar";

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
  const google = googleCalendarUrl(meeting, window.location.origin);
  if (!google) return null;
  const member = user.role === "admin" || user.status === "approved";
  return (
    <div className="calendar-actions">
      <p>
        <CalendarDays size={17} aria-hidden="true" /> Adicionar ao calendário
      </p>
      <div className="whatsapp-actions">
        <a
          className="button"
          href={google}
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
