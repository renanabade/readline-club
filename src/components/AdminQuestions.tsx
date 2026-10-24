import { useState } from "react";
import { useData } from "../lib/useData";
import { save } from "../lib/api";
import { dateLabel } from "../lib/dates";
import { Empty, Loading, Notice } from "./ui";
import type { AdminQuestion, Meeting } from "../../shared/contracts";
const orders = {
  agenda: "Pauta primeiro",
  votes: "Mais votadas",
  oldest: "Mais antigas",
  newest: "Mais recentes",
} as const;
type Order = keyof typeof orders;
const compare: Record<Order, (a: AdminQuestion, b: AdminQuestion) => number> = {
  agenda: (a, b) =>
    Number(b.agenda) - Number(a.agenda) ||
    Number(a.hidden) - Number(b.hidden) ||
    b.votes - a.votes,
  votes: (a, b) => b.votes - a.votes,
  oldest: (a, b) => a.created_at.localeCompare(b.created_at),
  newest: (a, b) => b.created_at.localeCompare(a.created_at),
};
// The next meeting is the one being prepared; otherwise, the latest one.
function defaultMeeting(meetings: Meeting[]) {
  const dated = meetings.filter((m) => m.starts_at);
  return (
    dated.find(
      (m) => m.status === "scheduled" && Date.parse(m.starts_at!) > Date.now(),
    ) ?? dated[dated.length - 1]
  );
}
export function AdminQuestions({ meetings }: { meetings: Meeting[] }) {
  const [meetingId, setMeetingId] = useState(
    () => defaultMeeting(meetings)?.id ?? "",
  );
  return (
    <>
      <div className="section-heading">
        <h2>Perguntas para discussão.</h2>
      </div>
      <p className="small muted">
        Os membros mandam até 3 perguntas por encontro, até o horário de início.
        Perguntas ocultas somem para os membros; as marcadas como pauta aparecem
        primeiro para todos.
      </p>
      {meetings.length ? (
        <>
          <div className="search-filters admin-search">
            <select
              aria-label="Encontro"
              value={meetingId}
              onChange={(e) => setMeetingId(e.target.value)}
            >
              {meetings.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} · {dateLabel(m.starts_at, false)}
                </option>
              ))}
            </select>
          </div>
          {meetingId && <QuestionList key={meetingId} meetingId={meetingId} />}
        </>
      ) : (
        <Empty title="Nenhum encontro cadastrado.">
          As perguntas aparecem aqui assim que houver um encontro.
        </Empty>
      )}
    </>
  );
}
function QuestionList({ meetingId }: { meetingId: string }) {
  const { data, error, loading, reload } = useData<AdminQuestion[]>(
    "/admin/meetings/" + encodeURIComponent(meetingId) + "/questions",
  );
  const [order, setOrder] = useState<Order>("agenda"),
    [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState("");
  if (loading && !data) return <Loading />;
  if (!data) return <Notice>{error}</Notice>;
  async function review(
    id: string,
    change: { hidden?: boolean; agenda?: boolean },
  ) {
    setBusy(true);
    setActionError("");
    try {
      await save("/admin/questions/" + encodeURIComponent(id), change, "PATCH");
      await reload();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const list = [...data].sort(compare[order]);
  return (
    <>
      <div className="search-filters">
        <select
          aria-label="Ordenar perguntas"
          value={order}
          onChange={(e) => setOrder(e.target.value as Order)}
        >
          {Object.entries(orders).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {actionError && <Notice>{actionError}</Notice>}
      {list.length ? (
        <ul className="question-list">
          {list.map((q) => (
            <li key={q.id}>
              <p className="preserve">{q.body}</p>
              <p className="small muted">
                {q.author} · {dateLabel(q.created_at)} · {q.votes}{" "}
                {q.votes === 1 ? "também quer discutir" : "também querem"}
                {q.agenda && <span className="tag">Na pauta</span>}
                {q.hidden && <span className="tag">Oculta</span>}
              </p>
              <div className="row-actions">
                <button
                  className="button small-button"
                  disabled={busy}
                  onClick={() => void review(q.id, { agenda: !q.agenda })}
                >
                  {q.agenda ? "Tirar da pauta" : "Marcar como pauta"}
                </button>
                <button
                  className="button small-button"
                  disabled={busy}
                  onClick={() => void review(q.id, { hidden: !q.hidden })}
                >
                  {q.hidden ? "Mostrar aos membros" : "Ocultar"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Nenhuma pergunta para este encontro ainda.</p>
      )}
    </>
  );
}
