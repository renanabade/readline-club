import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, MessagesSquare } from "lucide-react";
import { useSession } from "../lib/session";
import { useData } from "../lib/useData";
import { save } from "../lib/api";
import { dateLabel } from "../lib/dates";
import type { CommunityAccess } from "../../shared/contracts";

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
  return (
    <>
      <span className="eyebrow">Sua conta já tem acesso</span>
      <h2>WhatsApp e Discord do clube.</h2>
      <p>
        O WhatsApp é nosso grupo de conversa e combinados. O Discord é opcional:
        dá para estudar em call, ler junto, conversar e trabalhar em projetos.
        Use o espaço como fizer sentido para você.
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
          <p>
            Somos um clube do livro de computação, com pessoas de diferentes
            áreas e níveis. Combinamos capítulos, lemos no nosso tempo e nos
            encontramos para discutir o conteúdo, tirar dúvidas e compartilhar
            experiências. Você pode falar ou só acompanhar.
          </p>
          {data.currentBookTitle && (
            <p>
              <strong>Leitura atual: {data.currentBookTitle}.</strong>
            </p>
          )}
          {data.nextMeeting ? (
            <p>
              <strong>
                Próximo encontro: {dateLabel(data.nextMeeting.starts_at)} ·
                Brasília.
              </strong>
              <br />
              {data.nextMeeting.chapters} · previsão de{" "}
              {data.nextMeeting.duration_minutes} minutos. Confira o evento na{" "}
              <Link to="/agenda">agenda</Link>; o link da chamada será informado
              pelo clube.
            </p>
          ) : (
            <p>
              Confira a agenda e o grupo para acompanhar os próximos encontros.
            </p>
          )}
          <p>
            Os encontros são gravados. A gravação e o resumo em PDF preparado
            por Renan ficam na área do livro para os integrantes aprovados. Você
            pode manter câmera e microfone desligados.
          </p>
          <p>
            O WhatsApp está aberto a perguntas, referências e conversa geral.
            Pode marcar o Renan à vontade. O Discord não é obrigatório e as
            calls de estudo, leituras em conjunto e projetos podem ser
            combinados entre vocês.
          </p>
          <p>
            Respeite as pessoas e os diferentes ritmos. Peça autorização antes
            de compartilhar falas ou imagens. Não compartilhamos cópias dos
            livros.
          </p>
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

export function WhatsAppAccess({
  guidelines = false,
}: {
  guidelines?: boolean;
}) {
  const { user } = useSession();
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
        ) : (
          <>
            <span className="eyebrow">Nossos grupos</span>
            <h2>A conversa continua no WhatsApp e no Discord.</h2>
            <p>
              O WhatsApp é para conversar, compartilhar referências e acompanhar
              os combinados. O Discord é opcional: um espaço para calls de
              estudo, leitura em conjunto, projetos e o que vocês quiserem
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
              <Link
                className="button primary"
                to={user ? "/conta" : "/inscricao"}
              >
                {user ? "Ver meu cadastro" : "Participe gratuitamente"}
                <ArrowUpRight size={18} />
              </Link>
              {!user && (
                <Link className="text-link" to="/entrar">
                  Já tenho conta · Entrar <ArrowUpRight size={16} />
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
