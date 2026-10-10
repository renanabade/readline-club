import { Fragment, useRef, useState, type FormEvent } from "react";
import { useDialogFocus } from "../lib/useDialogFocus";
import {
  Plus,
  ArrowRight,
  Settings2,
  Users,
  BookOpen,
  CalendarDays,
  Video,
  Link2,
  Mail,
  X,
} from "lucide-react";
import { useData } from "../lib/useData";
import { save, api } from "../lib/api";
import { inputDate, dateLabel } from "../lib/dates";
import { Loading, Notice, Empty } from "../components/ui";
import type {
  AdminData,
  Application,
  Book,
  InvitationBatch,
  Meeting,
} from "../../shared/contracts";
type Entity =
  | "books"
  | "cycles"
  | "meetings"
  | "categories"
  | "resources"
  | "recordings"
  | "settings";
const names: Record<Entity, string> = {
  books: "Livro",
  cycles: "Ciclo de leitura",
  meetings: "Encontro",
  categories: "Categoria",
  resources: "Material",
  recordings: "Gravação",
  settings: "Configurações",
};
type Draft = { kind: Entity; value: Record<string, unknown> };
type MemberConfirmation =
  | { kind: "bulk"; ids: string[] }
  | { kind: "suspend"; application: Application };
export default function Admin() {
  const { data, error, loading, reload } =
    useData<AdminData>("/admin/overview");
  const [tab, setTab] = useState("applications"),
    [draft, setDraft] = useState<Draft | null>(null),
    [actionError, setActionError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [resetLink, setResetLink] = useState(""),
    [confirmation, setConfirmation] = useState<MemberConfirmation | null>(null),
    [inviting, setInviting] = useState<Meeting | null>(null);
  const actionRunning = useRef(false);
  useDialogFocus(!!resetLink, () => setResetLink(""));
  useDialogFocus(!!confirmation, () => {
    if (!actionRunning.current) setConfirmation(null);
  });
  useDialogFocus(!!inviting, () => {
    if (!actionRunning.current) setInviting(null);
  });
  async function action(
    path: string,
    body: unknown,
    method = "PATCH",
    successMessage?: string,
  ) {
    if (actionRunning.current) return;
    actionRunning.current = true;
    setBusy(true);
    setActionError("");
    setMessage("");
    try {
      const result = await save<{ message?: string; emailStatus?: string }>(
        path,
        body,
        method,
      );
      if (result.emailStatus && result.emailStatus !== "sent")
        setActionError(result.message || "Aviso não enviado.");
      else setMessage(successMessage || result.message || "Alteração salva.");
      await reload();
      window.dispatchEvent(new Event("content-refresh"));
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      actionRunning.current = false;
      setBusy(false);
    }
  }
  async function confirmMembers() {
    if (!confirmation || actionRunning.current) return;
    if (confirmation.kind === "suspend") {
      const { application } = confirmation;
      setConfirmation(null);
      await action("/admin/applications/" + application.id, {
        status: "suspended",
      });
      return;
    }
    const ids = confirmation.ids;
    actionRunning.current = true;
    setBusy(true);
    setMessage("");
    setActionError("");
    let approved = 0,
      notified = 0,
      failures = 0;
    try {
      for (let offset = 0; offset < ids.length; offset += 20) {
        const result = await save<{
          approved: number;
          notified: number;
          notificationFailures: number;
        }>("/admin/applications/approve-all", {
          ids: ids.slice(offset, offset + 20),
        });
        approved += result.approved;
        notified += result.notified;
        failures += result.notificationFailures;
      }
      setMessage(
        `${approved} ${approved === 1 ? "cadastro aprovado" : "cadastros aprovados"}. ${notified} ${notified === 1 ? "aviso enviado" : "avisos enviados"}.`,
      );
      if (failures)
        setActionError(
          `${failures} ${failures === 1 ? "aviso não teve" : "avisos não tiveram"} envio confirmado. O acesso foi liberado; confira o aviso em cada cadastro.`,
        );
    } catch (e) {
      setActionError(
        `Não foi possível concluir todos os cadastros. Parte pode já ter sido aprovada; confira a lista atualizada. ${(e as Error).message}`,
      );
    } finally {
      setConfirmation(null);
      await reload();
      window.dispatchEvent(new Event("content-refresh"));
      actionRunning.current = false;
      setBusy(false);
    }
  }
  async function sendInvitations() {
    if (!inviting || actionRunning.current) return;
    const path = "/admin/meetings/" + encodeURIComponent(inviting.id);
    actionRunning.current = true;
    setBusy(true);
    setMessage("");
    setActionError("");
    let sent = 0,
      failed = 0;
    try {
      await save(path + "/invitations", {});
      // The mailer sends in small batches; keep asking while each batch
      // makes progress, so a stuck queue cannot loop forever.
      for (;;) {
        const batch = await save<InvitationBatch>(
          path + "/invitations/send",
          {},
        );
        sent += batch.sent;
        failed += batch.failed;
        if (!batch.remaining || !(batch.sent + batch.failed + batch.skipped))
          break;
      }
      setMessage(
        sent
          ? `${sent} ${sent === 1 ? "convite enviado" : "convites enviados"}.`
          : "Nenhum convite novo: todos os membros já foram convidados.",
      );
      if (failed)
        setActionError(
          `${failed} ${failed === 1 ? "convite não teve" : "convites não tiveram"} envio confirmado. Envie de novo mais tarde para tentar outra vez.`,
        );
    } catch (e) {
      setActionError(
        `Não foi possível enviar todos os convites. ${sent} ${sent === 1 ? "foi enviado" : "foram enviados"}; envie de novo para continuar de onde parou. ${(e as Error).message}`,
      );
    } finally {
      setInviting(null);
      await reload();
      actionRunning.current = false;
      setBusy(false);
    }
  }
  function edit(kind: Entity, value: object = {}) {
    setActionError("");
    setMessage("");
    setDraft({ kind, value: { ...value } });
  }
  async function reset(a: Application) {
    setBusy(true);
    setActionError("");
    try {
      const userId = (a as Application & { user_id?: string }).user_id || a.id;
      const result = await save<{ url: string }>(
        "/admin/members/" + userId + "/reset",
        {},
      );
      setResetLink(result.url);
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (loading && !data) return <Loading />;
  if (!data)
    return (
      <div className="container page">
        <Notice>{error}</Notice>
      </div>
    );
  const pending = data.applications.filter((a) => a.status === "pending");
  return (
    <div className="container page admin-page">
      <div className="page-heading">
        <span className="eyebrow">Gestão do clube</span>
        <h1>Administração.</h1>
        <p>Aprove integrantes e gerencie livros, encontros e gravações.</p>
      </div>
      <div className="admin-stats">
        <div>
          <strong>{pending.length}</strong>
          <span>inscrições pendentes</span>
        </div>
        <div>
          <strong>
            {data.applications.filter((a) => a.status === "approved").length}
          </strong>
          <span>integrantes aprovados</span>
        </div>
        <div>
          <strong>{data.books.length}</strong>
          <span>livros cadastrados</span>
        </div>
        <div>
          <strong>{data.meetings.length}</strong>
          <span>encontros cadastrados</span>
        </div>
      </div>
      <div className="tabs admin-tabs">
        {[
          ["applications", "Integrantes", Users],
          ["books", "Biblioteca", BookOpen],
          ["meetings", "Encontros", CalendarDays],
          ["settings", "O clube", Settings2],
        ].map(([id, label, Icon]) => {
          const I = Icon as typeof Users;
          return (
            <button
              key={id as string}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id as string)}
            >
              <I size={16} />
              {label as string}
            </button>
          );
        })}
      </div>
      {actionError && <Notice>{actionError}</Notice>}
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      {tab === "applications" && (
        <>
          <div className="section-heading">
            <h2>Inscrições e integrantes.</h2>
            <button
              className="button primary"
              disabled={busy || !pending.length}
              onClick={() =>
                setConfirmation({ kind: "bulk", ids: pending.map((a) => a.id) })
              }
            >
              Aceitar todos{pending.length ? ` (${pending.length})` : ""}
            </button>
          </div>
          <p className="small muted">
            Pendentes primeiro, começando pelos cadastros mais antigos. Os
            resumos por e-mail chegam às 9h e às 18h (Brasília), quando houver
            pendências.
          </p>
          {data.applications.length ? (
            data.applications.map((a, index) => (
              <Fragment key={a.id}>
                {(index === 0 ||
                  data.applications[index - 1].status !== a.status) && (
                  <h3 className="application-group-title">
                    {
                      {
                        pending: "Aguardando aprovação",
                        approved: "Integrantes com acesso",
                        suspended: "Acesso suspenso",
                        rejected: "Cadastros recusados",
                      }[a.status]
                    }
                  </h3>
                )}
                <article className="application-card">
                  <div className="application-heading">
                    <div>
                      <h3>{a.name}</h3>
                      <p>{a.email}</p>
                    </div>
                    <span
                      className={
                        "tag " + (a.status === "approved" ? "green" : "")
                      }
                    >
                      {
                        {
                          pending: "Pendente",
                          approved: "Aprovado",
                          rejected: "Recusado",
                          suspended: "Suspenso",
                        }[a.status]
                      }
                    </span>
                  </div>
                  <p className="small muted">
                    {
                      {
                        beginner: "Iniciante",
                        learning: "Em aprendizado",
                        experienced: "Experiente",
                      }[a.experience as "beginner"]
                    }{" "}
                    · {dateLabel(a.created_at, false)}
                  </p>
                  {a.motivation && <p className="preserve">{a.motivation}</p>}
                  {a.status === "approved" && (
                    <p className="small muted">
                      {a.approval_email_status === "sent"
                        ? "Aviso de aprovação enviado ao serviço de e-mail."
                        : a.approval_email_status === "sending"
                          ? "Envio em andamento ou sem confirmação. Se persistir, contate o suporte antes de reenviar."
                          : a.approval_email_status === "failed"
                            ? "O envio do aviso falhou. Você pode tentar novamente."
                            : "Aviso de aprovação ainda não enviado."}
                    </p>
                  )}
                  <div className="row-actions">
                    {a.status === "approved" &&
                      a.approval_email_status !== "sent" &&
                      a.approval_email_status !== "sending" && (
                        <button
                          className="button small-button"
                          disabled={busy}
                          onClick={() =>
                            void action(
                              "/admin/applications/" + a.id + "/notify",
                              {},
                              "POST",
                            )
                          }
                        >
                          {a.approval_email_status === "failed"
                            ? "Tentar aviso novamente"
                            : "Enviar aviso de aprovação"}
                        </button>
                      )}
                    {a.status !== "approved" && (
                      <button
                        className="button small-button primary"
                        disabled={busy}
                        onClick={() =>
                          void action(
                            "/admin/applications/" + a.id,
                            {
                              status: "approved",
                            },
                            "PATCH",
                            a.status === "suspended"
                              ? "Acesso liberado novamente."
                              : undefined,
                          )
                        }
                      >
                        {a.status === "suspended"
                          ? "Liberar acesso novamente"
                          : "Aceitar cadastro"}
                      </button>
                    )}
                    {a.status === "pending" && (
                      <button
                        className="button small-button"
                        disabled={busy}
                        onClick={() =>
                          void action("/admin/applications/" + a.id, {
                            status: "rejected",
                          })
                        }
                      >
                        Recusar
                      </button>
                    )}
                    {a.status === "approved" && (
                      <button
                        className="button small-button"
                        disabled={busy}
                        onClick={() =>
                          setConfirmation({ kind: "suspend", application: a })
                        }
                      >
                        Suspender acesso
                      </button>
                    )}
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => void reset(a)}
                    >
                      Gerar link para redefinir senha
                    </button>
                  </div>
                </article>
              </Fragment>
            ))
          ) : (
            <Empty title="A primeira inscrição ainda está por vir.">
              Compartilhe a página do clube com quem quer participar.
            </Empty>
          )}
        </>
      )}
      {tab === "books" && (
        <>
          <div className="section-heading">
            <h2>Livros e caminhos de leitura.</h2>
            <button className="button primary" onClick={() => edit("books")}>
              <Plus size={17} />
              Novo livro
            </button>
          </div>
          {data.books.map((b) => (
            <div className="admin-row" key={b.id}>
              <div>
                <h3>{b.title}</h3>
                <p>{b.author}</p>
              </div>
              <button
                className="button small-button"
                onClick={() =>
                  edit("books", {
                    ...b,
                    category_ids: b.categories.map((c) => c.id),
                  })
                }
              >
                Editar
              </button>
            </div>
          ))}
          <div className="section-heading subheading">
            <h2>Ciclos de leitura</h2>
            <button className="button" onClick={() => edit("cycles")}>
              <Plus size={16} />
              Novo ciclo
            </button>
          </div>
          <p className="muted">
            Cada ciclo reúne os encontros de uma leitura. Marque um deles como a
            leitura atual do clube.
          </p>
          {data.cycles.map((c) => (
            <div className="admin-row" key={c.id}>
              <div>
                <h3>{c.title}</h3>
                <p>
                  {data.books.find((b) => b.id === c.book_id)?.title}
                  {c.is_current === 1 && " · Leitura atual"}
                </p>
              </div>
              <button
                className="button small-button"
                onClick={() => edit("cycles", c)}
              >
                Editar
              </button>
            </div>
          ))}
          <div className="section-heading subheading">
            <h2>Categorias</h2>
            <button className="button" onClick={() => edit("categories")}>
              <Plus size={16} />
              Nova categoria
            </button>
          </div>
          <div className="tags">
            {data.categories.map((c) => (
              <button
                className="tag"
                key={c.id}
                onClick={() => edit("categories", c)}
              >
                {c.name}
              </button>
            ))}
          </div>
        </>
      )}
      {tab === "meetings" && (
        <>
          <div className="section-heading">
            <h2>Antes, durante e depois.</h2>
            <button className="button primary" onClick={() => edit("meetings")}>
              <Plus size={17} />
              Novo encontro
            </button>
          </div>
          {data.meetings.length ? (
            data.meetings.map((m) => (
              <article className="application-card" key={m.id}>
                <div className="application-heading">
                  <div>
                    <span className="eyebrow">{m.book_title}</span>
                    <h3>{m.title}</h3>
                    <p>{dateLabel(m.starts_at)} · Brasília</p>
                  </div>
                  <span className="tag">
                    {
                      {
                        scheduled: "Agendado",
                        completed: "Realizado",
                        cancelled: "Cancelado",
                      }[m.status]
                    }
                  </span>
                </div>
                <div className="row-actions">
                  <button
                    className="button small-button"
                    onClick={() => edit("meetings", m)}
                  >
                    Editar encontro
                  </button>
                  <button
                    className="button small-button"
                    onClick={() => {
                      const r = data.recordings.find(
                        (r) => r.meeting_id === m.id,
                      );
                      edit("recordings", {
                        meeting_id: m.id,
                        url: r ? "https://youtu.be/" + r.youtube_id : "",
                        published: r?.published ?? 1,
                      });
                    }}
                  >
                    <Video size={16} />
                    Gravação
                  </button>
                  <button
                    className="button small-button"
                    onClick={() => edit("resources", { meeting_id: m.id })}
                  >
                    <Link2 size={16} />
                    Adicionar material
                  </button>
                  {m.status === "scheduled" &&
                    !!m.starts_at &&
                    Date.parse(m.starts_at) > Date.now() && (
                      <button
                        className="button small-button"
                        disabled={busy}
                        onClick={() => setInviting(m)}
                      >
                        <Mail size={16} />
                        Enviar convite por e-mail
                      </button>
                    )}
                </div>
                <MeetingTotals data={data} meetingId={m.id} />
                {data.resources
                  .filter((r) => r.meeting_id === m.id)
                  .map((r) => (
                    <div className="resource-admin" key={r.id}>
                      <a href={r.url} target="_blank" rel="noreferrer">
                        {r.title}
                      </a>
                      <button
                        className="text-button"
                        onClick={() => edit("resources", r)}
                      >
                        Editar material
                      </button>
                    </div>
                  ))}
              </article>
            ))
          ) : (
            <Empty title="Pronto para marcar o primeiro encontro?">
              Defina a data, os capítulos e o link da reunião. Você pode
              adicionar a gravação depois.
            </Empty>
          )}
        </>
      )}
      {tab === "settings" && (
        <div className="settings-summary">
          <h2>{data.settings.club_name}</h2>
          <p>{data.settings.description}</p>
          <h3>Grupo do WhatsApp</h3>
          <p className="break-word">
            {data.settings.whatsapp_url || "Ainda não configurado."}
          </p>
          <h3>Servidor do Discord</h3>
          <p className="break-word">
            {data.settings.discord_url || "Ainda não configurado."}
          </p>
          <h3>Combinados do clube</h3>
          <p className="preserve">{data.settings.community_guidelines}</p>
          <button
            className="button primary"
            onClick={() => edit("settings", data.settings)}
          >
            Editar informações <ArrowRight size={16} />
          </button>
        </div>
      )}
      {draft && (
        <Editor
          draft={draft}
          data={data}
          close={() => setDraft(null)}
          saved={async () => {
            setDraft(null);
            setMessage("Conteúdo salvo.");
            await reload();
            window.dispatchEvent(new Event("content-refresh"));
          }}
        />
      )}
      {confirmation && (
        <div className="modal-overlay">
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-confirm-title"
          >
            <button
              className="dialog-close icon-btn"
              disabled={busy}
              onClick={() => setConfirmation(null)}
              aria-label="Cancelar"
            >
              <X />
            </button>
            <h2 id="member-confirm-title">
              {confirmation.kind === "bulk"
                ? `Aceitar ${confirmation.ids.length} ${confirmation.ids.length === 1 ? "cadastro pendente" : "cadastros pendentes"}?`
                : `Suspender o acesso de ${confirmation.application.name}?`}
            </h2>
            <p>
              {confirmation.kind === "bulk"
                ? "Os cadastros pendentes desta lista terão acesso ao clube e receberão o aviso por e-mail. Pessoas suspensas ou recusadas continuam com o mesmo status."
                : "A pessoa perde o acesso à biblioteca, aos encontros e à comunidade. Você pode liberar o acesso novamente depois."}
            </p>
            <div className="row-actions">
              <button
                className="button"
                disabled={busy}
                onClick={() => setConfirmation(null)}
              >
                Cancelar
              </button>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => void confirmMembers()}
              >
                {busy
                  ? "Aceitando cadastros…"
                  : confirmation.kind === "bulk"
                    ? "Confirmar e aceitar todos"
                    : "Confirmar suspensão"}
              </button>
            </div>
          </section>
        </div>
      )}
      {inviting && (
        <div className="modal-overlay">
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-title"
          >
            <button
              className="dialog-close icon-btn"
              disabled={busy}
              onClick={() => setInviting(null)}
              aria-label="Cancelar"
            >
              <X />
            </button>
            <h2 id="invite-title">Enviar convite de “{inviting.title}”?</h2>
            <p>
              Os membros aprovados que aceitam avisos de encontros recebem um
              e-mail com a data ({dateLabel(inviting.starts_at)}, Brasília), o
              botão para confirmar presença e o convite para a agenda. Quem já
              recebeu este convite não recebe de novo.
            </p>
            <div className="row-actions">
              <button
                className="button"
                disabled={busy}
                onClick={() => setInviting(null)}
              >
                Cancelar
              </button>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => void sendInvitations()}
              >
                {busy ? "Enviando convites…" : "Confirmar e enviar"}
              </button>
            </div>
          </section>
        </div>
      )}
      {resetLink && (
        <div className="modal-overlay">
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
          >
            <button
              className="dialog-close icon-btn"
              onClick={() => setResetLink("")}
              aria-label="Fechar"
            >
              <X />
            </button>
            <h2 id="reset-title">Link individual de recuperação</h2>
            <p>
              Confirme a identidade da pessoa e envie este link em uma conversa
              privada. Ele expira em 30 minutos e só pode ser usado uma vez.
            </p>
            <input
              readOnly
              value={resetLink}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Link de recuperação"
            />
            <button
              className="button primary"
              onClick={() =>
                void navigator.clipboard
                  .writeText(resetLink)
                  .then(() => setMessage("Link copiado."))
                  .catch(() => setMessage("Selecione o campo e copie o link."))
              }
            >
              Copiar link
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
function MeetingTotals({
  data,
  meetingId,
}: {
  data: AdminData;
  meetingId: string;
}) {
  const invited = data.invitations
    .filter((i) => i.meeting_id === meetingId && i.status === "sent")
    .reduce((sum, i) => sum + i.total, 0);
  const answer = (response: string) =>
    data.rsvps.find(
      (r) => r.meeting_id === meetingId && r.response === response,
    )?.total ?? 0;
  const yes = answer("yes"),
    no = answer("no");
  if (!invited && !yes && !no) return null;
  return (
    <p className="muted">
      {invited} {invited === 1 ? "convite enviado" : "convites enviados"} ·{" "}
      {yes} {yes === 1 ? "confirmou presença" : "confirmaram presença"} · {no}{" "}
      {no === 1 ? "não vai" : "não vão"}
    </p>
  );
}
function Editor({
  draft,
  data,
  close,
  saved,
}: {
  draft: Draft;
  data: AdminData;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const { kind, value } = draft;
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useDialogFocus(true, () => {
    if (!busy) close();
  });
  const v = (key: string, fallback = "") => String(value[key] ?? fallback);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body: Record<string, unknown> = Object.fromEntries(form);
    if (kind === "books") body.category_ids = form.getAll("category_ids");
    if (kind === "cycles")
      body.is_current = form.get("is_current") === "on" ? 1 : 0;
    if (kind === "recordings")
      body.published = form.get("published") === "on" ? 1 : 0;
    if (kind === "meetings") {
      body.starts_at = body.starts_at
        ? new Date(String(body.starts_at) + "-03:00").toISOString()
        : null;
      body.duration_minutes = Number(body.duration_minutes);
    }
    setBusy(true);
    setError("");
    try {
      const editing =
        !!value.id && kind !== "recordings" && kind !== "settings";
      await save(
        "/admin/" + kind + (editing ? "/" + value.id : ""),
        body,
        kind === "settings" || editing ? "PATCH" : "POST",
      );
      await saved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function field(
    name: string,
    label: string,
    options: {
      area?: boolean;
      required?: boolean;
      type?: string;
      fallback?: string;
      max?: number;
    } = {},
  ) {
    return (
      <label key={name}>
        {label}
        {options.area ? (
          <textarea
            name={name}
            rows={4}
            defaultValue={v(name)}
            maxLength={options.max || 12000}
          />
        ) : (
          <input
            name={name}
            type={options.type || "text"}
            required={options.required}
            defaultValue={v(name, options.fallback)}
            maxLength={options.max || 2000}
          />
        )}
      </label>
    );
  }
  const bookSelect = (
    <label>
      Livro
      <select
        name="book_id"
        defaultValue={v("book_id", data.books[0]?.id)}
        required
      >
        {data.books.map((b) => (
          <option key={b.id} value={b.id}>
            {b.title}
          </option>
        ))}
      </select>
    </label>
  );
  const meetingSelect = (
    <label>
      Encontro
      <select
        name="meeting_id"
        defaultValue={v("meeting_id", data.meetings[0]?.id)}
        required
      >
        {data.meetings.map((m) => (
          <option key={m.id} value={m.id}>
            {m.book_title} · {m.title}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div
      className="modal-overlay"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !busy) close();
      }}
    >
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
      >
        <button
          className="dialog-close icon-btn"
          disabled={busy}
          onClick={close}
          aria-label="Fechar"
        >
          <X />
        </button>
        <span className="eyebrow">Organizar o clube</span>
        <h2 id="editor-title">
          {value.id ? "Editar" : "Cadastrar"} {names[kind].toLowerCase()}
        </h2>
        <form onSubmit={submit}>
          {kind === "books" && (
            <>
              {field("title", "Título", { required: true, max: 200 })}
              {field("author", "Autor", { required: true, max: 200 })}
              {field("description", "Apresentação", { area: true })}
              <div className="form-grid">
                {field("edition", "Edição", { max: 200 })}
                {field("level", "Nível", { fallback: "Iniciante", max: 100 })}
              </div>
              <label>
                Estado da leitura
                <select name="status" defaultValue={v("status", "planned")}>
                  <option value="planned">Planejada</option>
                  <option value="reading">Em leitura</option>
                  <option value="completed">Concluída</option>
                  <option value="archived">Arquivada</option>
                </select>
              </label>
              <fieldset>
                <legend>Categorias</legend>
                <div className="category-options">
                  {data.categories.map((c) => (
                    <label className="checkbox-label" key={c.id}>
                      <input
                        type="checkbox"
                        name="category_ids"
                        value={c.id}
                        defaultChecked={(
                          (value.category_ids as string[]) || []
                        ).includes(c.id)}
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          )}
          {kind === "cycles" && (
            <>
              {bookSelect}
              {field("title", "Nome do ciclo", { required: true, max: 200 })}
              <label className="checkbox-label">
                <input
                  name="is_current"
                  type="checkbox"
                  defaultChecked={value.is_current === 1}
                />
                Leitura atual do clube
              </label>
            </>
          )}
          {kind === "categories" &&
            field("name", "Nome da categoria", { required: true, max: 100 })}
          {kind === "meetings" && (
            <>
              <label>
                Ciclo de leitura
                <select
                  name="cycle_id"
                  required
                  defaultValue={v("cycle_id", data.cycles[0]?.id)}
                >
                  {data.cycles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {data.books.find((book) => book.id === c.book_id)?.title}{" "}
                      · {c.title}
                    </option>
                  ))}
                </select>
              </label>
              {field("title", "Título do encontro", {
                required: true,
                max: 200,
              })}
              {field("chapters", "Capítulos ou leitura combinada", {
                max: 500,
              })}
              <div className="form-grid">
                <label>
                  Data e hora · Brasília
                  <input
                    name="starts_at"
                    type="datetime-local"
                    defaultValue={inputDate(value.starts_at as string | null)}
                  />
                </label>
                <label>
                  Duração em minutos
                  <input
                    type="number"
                    name="duration_minutes"
                    min={15}
                    max={480}
                    defaultValue={v("duration_minutes", "60")}
                  />
                </label>
              </div>
              <p className="small muted">
                Deixe a data em branco se ela ainda não estiver definida.
              </p>
              <label>
                Situação
                <select name="status" defaultValue={v("status", "scheduled")}>
                  <option value="scheduled">Agendado</option>
                  <option value="completed">Realizado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </label>
              {field("meeting_url", "Link da reunião", { type: "url" })}
              {field("agenda", "Pauta e orientações", { area: true })}
              {field("summary", "Notas depois do encontro", { area: true })}
            </>
          )}
          {kind === "resources" && (
            <>
              {meetingSelect}
              {field("title", "Nome do material", { required: true, max: 200 })}
              {field("url", "Link HTTPS", { required: true, type: "url" })}
            </>
          )}
          {kind === "recordings" && (
            <>
              {meetingSelect}
              {field("url", "Link do YouTube", { required: true })}
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="published"
                  defaultChecked={value.published !== 0}
                />
                Disponível para os integrantes
              </label>
              <p className="small muted">
                O vídeo permanece no YouTube. Use a opção “Não listado” ao
                publicar.
              </p>
            </>
          )}
          {kind === "settings" && (
            <>
              {field("club_name", "Nome do clube", {
                required: true,
                max: 200,
              })}
              {field("description", "Apresentação curta", {
                required: true,
                max: 1000,
              })}
              {field("whatsapp_url", "Link do grupo no WhatsApp", {
                type: "url",
              })}
              {field("discord_url", "Convite do Discord", {
                type: "url",
              })}
              {field("community_guidelines", "Combinados da comunidade", {
                area: true,
              })}
            </>
          )}
          {error && <Notice>{error}</Notice>}
          <div className="row-actions">
            <button className="button primary" disabled={busy}>
              {busy ? "Salvando…" : "Salvar"}
            </button>
            <button
              className="button"
              type="button"
              disabled={busy}
              onClick={close}
            >
              Cancelar
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
