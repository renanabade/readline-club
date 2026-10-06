import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen, Check } from "lucide-react";
import { useSession } from "../lib/session";
import { save } from "../lib/api";
import { Notice } from "../components/ui";
import { Turnstile } from "../components/Turnstile";
export default function Auth({ mode }: { mode: "login" | "signup" | "reset" }) {
  const { home, refresh } = useSession();
  const navigate = useNavigate();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [token, setToken] = useState(""),
    [attempt, setAttempt] = useState(0),
    [forgot, setForgot] = useState(false);
  const signup = mode === "signup",
    reset = mode === "reset";
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const d = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (signup) {
        await save("/auth/register", {
          ...d,
          consent: d.consent === "on",
          turnstileToken: token,
        });
        setDone(true);
      } else if (reset) {
        await save("/auth/reset", {
          password: d.password,
          token: window.location.hash.slice(1),
        });
        history.replaceState(null, "", "/redefinir-senha");
        setDone(true);
      } else {
        await save("/auth/login", d);
        await refresh();
        navigate("/conta");
      }
    } catch (e) {
      setError((e as Error).message);
      setAttempt((a) => a + 1);
      setToken("");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="container auth-layout">
      <aside className="auth-story">
        <BookOpen size={32} strokeWidth={1.2} />
        <span className="eyebrow">readline club</span>
        <h1>Computação em pauta.</h1>
        <p>
          Leia livros técnicos, discuta fundamentos e troque experiências com
          pessoas em diferentes momentos da carreira.
        </p>
        <div className="auth-quote">
          Do conceito no livro
          <br />à decisão no código.
        </div>
        <Link className="text-link" to="/">
          Voltar ao clube <ArrowRight size={16} />
        </Link>
      </aside>
      <section className="auth-form">
        <span className="eyebrow">
          {signup
            ? "Inscrição no clube"
            : reset
              ? "Recuperação de acesso"
              : "Área de integrantes"}
        </span>
        <h2>
          {signup
            ? "Faça parte do clube."
            : reset
              ? "Escolha uma nova senha."
              : "Entre para continuar."}
        </h2>
        <p>
          {signup
            ? "Preencha seu cadastro. O organizador aprovará seu acesso aos encontros e às gravações."
            : reset
              ? "O link é individual e só pode ser usado uma vez."
              : "Acesse a biblioteca, os encontros e as gravações do clube."}
        </p>
        {done ? (
          <div className="success-panel" role="status">
            <Check size={28} />
            <h3>{signup ? "Cadastro recebido." : "Senha atualizada."}</h3>
            <p>
              {signup
                ? "Entre para acompanhar a aprovação do seu acesso. Se já tinha cadastro, use sua senha anterior."
                : "Agora você pode entrar com sua nova senha."}
            </p>
            <Link
              to="/entrar"
              className="button primary"
              onClick={() => setDone(false)}
            >
              Ir para o login <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <form onSubmit={submit}>
            {signup && (
              <label>
                Seu nome
                <input
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={200}
                  placeholder="Como podemos chamar você?"
                />
              </label>
            )}
            {!reset && (
              <label>
                E-mail
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  placeholder="voce@exemplo.com"
                />
              </label>
            )}
            <label>
              {reset ? "Nova senha" : "Senha"}
              <input
                type="password"
                name="password"
                autoComplete={
                  signup || reset ? "new-password" : "current-password"
                }
                required
                minLength={signup || reset ? 10 : 1}
                maxLength={128}
                placeholder={
                  signup || reset ? "Pelo menos 10 caracteres" : "Sua senha"
                }
              />
            </label>
            {signup && (
              <>
                <label>
                  Como está sua jornada na computação?
                  <select name="experience">
                    <option value="beginner">Estou começando</option>
                    <option value="learning">
                      Já estudo ou programo um pouco
                    </option>
                    <option value="experienced">
                      Tenho experiência e quero trocar ideias
                    </option>
                  </select>
                </label>
                <label>
                  O que trouxe você até aqui?{" "}
                  <span className="muted">(opcional)</span>
                  <textarea
                    name="motivation"
                    rows={3}
                    maxLength={2000}
                    placeholder="Um assunto que te interessa, uma curiosidade…"
                  />
                </label>
                <label className="checkbox-label">
                  <input name="consent" type="checkbox" required />
                  <span>
                    Concordo com as{" "}
                    <Link
                      to="/comunidade"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      orientações do clube
                    </Link>{" "}
                    e com o uso dos meus dados para organizar minha
                    participação. Estou ciente de que os encontros serão
                    gravados.
                  </span>
                </label>
                {home?.turnstileSiteKey ? (
                  <Turnstile
                    siteKey={home.turnstileSiteKey}
                    onToken={setToken}
                    attempt={attempt}
                  />
                ) : (
                  <Notice>
                    As inscrições estão sendo preparadas. Volte em breve.
                  </Notice>
                )}
              </>
            )}
            {error && <Notice>{error}</Notice>}
            <button
              className="button primary full"
              disabled={busy || (signup && !token)}
            >
              {busy
                ? "Só um instante…"
                : signup
                  ? "Enviar meu cadastro"
                  : reset
                    ? "Salvar nova senha"
                    : "Entrar"}
              <ArrowRight size={18} />
            </button>
            {!signup && !reset && (
              <button
                className="forgot"
                type="button"
                onClick={() => setForgot(!forgot)}
              >
                Esqueci minha senha
              </button>
            )}
            {forgot && (
              <div className="help-box">
                Peça ao organizador um link individual de recuperação pelo canal
                em que você entrou no clube. Por segurança, confirme sua
                identidade antes de receber o link.
              </div>
            )}
            <p className="form-bottom">
              {signup ? "Já faz parte?" : "Ainda não tem cadastro?"}{" "}
              <Link
                to={signup ? "/entrar" : "/inscricao"}
                onClick={() => {
                  setError("");
                  setDone(false);
                }}
              >
                {signup ? "Entre aqui" : "Venha para o clube"}
              </Link>
            </p>
          </form>
        )}
      </section>
    </div>
  );
}
