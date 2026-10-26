import { useState, type FormEvent } from "react";
import { MessageCircleQuestion } from "lucide-react";
import { useData } from "../lib/useData";
import { api, save } from "../lib/api";
import { Notice } from "./ui";
import type { MeetingQuestions as Questions } from "../../shared/contracts";
const votesLabel = (n: number) =>
  n === 1 ? "1 pessoa também quer discutir" : n + " pessoas também querem";
export function MeetingQuestions({ meetingId }: { meetingId: string }) {
  const path = "/meetings/" + encodeURIComponent(meetingId) + "/questions";
  const { data, error, loading, reload } = useData<Questions>(path);
  const [draft, setDraft] = useState(""),
    [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState(""),
    [message, setMessage] = useState("");
  async function run(task: () => Promise<unknown>, success = "") {
    setBusy(true);
    setActionError("");
    setMessage("");
    try {
      await task();
      setMessage(success);
      await reload();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void run(async () => {
      await save(path, { body: draft });
      setDraft("");
    }, "Pergunta enviada.");
  }
  if (loading && !data) return null;
  if (!data)
    return (
      <section className="notes">
        <Notice>{error}</Notice>
      </section>
    );
  if (!data.open && !data.questions?.length) return null;
  return (
    <section className="notes" aria-labelledby="questions-title">
      <span className="eyebrow">Para a conversa</span>
      <h2 id="questions-title">Perguntas para discussão.</h2>
      <p className="muted">
        {data.open
          ? "Mande até 3 perguntas sobre a leitura. Os outros membros veem a pergunta com o seu primeiro nome e podem marcar que também querem discutir."
          : "As perguntas deste encontro estão encerradas."}
      </p>
      {data.questions.length ? (
        <ul className="question-list">
          {data.questions.map((q) => (
            <li key={q.id}>
              <p className="preserve">{q.body}</p>
              <p className="small muted">
                {q.mine ? "Sua pergunta" : q.first_name}
                {q.agenda && <span className="tag">Na pauta</span>}
                {" · "}
                {votesLabel(q.votes)}
              </p>
              {data.open && (
                <div className="row-actions">
                  {q.mine ? (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () =>
                            api(path + "/" + encodeURIComponent(q.id), {
                              method: "DELETE",
                            }),
                          "Pergunta apagada.",
                        )
                      }
                    >
                      Apagar minha pergunta
                    </button>
                  ) : (
                    <button
                      className={
                        "button small-button" + (q.voted ? " primary" : "")
                      }
                      aria-pressed={q.voted}
                      disabled={busy}
                      onClick={() =>
                        void run(() =>
                          save(
                            path + "/" + encodeURIComponent(q.id) + "/vote",
                            { vote: !q.voted },
                            "PUT",
                          ),
                        )
                      }
                    >
                      Também quero discutir
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Ainda não há perguntas. Que tal mandar a sua?</p>
      )}
      {data.open &&
        (data.remaining ? (
          <form className="question-form" onSubmit={submit}>
            <label>
              Sua pergunta
              <textarea
                value={draft}
                maxLength={500}
                rows={3}
                required
                disabled={busy}
                onChange={(e) => setDraft(e.target.value)}
              />
            </label>
            <p className="small muted">
              {draft.length}/500 caracteres ·{" "}
              {data.remaining === 1
                ? "você pode mandar mais 1"
                : `você pode mandar mais ${data.remaining}`}
            </p>
            <button className="button primary" disabled={busy || !draft.trim()}>
              <MessageCircleQuestion size={17} aria-hidden="true" />
              {busy ? "Enviando…" : "Enviar pergunta"}
            </button>
          </form>
        ) : (
          <p className="small muted">
            Você já mandou as 3 perguntas deste encontro.
          </p>
        ))}
      {actionError && <Notice>{actionError}</Notice>}
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
