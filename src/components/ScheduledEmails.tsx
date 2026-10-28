import { useState } from "react";
import { Mail } from "lucide-react";
import { useData } from "../lib/useData";
import { save } from "../lib/api";
import { dateLabel } from "../lib/dates";
import { Notice } from "./ui";
import type {
  Meeting,
  ScheduledEmail,
  ScheduledEmailPreview,
} from "../../shared/contracts";
const statusLabels: Record<ScheduledEmail["status"], string> = {
  scheduled: "Agendado",
  sending: "Saindo",
  done: "Enviado",
  cancelled: "Cancelado",
};
function totalsLabel(totals: ScheduledEmail["totals"]) {
  const sum = (match: (t: ScheduledEmail["totals"][number]) => boolean) =>
    totals.filter(match).reduce((n, t) => n + t.total, 0);
  const parts = [
    [sum((t) => t.status === "sent"), "enviados"],
    [
      sum((t) => t.status === "sent" && t.version === "locked"),
      "deles sem link, para quem não confirmou o e-mail",
    ],
    [sum((t) => t.status === "queued" || t.status === "sending"), "na fila"],
    [sum((t) => t.status === "failed"), "falharam"],
    [sum((t) => t.status === "unknown"), "sem confirmação do serviço"],
  ] as const;
  return parts
    .filter(([n]) => n > 0)
    .map(([n, label]) => `${n} ${label}`)
    .join(" · ");
}
// One-off emails about a meeting, sent by the server at the chosen time.
export function ScheduledEmails({ meeting }: { meeting: Meeting }) {
  const path = "/admin/meetings/" + encodeURIComponent(meeting.id) + "/emails";
  const { data, error, reload } = useData<ScheduledEmail[]>(path);
  const [writing, setWriting] = useState(false),
    [busy, setBusy] = useState(false),
    [listError, setListError] = useState("");
  async function cancel(id: string) {
    setBusy(true);
    setListError("");
    try {
      await save("/admin/emails/" + encodeURIComponent(id), {}, "DELETE");
      await reload();
    } catch (e) {
      setListError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="scheduled-emails">
      {error && <Notice>{error}</Notice>}
      {listError && <Notice>{listError}</Notice>}
      {data?.map((e) => (
        <div className="resource-admin" key={e.id}>
          <p>
            <span className="resource-kind">{statusLabels[e.status]}</span>
            {e.subject} · {dateLabel(e.send_at)}, Brasília
            {totalsLabel(e.totals) && (
              <span className="small muted"> · {totalsLabel(e.totals)}</span>
            )}
          </p>
          {e.status === "scheduled" && (
            <button
              className="text-button"
              disabled={busy}
              onClick={() => void cancel(e.id)}
            >
              Cancelar envio
            </button>
          )}
        </div>
      ))}
      {writing ? (
        <EmailEditor
          meeting={meeting}
          close={() => setWriting(false)}
          saved={() => {
            setWriting(false);
            void reload();
          }}
        />
      ) : (
        <button
          className="button small-button"
          onClick={() => setWriting(true)}
        >
          <Mail size={16} />
          Agendar e-mail para os membros
        </button>
      )}
    </div>
  );
}
function EmailEditor({
  meeting,
  close,
  saved,
}: {
  meeting: Meeting;
  close: () => void;
  saved: () => void;
}) {
  const [subject, setSubject] = useState(""),
    [body, setBody] = useState(""),
    [sendAt, setSendAt] = useState(""),
    [preview, setPreview] = useState<ScheduledEmailPreview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const draft = { meetingId: meeting.id, subject, body };
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="application-card" aria-labelledby="email-editor-title">
      <h3 id="email-editor-title">E-mail sobre “{meeting.title}”</h3>
      <p className="small muted">
        Vai para os membros aprovados que aceitam avisos de encontros. Quem
        confirmou o e-mail recebe a versão completa, com os botões de presença e
        o convite para a agenda, e passa a contar como convidado. Quem ainda não
        confirmou recebe a data e a leitura, sem os botões, com um link para
        confirmar o e-mail. A data e a leitura entram depois do seu texto.
      </p>
      <label>
        Assunto
        <input
          value={subject}
          maxLength={150}
          onChange={(e) => setSubject(e.target.value)}
        />
      </label>
      <label>
        Texto
        <textarea
          rows={6}
          value={body}
          maxLength={4000}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>
      <label>
        Enviar em · Brasília
        <input
          type="datetime-local"
          value={sendAt}
          onChange={(e) => setSendAt(e.target.value)}
        />
      </label>
      {preview && (
        <div className="email-previews">
          <p className="small">
            Hoje, {preview.recipients.full} pessoas receberiam a versão completa
            e {preview.recipients.locked} a versão sem link.
          </p>
          {(
            [
              ["Versão completa", preview.full],
              ["Versão sem link", preview.locked],
            ] as const
          ).map(([label, copy]) => (
            <figure key={label}>
              <figcaption>
                <strong>{label}</strong> · {copy.subject}
              </figcaption>
              <pre className="email-preview">{copy.text}</pre>
            </figure>
          ))}
        </div>
      )}
      {error && <Notice>{error}</Notice>}
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      <div className="row-actions">
        <button
          className="button"
          disabled={busy}
          onClick={() =>
            void run(async () =>
              setPreview(
                await save<ScheduledEmailPreview>(
                  "/admin/emails/preview",
                  draft,
                ),
              ),
            )
          }
        >
          Ver prévia
        </button>
        <button
          className="button"
          disabled={busy}
          onClick={() =>
            void run(async () =>
              setMessage(
                (await save<{ message: string }>("/admin/emails/test", draft))
                  .message,
              ),
            )
          }
        >
          Enviar teste para mim
        </button>
        <button
          className="button primary"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              if (!sendAt) throw new Error("Escolha a data e a hora do envio.");
              await save("/admin/emails", {
                ...draft,
                sendAt: new Date(sendAt + "-03:00").toISOString(),
              });
              saved();
            })
          }
        >
          {busy ? "Aguarde…" : "Agendar"}
        </button>
        <button className="button" disabled={busy} onClick={close}>
          Fechar
        </button>
      </div>
    </section>
  );
}
