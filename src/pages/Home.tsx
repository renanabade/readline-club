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
  GitPullRequest,
} from "lucide-react";
import { useSession } from "../lib/session";
import { BookArt, Empty, MeetingRow } from "../components/ui";
import { useData } from "../lib/useData";
import type { Meeting } from "../../shared/contracts";
import { isUpcoming } from "../lib/dates";
import { WhatsAppAccess } from "../components/WhatsAppAccess";
import { NextMeetingNotice } from "../components/NextMeetingNotice";
import { HomeStatus } from "../components/HomeStatus";
function MemberNext() {
  const { data } = useData<Meeting[]>("/meetings");
  const next = data?.find((m) => m.status === "scheduled" && isUpcoming(m));
  const recording = data?.filter((m) => m.youtube_id).at(-1);
  return (
    <section className="container section member-next">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Acompanhe a leitura</span>
          <h2>Encontros e gravações</h2>
        </div>
        <Link to="/agenda" className="text-link">
          Ver encontros <ArrowUpRight size={18} />
        </Link>
      </div>
      {next ? (
        <MeetingRow meeting={next} />
      ) : (
        <div className="quiet-card">
          <CalendarDays size={27} />
          <div>
            <h3>Nenhum encontro marcado por enquanto.</h3>
            <p>
              A próxima data vai aparecer aqui. Os combinados também passam pelo
              grupo do WhatsApp.
            </p>
          </div>
        </div>
      )}
      {recording && <MeetingRow meeting={recording} />}
    </section>
  );
}
export default function Home() {
  const { home, user } = useSession();
  if (!home) return <HomeStatus />;
  const member =
    user &&
    !user.mustChangePassword &&
    (user.role === "admin" || user.status === "approved");
  return (
    <>
      <section className="container hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="live-dot" />O clube do livro para profissionais de
            tecnologia
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
            <Link
              className="button primary"
              to={member ? "/biblioteca" : user ? "/conta" : "/inscricao"}
            >
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
              Gente de dados, segurança, desenvolvimento e quem ainda está
              escolhendo uma área.
            </p>
          </div>
          <p className="hero-whatsapp">
            Já teve o cadastro aprovado?{" "}
            <Link to="/comunidade">
              Conheça os grupos do clube <ArrowUpRight size={14} />
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
      <NextMeetingNotice />
      <div className="container home-whatsapp">
        <WhatsAppAccess />
      </div>
      <div className="manifesto">
        <div className="container">
          <span>Leitura por capítulos</span>
          <span>Encontros gravados</span>
          <span>WhatsApp e Discord</span>
          <Code2 size={25} strokeWidth={1.5} />
        </div>
      </div>
      {member ? (
        <MemberNext />
      ) : (
        <section className="container section" aria-labelledby="why-read">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Por que ler em grupo</span>
              <h2 id="why-read">Sempre tem algo que rende uma conversa.</h2>
            </div>
            <p>
              Uma dúvida no exemplo, um trecho confuso ou algo que você já viu
              acontecer no trabalho.
            </p>
          </div>
          <div className="steps">
            <article>
              <span className="step-number">01</span>
              <Layers size={25} strokeWidth={1.5} />
              <h3>Retome aquele livro parado.</h3>
              <p>
                Com um trecho combinado para cada encontro, fica mais fácil
                reservar um tempo para ler e seguir até o fim.
              </p>
            </article>
            <article>
              <span className="step-number">02</span>
              <MessagesSquare size={25} strokeWidth={1.5} />
              <h3>Traga o que não ficou claro.</h3>
              <p>
                Às vezes outro exemplo resolve uma dúvida que o livro deixou.
                Nos encontros, dá para perguntar, refazer o raciocínio e ouvir
                como cada pessoa entendeu o mesmo trecho.
              </p>
            </article>
            <article>
              <span className="step-number">03</span>
              <GitPullRequest size={25} strokeWidth={1.5} />
              <h3>Ouça quem faz diferente.</h3>
              <p>
                Quem já usou uma ideia do livro pode contar onde ela funcionou e
                onde deu problema. Quem está aprendendo costuma trazer perguntas
                que o resto do grupo nem tinha pensado em fazer.
              </p>
            </article>
          </div>
        </section>
      )}
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
            Se você está começando a estudar computação, pode vir. Escolhemos
            Entendendo Algoritmos como primeira leitura porque ele apresenta os
            conceitos com ilustrações e exemplos, sem exigir muita bagagem.
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
      <section className="container section reading-format" id="como-funciona">
        <div>
          <span className="eyebrow">Como funciona</span>
          <h2>A dinâmica perfeita para a sua rotina.</h2>
          <p className="prose">
            Avançamos de forma constante, sem pesar no seu dia a dia. A gente
            combina a leitura e as datas pelo grupo, e os resumos ficam salvos
            aqui.
          </p>
        </div>
        <ol className="format-list">
          <li>
            <span>01</span>
            <div>
              <h3>Leitura individual</h3>
              <p>
                Combinamos um trecho do livro para cada encontro. Você lê no seu
                próprio ritmo e horário, sem pressão ou sobrecarga diária.
              </p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Debates ao vivo</h3>
              <p>
                Nos reunimos (com gravação disponível) para esmiuçar a leitura,
                levantar dúvidas reais do mercado e aplicar a teoria na prática.
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Networking na prática</h3>
              <p>
                O aprendizado não para. Tire dúvidas no WhatsApp durante a
                semana e expanda sua rede de contatos no Discord do clube.
              </p>
            </div>
          </li>
        </ol>
      </section>
      <section className="container home-cta">
        <h2>Pronto para tirar os livros técnicos da estante?</h2>
        <p>
          Junte-se a profissionais de diversas áreas de tecnologia para
          debatermos os clássicos. O acesso ao clube é, e sempre será, 100%
          gratuito.
        </p>
        <Link
          to={user ? "/biblioteca" : "/inscricao"}
          className="button primary"
        >
          {user ? "Abrir a biblioteca" : "Participe gratuitamente"}
          <ArrowRight size={20} aria-hidden="true" />
        </Link>
      </section>
    </>
  );
}
