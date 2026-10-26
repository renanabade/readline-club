import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle } from "lucide-react";
import { save } from "../lib/api";
import { Notice } from "../components/ui";
import { useSession } from "../lib/session";

// Opened from the link in the signup email. Loading the page never confirms
// by itself, because email security scanners open every link.
export default function EmailConfirm() {
  const [token] = useState(() => window.location.hash.slice(1));
  const [error, setError] = useState(
    token
      ? ""
      : "Este link de confirmação está incompleto. Abra o botão do e-mail de novo ou entre na plataforma para pedir outro.",
  );
  const { refresh } = useSession();
  const [busy, setBusy] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await save("/auth/verify-email", { token });
      setConfirmed(true);
      // The access changed: reload it if this browser is signed in.
      await refresh();
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
            <CheckCircle size={17} aria-hidden="true" /> Pronto! Seu acesso ao
            clube está liberado.
          </p>
          <Link className="button primary" to="/comunidade">
            Entrar no clube <ArrowRight size={16} />
          </Link>
        </>
      ) : (
        <>
          <p>
            Confirme que este endereço é seu para liberar seu acesso ao clube.
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
