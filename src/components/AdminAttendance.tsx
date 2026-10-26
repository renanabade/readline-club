import { useState } from "react";
import { Search } from "lucide-react";
import { useData } from "../lib/useData";
import { save } from "../lib/api";
import { dateLabel } from "../lib/dates";
import { Empty, Loading, Notice } from "./ui";
import type {
  AttendanceSheet,
  AttendanceSummary,
} from "../../shared/contracts";
const searchable = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const people = (n: number) => (n === 1 ? "1 presente" : n + " presentes");
export function AdminAttendance() {
  const { data, error, loading, reload } =
    useData<AttendanceSummary[]>("/admin/attendance");
  const [open, setOpen] = useState<AttendanceSummary | null>(null);
  if (loading && !data) return <Loading />;
  if (!data) return <Notice>{error}</Notice>;
  return (
    <>
      <div className="section-heading">
        <h2>Quem participou.</h2>
      </div>
      <p className="small muted">
        Depois de cada encontro, marque quem esteve presente. Cada pessoa vê o
        próprio histórico em Minha conta; outros membros não veem a lista.
      </p>
      {open && (
        <AttendanceEditor
          key={open.meeting_id}
          summary={open}
          close={() => setOpen(null)}
          saved={() => void reload()}
        />
      )}
      {data.length ? (
        data.map((m) => (
          <div className="admin-row" key={m.meeting_id}>
            <div>
              <h3>{m.title}</h3>
              <p>
                {m.book_title} · {dateLabel(m.starts_at)} · {people(m.present)}
                {m.previous_title &&
                  ` · ${m.also_previous} também em “${m.previous_title}”`}
              </p>
            </div>
            <button className="button small-button" onClick={() => setOpen(m)}>
              Marcar presentes
            </button>
          </div>
        ))
      ) : (
        <Empty title="Nenhum encontro aconteceu ainda.">
          A presença pode ser marcada assim que o encontro começar.
        </Empty>
      )}
    </>
  );
}
function AttendanceEditor({
  summary,
  close,
  saved,
}: {
  summary: AttendanceSummary;
  close: () => void;
  saved: () => void;
}) {
  const { data, error, loading } = useData<AttendanceSheet>(
    "/admin/meetings/" + encodeURIComponent(summary.meeting_id) + "/attendance",
  );
  const [marked, setMarked] = useState<Set<string> | null>(null),
    [query, setQuery] = useState(""),
    [busy, setBusy] = useState(false),
    [saveError, setSaveError] = useState(""),
    [message, setMessage] = useState("");
  if (loading && !data) return <Loading />;
  if (!data) return <Notice>{error}</Notice>;
  const current =
    marked ??
    new Set(data.members.filter((m) => m.present).map((m) => m.user_id));
  const term = searchable(query.trim());
  const listed = data.members.filter(
    (m) => !term || searchable(m.name + " " + m.email).includes(term),
  );
  function change(ids: string[], present: boolean) {
    const next = new Set(current);
    for (const id of ids) {
      if (present) next.add(id);
      else next.delete(id);
    }
    setMarked(next);
    setMessage("");
  }
  async function submit() {
    setBusy(true);
    setSaveError("");
    setMessage("");
    try {
      const result = await save<{ present: number }>(
        "/admin/meetings/" +
          encodeURIComponent(summary.meeting_id) +
          "/attendance",
        { userIds: [...current] },
        "PUT",
      );
      setMessage("Presença salva: " + people(result.present) + ".");
      saved();
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="application-card"
      aria-labelledby="attendance-editor-title"
    >
      <span className="eyebrow">{dateLabel(summary.starts_at)}</span>
      <h3 id="attendance-editor-title">Presença em “{summary.title}”</h3>
      <div className="search-filters admin-search">
        <label className="search-field">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            aria-label="Buscar por nome ou e-mail"
            placeholder="Buscar por nome ou e-mail"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <div className="row-actions">
        <button
          className="button small-button"
          disabled={busy || !listed.length}
          onClick={() =>
            change(
              listed.map((m) => m.user_id),
              true,
            )
          }
        >
          Marcar os {listed.length} listados
        </button>
        <button
          className="button small-button"
          disabled={busy || !listed.length}
          onClick={() =>
            change(
              listed.map((m) => m.user_id),
              false,
            )
          }
        >
          Desmarcar os listados
        </button>
      </div>
      <p className="small muted" role="status">
        {current.size} de {data.members.length} marcados
      </p>
      {listed.map((m) => (
        <label className="onboarding-confirm" key={m.user_id}>
          <input
            type="checkbox"
            checked={current.has(m.user_id)}
            disabled={busy}
            onChange={(e) => change([m.user_id], e.currentTarget.checked)}
          />
          <span>
            {m.name} <span className="muted">· {m.email}</span>
          </span>
        </label>
      ))}
      {!listed.length && (
        <p className="muted">Ninguém encontrado com essa busca.</p>
      )}
      {saveError && <Notice>{saveError}</Notice>}
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      <div className="row-actions">
        <button
          className="button primary"
          disabled={busy}
          onClick={() => void submit()}
        >
          {busy ? "Salvando…" : "Salvar presença"}
        </button>
        <button className="button" disabled={busy} onClick={close}>
          Fechar
        </button>
      </div>
    </section>
  );
}
