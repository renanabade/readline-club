import { NextMeetingNotice } from "../components/NextMeetingNotice";
import { CalendarActions } from "../components/CalendarActions";
import { MeetingRsvp } from "../components/MeetingRsvp";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
  Clock,
  Play,
  ExternalLink,
  BookOpen,
  CheckCircle,
  LockKeyhole,
} from "lucide-react";
import { BookArchive } from "../components/BookArchive";
import { WhatsAppAccess } from "../components/WhatsAppAccess";
import { HomeStatus } from "../components/HomeStatus";
import { useSession } from "../lib/session";
import { useData } from "../lib/useData";
import { save } from "../lib/api";
import { dateLabel, isUpcoming } from "../lib/dates";
import {
  BookCard,
  BookArt,
  Loading,
  Notice,
  Empty,
  MeetingRow,
} from "../components/ui";
import type {
  Book,
  Meeting,
  Cycle,
  Resource,
  MeetingDetail,
} from "../../shared/contracts";
export function Library() {
  const { home, user } = useSession();
  const [filter, setFilter] = useState("all"),
    [category, setCategory] = useState("all"),
    [search, setSearch] = useState("");
  if (!home) return <HomeStatus />;
  const categories = [
    ...new Map(
      home.books.flatMap((b) => b.categories).map((c) => [c.id, c]),
    ).values(),
  ];
  const list = home.books.filter(
    (b) =>
      (filter === "all" || b.status === filter) &&
      (category === "all" || b.categories.some((c) => c.id === category)) &&
      (b.title + " " + b.author).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="container page">
      <div className="page-heading">
        <span className="eyebrow">Acervo técnico</span>
        <h1>Nossa biblioteca.</h1>
        <p>
          Cada livro reúne seus ciclos de leitura, encontros gravados, notas e
          materiais. Abra uma leitura para consultar seu acervo.
        </p>
      </div>
      <div className="filters">
        <div className="tabs" aria-label="Filtrar por leitura">
          {[
            ["all", "Todas as leituras"],
            ["reading", "Em leitura"],
            ["completed", "Já lemos"],
            ["planned", "Próximas"],
          ].map(([id, label]) => (
            <button
              className={filter === id ? "active" : ""}
              key={id}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="search-filters">
          <input
            aria-label="Buscar livro ou autor"
            placeholder="Buscar livro ou autor"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Categoria"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">Todos os assuntos</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {list.length ? (
        <div className="books-grid">
          {list.map((b) => (
            <BookCard book={b} key={b.id} />
          ))}
        </div>
      ) : (
        <Empty title="Nenhum livro encontrado com esses filtros.">
          Novas leituras vão chegando com o clube. Experimente outro filtro.
        </Empty>
      )}
      {!user && (
        <div className="inline-invite">
          <LockKeyhole size={23} />
          <p>
            Os encontros e as gravações ficam disponíveis para integrantes
            aprovados.
          </p>
          <Link className="text-link" to="/inscricao">
            Quero participar <ArrowRight size={17} />
          </Link>
        </div>
      )}
    </div>
  );
}
export function BookPage() {
  const { id } = useParams();
  const { data, error, loading } = useData<{
    book: Book;
    cycles: Cycle[];
    meetings: Meeting[];
  }>("/books/" + id);
  if (loading) return <Loading />;
  if (error || !data)
    return (
      <div className="container page">
        <Notice>{error}</Notice>
      </div>
    );
  return (
    <div className="container page">
      <Link className="back-link" to="/biblioteca">
        ← Biblioteca
      </Link>
      <div className="book-detail">
        <div className="detail-cover">
          <BookArt book={data.book} />
        </div>
        <div>
          <div className="tags">
            {data.book.categories.map((c) => (
              <span className="tag" key={c.id}>
                {c.name}
              </span>
            ))}
          </div>
          <h1>{data.book.title}</h1>
          <p className="author-line">{data.book.author}</p>
          <p className="prose">{data.book.description}</p>
          <div className="book-meta">
            <span>{data.book.level}</span>
            <span>{data.book.edition || "Edição a combinar"}</span>
          </div>
        </div>
      </div>
      <BookArchive
        key={data.book.id}
        cycles={data.cycles}
        meetings={data.meetings}
      />
    </div>
  );
}
export function MeetingPage() {
  const { id } = useParams();
  const { data, error, loading } = useData<MeetingDetail>("/meetings/" + id);
  if (loading) return <Loading />;
  if (error || !data)
    return (
      <div className="container page">
        <Notice>{error}</Notice>
      </div>
    );
  const m = data.meeting;
  return (
    <div className="container page meeting-page">
      <Link className="back-link" to={"/livros/" + m.book_id}>
        ← {m.book_title}
      </Link>
      <div className="page-heading">
        <span className="eyebrow">{m.chapters || "Encontro do clube"}</span>
        <h1>{m.title}</h1>
        <div className="meeting-meta">
          <span>
            <CalendarDays size={17} />
            {dateLabel(m.starts_at)}
            {m.starts_at && " · Brasília"}
          </span>
          <span>
            <Clock size={17} />
            {m.duration_minutes} minutos
          </span>
          {m.status === "cancelled" && <span className="tag">Cancelado</span>}
        </div>
      </div>
      <div className="meeting-layout">
        <div>
          {m.youtube_id ? (
            <div className="video-frame">
              <iframe
                src={"https://www.youtube-nocookie.com/embed/" + m.youtube_id}
                title={"Gravação: " + m.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="video-empty">
              <Play size={40} strokeWidth={1.2} />
              <h2>
                {m.status === "cancelled"
                  ? "Encontro cancelado."
                  : m.status === "completed"
                    ? "Gravação em preparação."
                    : "Encontro programado."}
              </h2>
              <p>
                {m.status === "completed"
                  ? "A gravação será publicada assim que estiver disponível."
                  : "Depois do encontro, a gravação ficará nesta página."}
              </p>
            </div>
          )}
          {m.summary && (
            <section className="notes">
              <span className="eyebrow">Registro da discussão</span>
              <h2>Notas do encontro.</h2>
              <p className="prose preserve">{m.summary}</p>
            </section>
          )}
        </div>
        <aside className="meeting-sidebar">
          <h3>Antes de chegar</h3>
          <p>
            {m.chapters || "A leitura deste encontro ainda será combinada."}
          </p>
          {m.agenda && <p className="preserve">{m.agenda}</p>}
          {m.meeting_url && m.status === "scheduled" && (
            <a
              className="button primary full"
              href={m.meeting_url}
              target="_blank"
              rel="noreferrer"
            >
              Participar do encontro <ExternalLink size={16} />
            </a>
          )}
          <MeetingRsvp meeting={m} initial={data.rsvp} />
          <CalendarActions meeting={m} />
          <hr />
          <h3>Materiais complementares</h3>
          {data.resources.length ? (
            <ul className="resource-list">
              {data.resources.map((r) => (
                <li key={r.id}>
                  <a href={r.url} target="_blank" rel="noreferrer">
                    {r.title}
                    <ArrowUpRight size={16} />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              Os materiais complementares aparecerão aqui.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
export function Agenda() {
  const { data, error, loading } = useData<Meeting[]>("/meetings");
  const [tab, setTab] = useState("upcoming");
  if (loading) return <Loading />;
  const list = (data || []).filter((m) =>
    tab === "upcoming" ? isUpcoming(m) : !isUpcoming(m),
  );
  if (tab === "past") list.reverse();
  return (
    <div className="container page">
      <div className="page-heading">
        <span className="eyebrow">Agenda do clube</span>
        <h1>Nossos encontros.</h1>
        <p>
          Acompanhe as discussões de cada leitura. Os horários são exibidos no
          fuso de Brasília.
        </p>
      </div>
      <div className="tabs">
        <button
          className={tab === "upcoming" ? "active" : ""}
          onClick={() => setTab("upcoming")}
        >
          Próximos encontros
        </button>
        <button
          className={tab === "past" ? "active" : ""}
          onClick={() => setTab("past")}
        >
          Encontros anteriores
        </button>
      </div>
      {error && <Notice>{error}</Notice>}
      {list.length ? (
        list.map((m) => <MeetingRow key={m.id} meeting={m} />)
      ) : (
        <Empty
          title={
            tab === "upcoming"
              ? "Estamos preparando os próximos encontros."
              : "Nossa história está começando."
          }
        >
          {tab === "upcoming"
            ? "As datas combinadas com o grupo vão aparecer aqui."
            : "Depois dos primeiros encontros, você poderá revisitá-los aqui."}
        </Empty>
      )}
    </div>
  );
}
export function Community() {
  return (
    <div className="container page">
      <div className="page-heading narrow">
        <span className="eyebrow">Sobre o readline club</span>
        <h1>Leitura técnica com troca de experiência.</h1>
        <p>
          Um clube do livro de computação para estudar fundamentos, discutir
          decisões técnicas e aprender com pessoas de diferentes níveis.
        </p>
      </div>
      <NextMeetingNotice contained />
      <WhatsAppAccess guidelines />
      <div className="community-grid community-about">
        <div>
          <h2>Fundamentos primeiro.</h2>
          <p className="prose">
            Nossa primeira leitura é <strong>Entendendo Algoritmos</strong>. O
            foco está em entender os conceitos, refazer exemplos e discutir onde
            cada abordagem se aplica. Você pode participar mesmo que esteja
            começando a estudar computação ou ainda esteja escolhendo uma área.
          </p>
          <h2>Experiências diferentes melhoram a discussão.</h2>
          <p className="prose">
            Quem está começando traz perguntas sobre os fundamentos. Quem já
            trabalha com dados, segurança, desenvolvimento ou outras áreas traz
            experiências e situações reais. Explicar uma solução e discutir seus
            trade-offs ajuda os dois lados a aprofundar o entendimento.
          </p>
          <h2>Leitura, encontros e acervo.</h2>
          <p className="prose">
            Lemos os capítulos combinados e nos reunimos nas datas escolhidas
            pelo grupo. Os encontros são gravados e ficam disponíveis para quem
            participa do clube. Renan vai usar a transcrição do áudio para
            preparar um PDF com os assuntos discutidos e suas explicações,
            disponível junto ao encontro. Quem faltar ou entrar depois poderá
            acompanhar pela gravação ou pelo resumo.
          </p>
          <h2>A conversa continua nos grupos.</h2>
          <p className="prose">
            O grupo é o ponto de encontro do clube no dia a dia. Vale conversar
            sobre o livro, compartilhar referências, trocar experiências,
            perguntar e interagir com o pessoal — inclusive conversar sobre
            outros assuntos. Pode marcar o Renan quando quiser falar com ele. O
            site guarda o acervo e a programação; no WhatsApp, a gente mantém o
            contato. O Discord é opcional e serve para calls de estudo, leitura
            em conjunto, projetos e outras atividades que vocês quiserem
            combinar.
          </p>
          <h2>Nossos combinados.</h2>
          <ul className="principles">
            <li>
              <CheckCircle />
              Respeite as pessoas e seus diferentes ritmos.
            </li>
            <li>
              <CheckCircle />
              Pergunte, compartilhe e escute com atenção.
            </li>
            <li>
              <CheckCircle />
              Peça autorização antes de compartilhar falas e imagens.
            </li>
            <li>
              <CheckCircle />
              Adquira ou pegue emprestado seu exemplar. Não compartilhamos
              cópias dos livros.
            </li>
          </ul>
          <div className="privacy-note">
            <h3>Sobre seu cadastro e as gravações</h3>
            <p>
              Nome, e-mail e informações de inscrição são usados para organizar
              sua participação e ficam disponíveis à administração. Sua senha é
              armazenada com proteção criptográfica. Os encontros são gravados;
              você pode manter câmera e microfone desligados. As gravações são
              hospedadas no YouTube e exibidas na área dos integrantes.
            </p>
            <p>
              Para corrigir ou excluir seus dados, fale com o organizador pelo
              canal de contato do clube.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
export function Status() {
  const { user, refresh } = useSession();
  const status = user?.status;
  return (
    <div className="container page status-page">
      <div className="status-symbol">
        <BookOpen size={35} />
      </div>
      <span className="eyebrow">Status da inscrição</span>
      <h1>
        {status === "suspended"
          ? "Seu acesso está suspenso."
          : status === "rejected"
            ? "Sobre sua inscrição."
            : "Recebemos seu cadastro."}
      </h1>
      <p>
        {status === "suspended"
          ? "Fale com o organizador para entender o motivo e os próximos passos."
          : status === "rejected"
            ? "Sua inscrição não foi aprovada neste momento. Você pode conversar com o organizador."
            : "O organizador vai revisar sua inscrição. Com a aprovação, você terá acesso aos encontros, às gravações e aos grupos de WhatsApp e Discord. Antes de abrir os convites, você vai ler a apresentação do clube e confirmar que está por dentro. Os grupos ficam na página inicial, em O clube e em Minha conta."}
      </p>
      <button className="button" onClick={() => void refresh()}>
        Atualizar meu acesso
      </button>
      <Link className="text-link" to="/biblioteca">
        Conhecer a biblioteca <ArrowUpRight size={17} />
      </Link>
    </div>
  );
}
function MeetingEmails() {
  const { data, error, loading } = useData<{ meetingEmails: boolean }>(
    "/auth/preferences",
  );
  const [value, setValue] = useState<boolean | null>(null),
    [saveError, setSaveError] = useState(""),
    [busy, setBusy] = useState(false);
  const checked = value ?? data?.meetingEmails ?? true;
  async function change(next: boolean) {
    setBusy(true);
    setSaveError("");
    try {
      const result = await save<{ meetingEmails: boolean }>(
        "/auth/preferences",
        { meetingEmails: next },
        "PATCH",
      );
      setValue(result.meetingEmails);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="password-form">
      <h2>Avisos de encontros</h2>
      <p>
        Enviamos por e-mail o convite de cada encontro, com a data, o horário e
        o link para confirmar presença.
      </p>
      <label className="onboarding-confirm">
        <input
          type="checkbox"
          checked={checked}
          disabled={loading || busy || !!error}
          onChange={(e) => void change(e.currentTarget.checked)}
        />
        Receber avisos de encontros por e-mail
      </label>
      {(error || saveError) && <Notice>{error || saveError}</Notice>}
    </section>
  );
}
function DeleteAccount() {
  const { refresh } = useSession();
  const navigate = useNavigate();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function remove(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      await save("/auth/account/delete", { password: form.get("password") });
      await refresh();
      navigate("/", { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <form className="password-form delete-account" onSubmit={remove}>
      <h2>Excluir minha conta</h2>
      <p>
        Apaga seu cadastro, seus dados e suas sessões abertas. Não dá para
        desfazer: para voltar ao clube, será preciso se inscrever e aguardar uma
        nova aprovação. Os grupos de WhatsApp e Discord são separados da
        plataforma; se quiser, saia deles por lá.
      </p>
      <label>
        Senha atual
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
        />
      </label>
      <label className="onboarding-confirm">
        <input type="checkbox" required />
        Entendo que a exclusão é permanente.
      </label>
      {error && <Notice>{error}</Notice>}
      <button className="button" disabled={busy}>
        {busy ? "Excluindo…" : "Excluir minha conta"}
      </button>
    </form>
  );
}
export function Account({ required = false }: { required?: boolean }) {
  const { user, refresh } = useSession();
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function change(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = e.currentTarget;
    try {
      await save("/auth/password", Object.fromEntries(new FormData(form)));
      setMessage("Senha atualizada.");
      form.reset();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {!required && user?.role !== "admin" && user?.status !== "approved" && (
        <Status />
      )}
      <div className="container page account-page">
        <span className="eyebrow">Minha conta</span>
        <h1>
          {required
            ? "Defina sua senha."
            : "Olá, " + user?.name.split(" ")[0] + "."}
        </h1>
        <p>
          {required
            ? "Troque a senha inicial para liberar seu acesso à administração."
            : user?.email}
        </p>
        {!required && user?.role === "admin" && (
          <Link to="/admin" className="button primary">
            Abrir administração <ArrowRight size={16} />
          </Link>
        )}
        {!required && user?.status === "approved" && (
          <Link to="/biblioteca" className="button">
            Minha biblioteca <ArrowRight size={16} />
          </Link>
        )}
        {!required &&
          (user?.status === "approved" || user?.role === "admin") && (
            <WhatsAppAccess />
          )}
        <form className="password-form" onSubmit={change}>
          <h2>{required ? "Uma senha só sua." : "Alterar senha"}</h2>
          <label>
            Senha atual
            <input
              type="password"
              name="currentPassword"
              required
              autoComplete="current-password"
            />
          </label>
          <label>
            Nova senha
            <input
              type="password"
              name="password"
              minLength={10}
              maxLength={128}
              required
              autoComplete="new-password"
              placeholder="Pelo menos 10 caracteres"
            />
          </label>
          {error && <Notice>{error}</Notice>}
          {message && (
            <p className="success" role="status">
              {message}
            </p>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? "Salvando…" : "Salvar nova senha"}
          </button>
        </form>
        {!required && user?.role !== "admin" && user?.status === "approved" && (
          <MeetingEmails />
        )}
        {!required && user?.role !== "admin" && <DeleteAccount />}
      </div>
    </>
  );
}
