import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  MessagesSquare,
  Play,
  CalendarDays,
  Code2,
  Layers,
  Video,
  FileText,
  Presentation,
  Users,
  Handshake,
  Gift,
  ShieldCheck,
} from "lucide-react";
import { useSession } from "../lib/session";
import { BookArt, Empty, MeetingRow } from "../components/ui";
import { useData } from "../lib/useData";
import type { Meeting } from "../../shared/contracts";
import { isUpcoming } from "../lib/dates";
import { WhatsAppAccess } from "../components/WhatsAppAccess";
import { NextMeetingNotice } from "../components/NextMeetingNotice";
import { MemberNextMeeting } from "../components/MemberNextMeeting";
import { HomeStatus } from "../components/HomeStatus";
import { SocialLinks } from "../components/SocialLinks";
function MemberNext() {
  const { data } = useData<Meeting[]>("/meetings");
  const next = data?.find(
    (m) => m.status === "scheduled" && !!m.starts_at && isUpcoming(m),
  );
  const recording = data?.filter((m) => m.youtube_id).at(-1);
  return (
    <section className="container section member-next">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Acompanhe a leitura</span>
          <h2>Encontros e gravações</h2>
        </div>
        <Link to="/agenda" className="text-link">
          Ver todos os encontros <ArrowUpRight size={18} />
        </Link>
      </div>
      {next ? (
        <MemberNextMeeting meeting={next} />
      ) : (
        <div className="quiet-card">
          <CalendarDays size={27} />
          <div>
            <h3>Nenhum encontro marcado por enquanto.</h3>
            <p>
              A próxima data aparece aqui e é avisada no grupo do WhatsApp e por
              e-mail.
            </p>
          </div>
        </div>
      )}
      {recording && (
        <>
          <h3 className="member-next-subtitle">Última gravação</h3>
          <MeetingRow meeting={recording} />
        </>
      )}
    </section>
  );
}
const values = [
  {
    icon: Layers,
    title: "Leitura guiada, por capítulos",
    text: "Um trecho combinado para cada encontro. Você lê no seu ritmo e chega ao fim do livro, em vez de deixá-lo na estante.",
  },
  {
    icon: Video,
    title: "Encontros ao vivo, on-line",
    text: "Conversas pelo Google Meet para tirar dúvidas, refazer raciocínios e ligar a teoria ao que acontece no trabalho.",
  },
  {
    icon: FileText,
    title: "Acervo para quem não pôde ir",
    text: "Cada encontro gravado vira acervo: vídeo completo, resumo escrito em PDF e EPUB e slides para revisar em poucos minutos.",
  },
  {
    icon: MessagesSquare,
    title: "Comunidade todos os dias",
    text: "No grupo do WhatsApp e no Discord a conversa continua: dúvidas, referências, calls de estudo e projetos em conjunto.",
  },
  {
    icon: Handshake,
    title: "Networking de verdade",
    text: "Gente de dados, segurança, desenvolvimento, infraestrutura e quem ainda está escolhendo uma área. Contatos que vão além do livro.",
  },
  {
    icon: Gift,
    title: "Gratuito, sempre",
    text: "Sem mensalidade, sem plano pago e sem anúncios. Você só precisa do seu exemplar do livro e de vontade de conversar.",
  },
];
const journey = [
  {
    title: "Faça seu cadastro",
    text: "Nome, e-mail e celular. Leva um minuto e não custa nada.",
  },
  {
    title: "Aguarde a aprovação",
    text: "A organização revisa cada inscrição e avisa por e-mail quando o acesso é liberado.",
  },
  {
    title: "Entre nos canais oficiais",
    text: "Leia como o clube funciona e receba os convites do grupo do WhatsApp e do Discord.",
  },
  {
    title: "Confirme presença",
    text: "Cada encontro tem um botão para confirmar, o link da chamada e o atalho para a sua agenda.",
  },
  {
    title: "Participe ou recupere depois",
    text: "Vá ao vivo ou acompanhe pela gravação, pelo resumo escrito ou pelos slides, quando puder.",
  },
];
const archive = [
  {
    icon: Play,
    title: "Gravação completa",
    text: "Todos os encontros são gravados e ficam na página do livro, para assistir quando quiser.",
  },
  {
    icon: FileText,
    title: "Resumo escrito em PDF e EPUB",
    text: "A partir da transcrição do encontro, feita com apoio de IA, o que foi discutido e o conteúdo do livro viram um texto para ler no computador, no celular ou no leitor digital.",
  },
  {
    icon: Presentation,
    title: "Slides para revisar rápido",
    text: "Os pontos principais em formato de apresentação, para relembrar o encontro em minutos, sem assistir uma hora de vídeo.",
  },
];
const questions = [
  {
    q: "É gratuito mesmo?",
    a: "Sim. O clube é gratuito e vai continuar assim: sem mensalidade, sem conteúdo pago e sem anúncios de terceiros. O único custo é o seu exemplar do livro, que você compra ou pega emprestado.",
  },
  {
    q: "Preciso ter experiência na área?",
    a: "Não. Os livros são escolhidos para que quem está começando consiga acompanhar, e quem já trabalha com tecnologia sempre encontra algo para aprofundar ou discutir.",
  },
  {
    q: "Como funcionam os encontros?",
    a: "São on-line, pelo Google Meet, em datas combinadas com o grupo. Você confirma presença na plataforma, adiciona o evento à agenda e entra pelo link na hora. Pode falar ou só acompanhar, com câmera e microfone desligados se preferir.",
  },
  {
    q: "Não consigo participar ao vivo. E agora?",
    a: "Todos os encontros são gravados. Além do vídeo, cada encontro ganha um resumo escrito em PDF e EPUB e uma versão em slides, disponíveis na página do livro para os membros.",
  },
  {
    q: "Quais são os canais oficiais do clube?",
    a: "A plataforma, o grupo do WhatsApp e o servidor do Discord. Os convites dos grupos são liberados só para membros aprovados, dentro da plataforma. Desconfie de links compartilhados por outros caminhos.",
  },
  {
    q: "Por que vocês pedem meu celular?",
    a: "Para a organização identificar você no grupo do WhatsApp, que é exclusivo para membros. O número não aparece para outros membros na plataforma. Se você excluir sua conta, ele é usado só para retirar você dos grupos e depois apagado.",
  },
  {
    q: "Como saio do clube?",
    a: "Em Minha conta você exclui seu cadastro a qualquer momento, confirmando a senha. A organização retira você dos grupos do WhatsApp e do Discord em seguida.",
  },
];
export default function Home() {
  const { home, user } = useSession();
  if (!home) return <HomeStatus />;
  const member =
    user &&
    !user.mustChangePassword &&
    (user.role === "admin" || user.status === "approved");
  const join = member ? "/biblioteca" : user ? "/conta" : "/inscricao";
  return (
    <>
      <section className="container hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="live-dot" />
            Clube do livro de computação · gratuito
          </div>
          <h1>
            A bagagem teórica que a sua carreira precisa.
            <br />
            <span className="hero-subtitle">
              Sem livros parados na estante.
            </span>
          </h1>
          <p className="hero-description">{home.settings.description}</p>
          <div className="hero-actions">
            <Link className="button primary" to={join}>
              {member
                ? "Continuar a leitura"
                : user
                  ? "Ver meu cadastro"
                  : "Participe gratuitamente"}{" "}
              <ArrowRight size={18} />
            </Link>
            <a href="#como-funciona" className="text-link">
              Como funciona <ArrowUpRight size={17} />
            </a>
          </div>
          <div className="hero-note">
            <div className="reader-icons">
              <span>
                <BookOpen size={16} />
              </span>
              <span>
                <MessagesSquare size={16} />
              </span>
              <span>
                <Play size={14} />
              </span>
            </div>
            <p>
              <strong className="member-count">
                {home.memberCount.toLocaleString("pt-BR")}{" "}
                {home.memberCount === 1 ? "membro" : "membros"} no clube
              </strong>
              <br />
              Encontros ao vivo, acervo gravado e comunidade no WhatsApp e no
              Discord.
            </p>
          </div>
          <p className="hero-whatsapp">
            Já teve o cadastro aprovado?{" "}
            <Link to="/comunidade">
              Veja como o clube funciona <ArrowUpRight size={14} />
            </Link>
          </p>
        </div>
        <div className="hero-book">
          {home.currentBook ? (
            <>
              <div className="book-stage">
                <span className="stage-label">
                  <span className="live-dot" />
                  Leitura atual
                </span>
                <BookArt book={home.currentBook} />
                <span className="stage-note">
                  Para ler um capítulo de cada vez.
                </span>
              </div>
              <Link
                to={member ? "/livros/" + home.currentBook.id : "/biblioteca"}
                className="current-book-caption"
              >
                <div>
                  <span className="eyebrow">Em estudo</span>
                  <h2>{home.currentBook.title}</h2>
                  <p>
                    {home.currentBook.author} <span>·</span>{" "}
                    {home.currentBook.level}
                  </p>
                </div>
                <ArrowUpRight size={26} />
              </Link>
            </>
          ) : (
            <Empty title="Próximo livro em definição.">
              A próxima leitura será anunciada aqui.
            </Empty>
          )}
        </div>
      </section>
      {!member && <NextMeetingNotice />}
      <div className="manifesto">
        <div className="container">
          <span>Leitura por capítulos</span>
          <span>Encontros ao vivo e gravados</span>
          <span>Resumos em PDF e EPUB</span>
          <span>WhatsApp e Discord oficiais</span>
          <Code2 size={25} strokeWidth={1.5} />
        </div>
      </div>
      {member ? (
        <>
          <MemberNext />
          <div className="container home-whatsapp">
            <WhatsAppAccess />
          </div>
        </>
      ) : (
        <section className="container section" aria-labelledby="values-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">O que você leva</span>
              <h2 id="values-title">Muito mais do que uma lista de leitura.</h2>
            </div>
            <p>
              Um livro técnico rende mais quando tem data para conversar, gente
              para perguntar e um acervo para voltar depois.
            </p>
          </div>
          <div className="value-grid">
            {values.map(({ icon: Icon, title, text }) => (
              <article key={title}>
                <Icon size={24} strokeWidth={1.5} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
      )}
      {!member && (
        <section
          className="container community-panel"
          aria-labelledby="community-title"
        >
          <div>
            <span className="eyebrow">Comunidade e networking</span>
            <h2 id="community-title">
              A leitura é o ponto de partida. A rede fica.
            </h2>
            <p>
              Os encontros acontecem algumas vezes por mês; a comunidade, todos
              os dias. É lá que surgem as indicações de livros, as dúvidas de
              trabalho, as calls de estudo e os contatos que você leva para a
              carreira.
            </p>
          </div>
          <div className="channel-list">
            <article>
              <MessagesSquare size={22} aria-hidden="true" />
              <div>
                <h3>Grupo do WhatsApp · canal oficial</h3>
                <p>
                  Avisos dos encontros, combinados da leitura e conversa do dia
                  a dia, inclusive sobre outros assuntos de tecnologia.
                </p>
              </div>
            </article>
            <article>
              <Users size={22} aria-hidden="true" />
              <div>
                <h3>Servidor do Discord · canal oficial</h3>
                <p>
                  Calls de estudo, leitura em conjunto, projetos e o que a
                  comunidade quiser organizar. É opcional.
                </p>
              </div>
            </article>
            <article>
              <ShieldCheck size={22} aria-hidden="true" />
              <div>
                <h3>Convites só para membros</h3>
                <p>
                  Os links dos grupos são liberados dentro da plataforma, depois
                  da aprovação. Assim o espaço continua seguro e sem spam.
                </p>
              </div>
            </article>
          </div>
        </section>
      )}
      <section className="container section reading-format" id="como-funciona">
        <div>
          <span className="eyebrow">Como funciona</span>
          <h2>Do cadastro ao primeiro encontro.</h2>
          <p className="prose">
            Um caminho simples, pensado para caber na rotina de quem estuda e
            trabalha.
          </p>
        </div>
        <ol className="format-list">
          {journey.map(({ title, text }, index) => (
            <li key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="container section" aria-labelledby="archive-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Perdeu o encontro?</span>
            <h2 id="archive-title">O acervo cuida disso.</h2>
          </div>
          <p>
            Uma hora de vídeo nem sempre cabe no dia. Por isso cada encontro
            ganha três formatos, na página do livro, para os membros.
          </p>
        </div>
        <div className="steps">
          {archive.map(({ icon: Icon, title, text }, index) => (
            <article key={title}>
              <span className="step-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <Icon size={25} strokeWidth={1.5} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section
        className="container levels-panel"
        aria-labelledby="levels-title"
      >
        <div>
          <span className="eyebrow">Quem pode participar</span>
          <h2 id="levels-title">Não precisa chegar sabendo.</h2>
        </div>
        <div className="levels-copy">
          <p>
            Se você está começando a estudar computação, pode vir. As leituras
            são escolhidas para apresentar os conceitos com exemplos, sem exigir
            muita bagagem.
          </p>
          <p>
            O clube também é para quem trabalha com dados, segurança,
            desenvolvimento ou outras áreas de tecnologia. É uma chance de
            voltar a assuntos que você usa no dia a dia e conversar com gente
            que teve outras experiências com eles.
          </p>
          <p className="levels-note">
            Não precisa preparar uma apresentação. Suas perguntas e anotações já
            dão assunto para o encontro.
          </p>
        </div>
      </section>
      <section className="container section faq" aria-labelledby="faq-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Perguntas frequentes</span>
            <h2 id="faq-title">Antes de entrar.</h2>
          </div>
        </div>
        <div className="faq-list">
          {questions.map(({ q, a }) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="container home-cta">
        <h2>Pronto para tirar os livros técnicos da estante?</h2>
        <p>
          Junte-se a pessoas de diversas áreas de tecnologia para ler e debater
          os clássicos. O acesso ao clube é, e sempre será, 100% gratuito.
        </p>
        <Link to={member ? "/biblioteca" : join} className="button primary">
          {member
            ? "Abrir a biblioteca"
            : user
              ? "Ver meu cadastro"
              : "Participe gratuitamente"}
          <ArrowRight size={20} aria-hidden="true" />
        </Link>
        <SocialLinks title="Acompanhe o clube" />
      </section>
    </>
  );
}
