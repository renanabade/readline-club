import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarDays, Clock, ExternalLink } from "lucide-react";
import { useData } from "../lib/useData";
import { dateLabel } from "../lib/dates";
import { callLabel, durationLabel } from "../lib/meeting";
import type {
  Meeting,
  MeetingDetail,
  PublicMeeting,
} from "../../shared/contracts";
import { MeetingRsvp } from "./MeetingRsvp";
import { CalendarActions } from "./CalendarActions";

// Everything a member needs before a meeting, in one place: join the call,
// answer the RSVP and save the date. The announcement shows right away; the
// call link and the RSVP arrive with the meeting details.
export function MemberNextMeeting({
  meeting,
}: {
  meeting: Meeting | PublicMeeting;
}) {
  const { data } = useData<MeetingDetail>(
    "/meetings/" + encodeURIComponent(meeting.id),
  );
  // Details may be missing or partial: fall back to the announcement.
  const detail = data?.meeting;
  const m = detail ?? meeting;
  const callUrl = detail?.meeting_url;
  return (
    <section
      className="next-meeting member-next-meeting"
      aria-labelledby={"member-next-" + m.id}
    >
      <div className="next-meeting-heading">
        <CalendarDays size={24} aria-hidden="true" />
        <span className="eyebrow">Seu próximo encontro · {m.book_title}</span>
      </div>
      <h2 id={"member-next-" + m.id}>{dateLabel(m.starts_at)}.</h2>
      <p className="next-meeting-details">
        <strong>{m.title}</strong>
        <br />
        {m.chapters && <>{m.chapters} · </>}
        <Clock size={14} aria-hidden="true" /> horário de Brasília ·{" "}
        {durationLabel(m.duration_minutes)}
      </p>
      {callUrl && m.status === "scheduled" && (
        <div className="whatsapp-actions member-next-call">
          <a
            className="button primary"
            href={callUrl}
            target="_blank"
            rel="noreferrer"
          >
            {callLabel(callUrl)} <ExternalLink size={16} />
          </a>
          <span className="muted small">
            Guarde este atalho: o mesmo botão fica na página do encontro.
          </span>
        </div>
      )}
      {detail && (
        <MeetingRsvp key={m.id} meeting={detail} initial={data.rsvp ?? null} />
      )}
      <CalendarActions meeting={m} />
      <Link className="text-link" to={"/encontros/" + m.id}>
        Ver pauta e materiais <ArrowUpRight size={16} />
      </Link>
    </section>
  );
}
