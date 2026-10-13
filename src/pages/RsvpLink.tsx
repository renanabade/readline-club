import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, CalendarDays, CheckCircle } from "lucide-react";
import { save } from "../lib/api";
import { dateLabel } from "../lib/dates";
import { durationLabel } from "../lib/meeting";
import { Loading, Notice } from "../components/ui";
import { googleCalendarUrl } from "../../shared/calendar";
import type { MeetingRsvp, RsvpLink as Link_ } from "../../shared/contracts";

// Opened from the personal buttons in the invitation email. Loading the page
// never answers by itself, because email security scanners open every link:
// the answer is one click, with no login.
export default function RsvpLink() {
  const [params] = useSearchParams();
  const suggested: MeetingRsvp =
    params.get("resposta") === "nao" ? "no" : "yes";
  const [token] = useState(() => window.location.hash.slice(1));
  const [data, setData] = useState<Link_ | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [answered, setAnswered] = useState(false);
  useEffect(() => {
    if (!token) {
      setError(
        "Este link de confirmação está incompleto. Abra o botão do e-mail de novo ou entre na plataforma para responder.",
      );
      return;
    }
    save<Link_>("/rsvp/lookup", { token })
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [token]);
  async function answer(response: MeetingRsvp) {
    setBusy(true);
    setError("");
    try {
      setData(await save<Link_>("/rsvp", { token, response }, "PUT"));
      setAnswered(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!data && !error) return <Loading />;
  const m = data?.meeting;
  const calendar = m ? googleCalendarUrl(m, window.location.origin) : null;
  const choice = answered ? data?.rsvp : (data?.rsvp ?? suggested);
  return (
    <div className="container page narrow rsvp-link-page">
      <span className="eyebrow">Confirmação de presença</span>
      {m ? (
        <>
          <h1>{m.title}</h1>
          <p className="next-meeting-details">
            <CalendarDays size={17} aria-hidden="true" />{" "}
            {dateLabel(m.starts_at)} · horário de Brasília ·{" "}
            {durationLabel(m.duration_minutes)}
            <br />
            {[m.book_title, m.chapters].filter(Boolean).join(" · ")}
          </p>
          {data?.open ? (
            <>
              {answered ? (
                <p className="success" role="status">
                  <CheckCircle size={17} aria-hidden="true" />{" "}
                  {data.rsvp === "yes"
                    ? "Presença confirmada. Até lá!"
                    : "Obrigado por avisar. Se mudar de ideia, é só voltar a este link."}
                </p>
              ) : (
                <p>
                  {data.rsvp
                    ? "Você já respondeu. Quer mudar a resposta?"
                    : "Você vai participar? Basta um clique, sem precisar entrar."}
                </p>
              )}
              <div className="whatsapp-actions">
                <button
                  className={"button" + (choice === "yes" ? " primary" : "")}
                  aria-pressed={data.rsvp === "yes"}
                  disabled={busy}
                  onClick={() => void answer("yes")}
                >
                  {data.rsvp === "yes"
                    ? "Presença confirmada"
                    : "Vou participar"}
                </button>
                <button
                  className={"button" + (choice === "no" ? " primary" : "")}
                  aria-pressed={data.rsvp === "no"}
                  disabled={busy}
                  onClick={() => void answer("no")}
                >
                  Não vou poder
                </button>
              </div>
            </>
          ) : (
            <Notice>
              A confirmação de presença está encerrada para este encontro.
            </Notice>
          )}
          {error && <Notice>{error}</Notice>}
          {data?.open && calendar && (
            <p>
              <a
                className="text-link"
                href={calendar}
                target="_blank"
                rel="noopener noreferrer"
              >
                Adicionar ao Google Agenda <ArrowRight size={16} />
              </a>
            </p>
          )}
          <p className="muted small">
            O link da chamada, a pauta e os materiais ficam na página do
            encontro, para membros.{" "}
            <Link to={"/encontros/" + encodeURIComponent(m.id)}>
              Entrar e abrir o encontro
            </Link>
            .
          </p>
        </>
      ) : (
        <>
          <h1>Não conseguimos abrir sua confirmação.</h1>
          <Notice>{error}</Notice>
          <Link className="button primary" to="/agenda">
            Entrar e ver os encontros <ArrowRight size={16} />
          </Link>
        </>
      )}
    </div>
  );
}
