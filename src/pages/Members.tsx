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
import { EmailConfirmation } from "../components/EmailConfirmation";
import { SocialLinks } from "../components/SocialLinks";
import { MemberNextMeeting } from "../components/MemberNextMeeting";
import { callLabel, materialLabels } from "../lib/meeting";
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
        <MeetingRsvp meeting={m} initial={data.rsvp} />
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
              {callLabel(m.meeting_url)} <ExternalLink size={16} />
            </a>
          )}
          <CalendarActions meeting={m} />
          <hr />
          <h3>Para revisar sem assistir</h3>
          {data.resources.length ? (
            <ul className="resource-list">
              {data.resources.map((r) => (
                <li key={r.id}>
                  <a href={r.url} target="_blank" rel="noreferrer">
                    <span>
                      <span className="resource-kind">
                        {materialLabels[r.kind] ?? materialLabels.link}
                      </span>
                      {r.title}
                    </span>
                    <ArrowUpRight size={16} />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              {m.status === "completed"
                ? "O resumo em PDF e EPUB, os slides e os materiais deste encontro aparecem aqui assim que forem publicados."
                : "Depois do encontro, o resumo em PDF e EPUB, os slides e os materiais ficam aqui."}
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
  const next = list.find((m) => m.status === "scheduled" && !!m.starts_at);
  return (
    <div className="container page">
      <div className="page-heading">
        <span className="eyebrow">Agenda do clube</span>
        <h1>Nossos encontros.</h1>
        <p>
          Confirme presença, entre na chamada e salve as datas na sua agenda.
          Encontros anteriores ficam com a gravação, o resumo e os slides. Os
          horários seguem o fuso de Brasília.
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
      {tab === "upcoming" && next && <MemberNextMeeting meeting={next} />}
      {list.length ? (
        list
          .filter((m) => tab !== "upcoming" || m !== next)
          .map((m) => <MeetingRow key={m.id} meeting={m} />)
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
        <h1>Como o clube funciona.</h1>
        <p>
          Um clube do livro de computação, gratuito e on-line, para estudar
          fundamentos, discutir decisões técnicas e aprender com pessoas de
          diferentes áreas e níveis.
        </p>
      </div>
      <NextMeetingNotice contained />
      <WhatsAppAccess guidelines />
      <div className="community-grid community-about">
        <div>
          <h2>Leitura combinada, no seu ritmo.</h2>
          <p className="prose">
            A cada ciclo escolhemos um livro e combinamos um trecho para cada
            encontro. Você lê quando puder, anota dúvidas e exemplos, e chega à
            conversa com algo para trocar. Dá para participar mesmo começando a
            estudar computação ou ainda escolhendo uma área.
          </p>
          <h2>Encontros ao vivo, com presença confirmada.</h2>
          <p className="prose">
            Os encontros são on-line, pelo Google Meet. Cada um tem sua página,
            com a pauta, o botão para confirmar presença, o link da chamada e os
            atalhos para o Google Agenda ou o calendário do seu celular. Os
            membros também recebem o convite por e-mail, que pode ser desligado
            em <Link to="/conta">Minha conta</Link>.
          </p>
          <h2>Todo encontro vira acervo.</h2>
          <p className="prose">
            Todos os encontros são gravados e ficam disponíveis na página do
            livro para os membros. Como nem sempre dá para assistir uma hora de
            vídeo, a organização usa a transcrição do encontro, feita com apoio
            de IA, para preparar:
          </p>
          <ul className="principles">
            <li>
              <CheckCircle />
              Um resumo escrito em PDF e EPUB, com o que foi discutido e o
              conteúdo do livro, para ler no computador, no celular ou no leitor
              digital.
            </li>
            <li>
              <CheckCircle />
              Uma versão em slides, para revisar os pontos principais em poucos
              minutos.
            </li>
            <li>
              <CheckCircle />A transcrição, quando ela ajudar a encontrar um
              trecho da conversa.
            </li>
          </ul>
          <h2>Canais oficiais.</h2>
          <p className="prose">
            A plataforma guarda o acervo e a programação. O grupo do WhatsApp é
            o canal oficial de avisos e conversa do dia a dia: vale perguntar,
            compartilhar referências, trocar experiências e falar de outros
            assuntos de tecnologia. O Discord é opcional e serve para calls de
            estudo, leitura em conjunto, projetos e o que a comunidade quiser
            organizar. Os convites dos dois são liberados só para membros
            aprovados, dentro da plataforma.
          </p>
          <SocialLinks title="Redes sociais do clube" />
          <h2>Comunidade e networking.</h2>
          <p className="prose">
            Quem está começando traz perguntas sobre os fundamentos. Quem já
            trabalha com dados, segurança, desenvolvimento ou outras áreas traz
            situações reais. Explicar uma solução e discutir seus trade-offs
            ajuda os dois lados, e as conversas costumam virar contatos,
            indicações e projetos em conjunto.
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
              Não repasse os convites dos grupos: quem quiser entrar faz o
              cadastro.
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
              Nome, e-mail, celular e informações de inscrição são usados para
              organizar sua participação e ficam disponíveis só para a
              organização. Sua senha é armazenada com proteção criptográfica. Os
              encontros são gravados; você pode manter câmera e microfone
              desligados. As gravações são hospedadas no YouTube e exibidas na
              área dos membros.
            </p>
            <p>
              Você pode excluir sua conta a qualquer momento em{" "}
              <Link to="/conta">Minha conta</Link>. Os detalhes estão na{" "}
              <Link to="/privacidade">política de privacidade</Link>.
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
          ? "Fale com a organização para entender o motivo e os próximos passos."
          : status === "rejected"
            ? "Sua inscrição não foi aprovada neste momento. Você pode conversar com a organização."
            : "A organização revisa cada inscrição e avisa por e-mail quando o acesso for liberado. Com a aprovação, você confirma presença nos encontros, assiste às gravações, lê os resumos e recebe os convites dos canais oficiais no WhatsApp e no Discord, depois de ler como o clube funciona."}
      </p>
      {status === "pending" && <EmailConfirmation />}
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
export function MemberPhone() {
  const { data, error, loading } = useData<{ phone: string }>("/auth/profile");
  const [phone, setPhone] = useState<string | null>(null),
    [saveError, setSaveError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const current = phone ?? data?.phone ?? "";
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setSaveError("");
    setMessage("");
    try {
      const result = await save<{ phone: string }>(
        "/auth/profile",
        { phone: new FormData(e.currentTarget).get("phone") },
        "PATCH",
      );
      setPhone(result.phone);
      setMessage("Celular salvo.");
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="password-form" onSubmit={submit}>
      <h2>Seu celular</h2>
      <p>
        A organização usa o número para identificar você no grupo do WhatsApp,
        que é exclusivo para membros. Ele não aparece para outros membros na
        plataforma.
      </p>
      {!loading && !error && !current && (
        <p className="notice" role="status">
          Seu cadastro ainda está sem celular. Adicione o número que você usa no
          WhatsApp.
        </p>
      )}
      <label>
        Celular com DDD
        <input
          key={data?.phone ?? ""}
          type="tel"
          name="phone"
          required
          maxLength={40}
          autoComplete="tel"
          inputMode="tel"
          placeholder="(11) 91234-5678"
          defaultValue={current}
          disabled={loading || !!error}
        />
      </label>
      {(error || saveError) && <Notice>{error || saveError}</Notice>}
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      <button className="button" disabled={busy || loading || !!error}>
        {busy ? "Salvando…" : "Salvar celular"}
      </button>
    </form>
  );
}
function DeleteAccount() {
  const { refresh } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false),
    [error, setError] = useState(""),
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
        Apaga seu cadastro, suas respostas de presença e suas sessões abertas.
        Não dá para desfazer: para voltar ao clube, será preciso se inscrever e
        aguardar uma nova aprovação.
      </p>
      {open ? (
        <>
          <ul className="delete-steps">
            <li>Nome, e-mail, celular e senha são apagados na hora.</li>
            <li>
              Como os grupos do WhatsApp e do Discord são exclusivos para
              membros, a organização retira você deles. Para isso, guardamos só
              seu nome e celular até a retirada, por no máximo 30 dias.
            </li>
            <li>Você deixa de receber os convites de encontros por e-mail.</li>
          </ul>
          <label>
            Confirme com sua senha
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
          <div className="row-actions">
            <button className="button danger" disabled={busy}>
              {busy ? "Excluindo…" : "Excluir minha conta"}
            </button>
            <button
              className="button"
              type="button"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setError("");
              }}
            >
              Manter minha conta
            </button>
          </div>
        </>
      ) : (
        <button className="button" type="button" onClick={() => setOpen(true)}>
          Quero excluir minha conta
        </button>
      )}
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
        {!required && user?.role !== "admin" && <MemberPhone />}
        {!required && user?.role !== "admin" && user?.status === "approved" && (
          <MeetingEmails />
        )}
        {!required && user?.role !== "admin" && <DeleteAccount />}
      </div>
    </>
  );
}
