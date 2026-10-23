import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle } from "lucide-react";
import { save } from "../lib/api";
import { Notice } from "../components/ui";

// Opened from the link in the signup email. Loading the page never confirms
// by itself, because email security scanners open every link.
export default function EmailConfirm() {
  const [token] = useState(() => window.location.hash.slice(1));
  const [error, setError] = useState(
    token
      ? ""
      : "Este link de confirmação está incompleto. Abra o botão do e-mail de novo ou entre na plataforma para pedir outro.",
  );
  const [busy, setBusy] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await save("/auth/verify-email", { token });
      setConfirmed(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="container page narrow">
      <span className="eyebrow">Confirmação de e-mail</span>
      <h1>{confirmed ? "E-mail confirmado." : "Confirme seu e-mail."}</h1>
      {confirmed ? (
        <>
          <p className="success" role="status">
            <CheckCircle size={17} aria-hidden="true" /> Obrigado! A organização
            revisa cada cadastro e avisa por e-mail quando o acesso for
            liberado.
          </p>
          <Link className="button primary" to="/entrar">
            Acompanhar minha inscrição <ArrowRight size={16} />
          </Link>
        </>
      ) : (
        <>
          <p>
            Confirme que este endereço é seu. A confirmação não aprova o acesso:
            ela ajuda a organização a saber que os avisos vão chegar.
          </p>
          {error && <Notice>{error}</Notice>}
          {token && (
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void confirm()}
            >
              {busy ? "Confirmando…" : "Confirmar meu e-mail"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
