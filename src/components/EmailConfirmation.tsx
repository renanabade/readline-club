import { useState } from "react";
import { CheckCircle } from "lucide-react";
import { save } from "../lib/api";
import { useData } from "../lib/useData";
import { useSession } from "../lib/session";
import { Notice } from "./ui";

// Shown to pending accounts: confirming the signup email releases access.
export function EmailConfirmation() {
  const { data } = useData<{ verified: boolean }>("/auth/email-verification");
  const email = useSession().user?.email;
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (!data) return null;
  if (data.verified)
    return (
      <p className="success" role="status">
        <CheckCircle size={17} aria-hidden="true" /> E-mail confirmado.
      </p>
    );
  async function resend() {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      setMessage(
        (await save<{ message: string }>("/auth/email-verification", {}))
          .message,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="email-confirmation">
      <p>
        Abra o link que enviamos para <strong>{email}</strong>. Não chegou?
        Confira a caixa de spam ou peça outro.
      </p>
      <p className="small muted">
        Digitou o e-mail errado?{" "}
        <a href="/conta#excluir-conta">Exclua este cadastro</a> e faça um novo
        com o endereço certo.
      </p>
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      {error && <Notice>{error}</Notice>}
      <button
        className="button small-button"
        disabled={busy}
        onClick={() => void resend()}
      >
        {busy ? "Enviando…" : "Enviar novo link de confirmação"}
      </button>
    </div>
  );
}
