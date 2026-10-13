import { CalendarDays } from "lucide-react";
import { useSession } from "../lib/session";
import { dateLabel } from "../lib/dates";
import { durationLabel } from "../lib/meeting";
import { CalendarActions } from "./CalendarActions";

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
        Encontro ao vivo, on-line e gratuito, para conversar sobre os capítulos
        combinados, tirar dúvidas e trazer exemplos do dia a dia. Quem está
        começando pergunta; quem tem mais experiência complementa. Também vale
        só ouvir.
      </p>
      <p>
        Membros aprovados encontram o link da chamada e confirmam presença na
        plataforma. Não pôde ir? A gravação, o resumo escrito e os slides ficam
        na página do livro.
      </p>
      <CalendarActions meeting={meeting} />
    </section>
  );
}
