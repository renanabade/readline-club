import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, BookOpen, Check } from "lucide-react";
import { useSession } from "../lib/session";
import { save } from "../lib/api";
import { Notice } from "../components/ui";
import { Turnstile } from "../components/Turnstile";
// Only same-site paths: "//host" and "/\host" would leave the site.
export function returnPath(voltar: string | null) {
  return voltar &&
    voltar.startsWith("/") &&
    !voltar.startsWith("//") &&
    !voltar.startsWith("/\\")
    ? voltar
    : "/";
}
export default function Auth({
  mode,
}: {
  mode: "login" | "signup" | "reset" | "forgot";
}) {
  const { home, refresh } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [token, setToken] = useState(""),
    [attempt, setAttempt] = useState(0),
    [sent, setSent] = useState(""),
    [showPassword, setShowPassword] = useState(false),
    [mismatch, setMismatch] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null),
    confirmRef = useRef<HTMLInputElement>(null);
  const signup = mode === "signup",
    reset = mode === "reset",
    forgot = mode === "forgot";
  // A server error moves focus to its message, so keyboards and screen
  // readers land on what went wrong.
  useEffect(() => {
    if (error && !mismatch) errorRef.current?.focus();
  }, [error, mismatch, attempt]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMismatch(false);
    const { passwordConfirm, ...d } = Object.fromEntries(
      new FormData(e.currentTarget),
    );
    if (signup && d.password !== passwordConfirm) {
      setMismatch(true);
      setError("As senhas não conferem. Digite a mesma senha nos dois campos.");
      confirmRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      if (signup) {
        await save("/auth/register", {
          ...d,
          consent: d.consent === "on",
          turnstileToken: token,
        });
        setDone(true);
      } else if (forgot) {
        const result = await save<{ message: string }>("/auth/forgot", {
          email: d.email,
          turnstileToken: token,
        });
        setSent(result.message);
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
        navigate(returnPath(params.get("voltar")), { replace: true });
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
          pessoas em diferentes momentos da carreira. Gratuito, sempre.
        </p>
        <ul className="auth-benefits">
          <li>
            <Check size={16} aria-hidden="true" /> Encontros ao vivo pelo Google
            Meet
          </li>
          <li>
            <Check size={16} aria-hidden="true" /> Gravações, resumos em PDF e
            EPUB e slides
          </li>
          <li>
            <Check size={16} aria-hidden="true" /> Comunidade oficial no
            WhatsApp e no Discord
          </li>
        </ul>
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
            : reset || forgot
              ? "Recuperação de acesso"
              : "Área de integrantes"}
        </span>
        <h2>
          {signup
            ? "Faça parte do clube."
            : reset
              ? "Escolha uma nova senha."
              : forgot
                ? "Recupere sua senha."
                : "Entre para continuar."}
        </h2>
        <p>
          {signup
            ? "Pedimos nome, e-mail, celular e uma senha para você entrar na plataforma. Leva um minuto: a organização revisa cada inscrição e avisa por e-mail quando seu acesso for liberado."
            : reset
              ? "O link é individual e só pode ser usado uma vez."
              : forgot
                ? "Informe o e-mail do cadastro. Enviamos um link para você escolher uma nova senha."
                : "Acesse a biblioteca, os encontros e as gravações do clube."}
        </p>
        {done ? (
          <div className="success-panel" role="status">
            <Check size={28} />
            <h3>
              {signup
                ? "Cadastro recebido."
                : forgot
                  ? "Confira seu e-mail."
                  : "Senha atualizada."}
            </h3>
            <p>
              {signup
                ? "Se o cadastro é novo, enviamos um link para confirmar seu e-mail. Você recebe outro e-mail quando o acesso for liberado; enquanto isso, entre com a senha que você acabou de criar para acompanhar o status. Se este e-mail já estava cadastrado, a conta continua a mesma: entre com a senha de antes ou use “Esqueci minha senha”."
                : forgot
                  ? sent + " Não chegou? Confira a caixa de spam."
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
            {signup && (
              <label>
                Celular com DDD (WhatsApp)
                <input
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  inputMode="tel"
                  required
                  maxLength={40}
                  placeholder="(11) 91234-5678"
                  aria-describedby="phone-help"
                />
                <span className="field-help" id="phone-help">
                  Para a organização identificar você no grupo do WhatsApp. Não
                  aparece para outros membros na plataforma.
                </span>
              </label>
            )}
            {!forgot && (
              <label>
                {reset ? "Nova senha" : "Senha"}
                <input
                  type={showPassword ? "text" : "password"}
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
                  aria-describedby={
                    signup || reset ? "password-rules" : undefined
                  }
                />
                {(signup || reset) && (
                  <span className="field-help" id="password-rules">
                    Use de 10 a 128 caracteres. Uma frase com algumas palavras
                    fica forte e é fácil de lembrar.
                  </span>
                )}
              </label>
            )}
            {signup && (
              <>
                <label>
                  Confirme a senha
                  <input
                    ref={confirmRef}
                    type={showPassword ? "text" : "password"}
                    name="passwordConfirm"
                    autoComplete="new-password"
                    required
                    maxLength={128}
                    placeholder="Digite a senha de novo"
                    aria-invalid={mismatch || undefined}
                    aria-describedby={mismatch ? "form-error" : undefined}
                    onChange={() => mismatch && setMismatch(false)}
                  />
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                  />
                  <span>Mostrar senha</span>
                </label>
              </>
            )}
            {forgot &&
              (home?.turnstileSiteKey ? (
                <Turnstile
                  siteKey={home.turnstileSiteKey}
                  onToken={setToken}
                  attempt={attempt}
                  action="reset"
                />
              ) : (
                <Notice>
                  A recuperação por e-mail está indisponível no momento. Tente
                  novamente mais tarde.
                </Notice>
              ))}
            {signup && (
              <>
                <label>
                  Como está sua jornada na computação?
                  <select name="experience" required defaultValue="">
                    <option value="" disabled>
                      Escolha uma opção
                    </option>
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
                    participação, conforme a{" "}
                    <Link
                      to="/privacidade"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      política de privacidade
                    </Link>
                    . Estou ciente de que os encontros serão gravados.
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
            {error && (
              <div ref={errorRef} id="form-error" tabIndex={-1}>
                <Notice>{error}</Notice>
              </div>
            )}
            <button
              className="button primary full"
              disabled={busy || ((signup || forgot) && !token)}
            >
              {busy
                ? "Só um instante…"
                : signup
                  ? "Enviar meu cadastro"
                  : reset
                    ? "Salvar nova senha"
                    : forgot
                      ? "Enviar link"
                      : "Entrar"}
              <ArrowRight size={18} />
            </button>
            {mode === "login" && (
              <Link className="forgot" to="/recuperar-senha">
                Esqueci minha senha
              </Link>
            )}
            <p className="form-bottom">
              {signup
                ? "Já faz parte?"
                : forgot
                  ? "Lembrou a senha?"
                  : "Ainda não tem cadastro?"}{" "}
              <Link
                to={signup || forgot ? "/entrar" : "/inscricao"}
                onClick={() => {
                  setError("");
                  setDone(false);
                }}
              >
                {signup || forgot ? "Entre aqui" : "Venha para o clube"}
              </Link>
            </p>
          </form>
        )}
      </section>
    </div>
  );
}
