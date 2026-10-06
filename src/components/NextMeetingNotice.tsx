import { CalendarDays } from "lucide-react";
import { useSession } from "../lib/session";
import { dateLabel } from "../lib/dates";
import { CalendarActions } from "./CalendarActions";

function durationLabel(minutes: number) {
  if (minutes % 60) return minutes + " minutos";
  const hours = minutes / 60;
  return hours + (hours === 1 ? " hora" : " horas");
}

export function NextMeetingNotice({
  contained = false,
}: {
  contained?: boolean;
}) {
  const meeting = useSession().home?.nextMeeting;
  if (!meeting?.starts_at) return null;
  return (
    <section
      className={contained ? "next-meeting" : "container next-meeting"}
      aria-labelledby="next-meeting-title"
    >
      <div className="next-meeting-heading">
        <CalendarDays size={24} aria-hidden="true" />
        <span className="eyebrow">Próximo encontro · {meeting.book_title}</span>
      </div>
      <h2 id="next-meeting-title">{dateLabel(meeting.starts_at)}.</h2>
      <p className="next-meeting-details">
        <strong>{meeting.title}</strong>
        <br />
        {meeting.chapters && <>{meeting.chapters} · </>}
        horário de Brasília · duração prevista de{" "}
        {durationLabel(meeting.duration_minutes)}
      </p>
      <p>
        Vamos conversar sobre os capítulos combinados, tirar dúvidas e trazer
        exemplos de situações reais. Quem está começando pode perguntar; quem
        tem mais experiência pode complementar. Também vale só acompanhar.
      </p>
      <p>
        O link da chamada fica disponível para os integrantes aprovados. Quando
        houver gravação, ela fica na área do livro para quem não puder ir ou
        entrar no clube mais tarde.
      </p>
      <CalendarActions meeting={meeting} />
    </section>
  );
}
