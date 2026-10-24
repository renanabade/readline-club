import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, MessagesSquare } from "lucide-react";
import { useSession } from "../lib/session";
import { useData } from "../lib/useData";
import { save } from "../lib/api";
import { dateLabel } from "../lib/dates";
import type { CommunityAccess, Identity } from "../../shared/contracts";

function ApprovedAccess({ guidelines }: { guidelines: boolean }) {
  const { data, error, loading, reload } =
    useData<CommunityAccess>("/community");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  async function acknowledge() {
    if (!confirmed || !data || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      await save("/community/acknowledge", {
        version: data.onboardingVersion,
        confirmed: true,
      });
      await reload();
    } catch {
      setSaveError("Não foi possível salvar sua confirmação. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }
  // Best effort: a lost record must never get in the way of joining.
  function joined(channel: "whatsapp" | "discord") {
    save("/community/join", { channel }).catch(() => {});
  }
  const discord = !!(data?.discordAvailable || data?.discord_url);
  // Home and account page: until the introduction is confirmed, send the
  // person to the club page, where confirming and joining sit together.
  if (!guidelines && data?.onboardingRequired)
    return (
      <>
        <span className="eyebrow">Falta um passo</span>
        <h2>Entre no grupo do WhatsApp.</h2>
        <p>
          O grupo é o canal oficial de avisos e conversa do clube. Para receber
          o convite, leia como o clube funciona e confirme que está por dentro.
          Leva um minuto.
        </p>
        <div className="whatsapp-actions">
          <Link className="button primary" to="/comunidade">
            Entrar no grupo do WhatsApp <ArrowUpRight size={18} />
          </Link>
        </div>
      </>
    );
  return (
    <>
      <span className="eyebrow">Canais oficiais do clube</span>
      <h2>
        {discord
          ? "WhatsApp e Discord do clube."
          : "Grupo do WhatsApp do clube."}
      </h2>
      <p>
        O grupo do WhatsApp é o canal oficial de avisos, combinados e conversa
        do dia a dia.
        {discord &&
          " O Discord é opcional: dá para estudar em call, ler junto, conversar e trabalhar em projetos."}
      </p>
      {loading ? (
        <p role="status">Carregando os convites…</p>
      ) : error ? (
        <>
          <p role="alert">Não foi possível carregar os convites.</p>
          <button className="button" onClick={() => void reload()}>
            Tentar novamente
          </button>
        </>
      ) : data?.onboardingRequired ? (
        <div className="whatsapp-guidelines">
          <h3>Antes de entrar, fique por dentro.</h3>
          <ul className="onboarding-points">
            {data.currentBookTitle && (
              <li>
                <strong>Leitura atual: {data.currentBookTitle}.</strong> Lemos
                os capítulos combinados no nosso tempo e conversamos sobre eles
                nos encontros.
              </li>
            )}
            {data.nextMeeting ? (
              <li>
                <strong>
                  Próximo encontro: {dateLabel(data.nextMeeting.starts_at)} ·
                  Brasília.
                </strong>{" "}
                {data.nextMeeting.chapters} · previsão de{" "}
                {data.nextMeeting.duration_minutes} minutos. Confira o evento na{" "}
                <Link to="/agenda">agenda</Link>;{" "}
                {data.nextMeeting.has_call_link ? (
                  <>
                    o link da chamada está na{" "}
                    <Link
                      to={
                        "/encontros/" + encodeURIComponent(data.nextMeeting.id)
                      }
                    >
                      página do encontro
                    </Link>
                    .
                  </>
                ) : (
                  "o link da chamada será informado pelo clube."
                )}
              </li>
            ) : (
              <li>
                Confira a agenda e o grupo para acompanhar os próximos
                encontros.
              </li>
            )}
            <li>
              Os encontros são gravados; a gravação, o resumo em PDF e EPUB
              (feito a partir da transcrição, com apoio de IA) e os slides ficam
              na página do livro. Câmera e microfone podem ficar desligados.
            </li>
            <li>
              No WhatsApp a organização avisa sobre os encontros, e vale
              perguntar e conversar.
              {discord &&
                " O Discord não é obrigatório: calls de estudo e projetos são combinados entre vocês."}
            </li>
            <li>
              Os convites são pessoais: não repasse os links. Respeite os
              diferentes ritmos, peça autorização antes de compartilhar falas ou
              imagens e não compartilhe cópias dos livros.
            </li>
          </ul>
          <label className="onboarding-confirm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            Li como o clube funciona e estou por dentro da leitura e dos
            encontros.
          </label>
          {saveError && <p role="alert">{saveError}</p>}
          <button
            className="button primary"
            disabled={!confirmed || saving}
            onClick={() => void acknowledge()}
          >
            {saving ? "Salvando…" : "Confirmar e liberar os convites"}
          </button>
        </div>
      ) : (
        <div className="whatsapp-actions">
          {data?.whatsapp_url && (
            <a
              className="button primary"
              href={data.whatsapp_url}
              target="_blank"
              rel="noreferrer"
              onClick={() => joined("whatsapp")}
            >
              Entrar no grupo do WhatsApp <ArrowUpRight size={18} />
            </a>
          )}
          {data?.discord_url && (
            <a
              className="button"
              href={data.discord_url}
              target="_blank"
              rel="noreferrer"
              onClick={() => joined("discord")}
            >
              Entrar no Discord <ArrowUpRight size={18} />
            </a>
          )}
        </div>
      )}
      {guidelines &&
        !data?.onboardingRequired &&
        data?.community_guidelines && (
          <div className="whatsapp-guidelines">
            <h3>Nossos combinados</h3>
            <p className="preserve">{data.community_guidelines}</p>
          </div>
        )}
    </>
  );
}

// Logged in but not a member yet: where the account stands, never the
// sign-up and login calls meant for visitors.
function AccountStatus({ user }: { user: Identity }) {
  const [title, text] = user.mustChangePassword
    ? [
        "Defina sua senha para continuar.",
        "Troque a senha inicial em Minha conta para liberar seu acesso.",
      ]
    : user.status === "suspended"
      ? [
          "Seu acesso está suspenso.",
          "Fale com a organização para entender o motivo e os próximos passos.",
        ]
      : user.status === "rejected"
        ? [
            "Sua inscrição não foi aprovada neste momento.",
            "Você pode conversar com a organização sobre a sua inscrição.",
          ]
        : [
            "Seu cadastro está em análise.",
            "A organização revisa cada inscrição e avisa por e-mail quando o acesso for liberado. Com a aprovação, os convites do grupo do WhatsApp e do Discord aparecem aqui, depois de você ler como o clube funciona.",
          ];
  return (
    <>
      <span className="eyebrow">Status da inscrição</span>
      <h2>{title}</h2>
      <p>{text}</p>
      <div className="whatsapp-actions">
        <Link className="button primary" to="/conta">
          {user.mustChangePassword ? "Definir minha senha" : "Ver meu cadastro"}
          <ArrowUpRight size={18} />
        </Link>
      </div>
    </>
  );
}

export function WhatsAppAccess({
  guidelines = false,
}: {
  guidelines?: boolean;
}) {
  const { user, loading } = useSession();
  // Until the session is known, show nothing rather than the visitor's calls.
  if (loading) return null;
  const member =
    user &&
    !user.mustChangePassword &&
    (user.role === "admin" || user.status === "approved");
  return (
    <section className="whatsapp-access" aria-label="Grupos do clube">
      <MessagesSquare className="whatsapp-icon" size={30} strokeWidth={1.5} />
      <div>
        {member ? (
          <ApprovedAccess guidelines={guidelines} />
        ) : user ? (
          <AccountStatus user={user} />
        ) : (
          <>
            <span className="eyebrow">Canais oficiais</span>
            <h2>A conversa continua no WhatsApp e no Discord.</h2>
            <p>
              O grupo do WhatsApp é o canal oficial de avisos e conversa do
              clube. O Discord é opcional: um espaço para calls de estudo,
              leitura em conjunto, projetos e o que a comunidade quiser
              organizar.
            </p>
            <p>
              <strong>
                O acesso aos grupos é liberado com a conta aprovada.
              </strong>{" "}
              Depois de fazer login, leia a apresentação do clube e confirme que
              está por dentro. Os convites aparecem aqui, em{" "}
              <strong>O clube</strong> e em <strong>Minha conta</strong>.
            </p>
            <div className="whatsapp-actions">
              <Link className="button primary" to="/inscricao">
                Participe gratuitamente
                <ArrowUpRight size={18} />
              </Link>
              <Link className="text-link" to="/entrar">
                Já tenho conta · Entrar <ArrowUpRight size={16} />
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
