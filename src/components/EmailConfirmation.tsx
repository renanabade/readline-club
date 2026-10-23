import { useState } from "react";
import { CheckCircle } from "lucide-react";
import { save } from "../lib/api";
import { useData } from "../lib/useData";
import { Notice } from "./ui";

// Shown to pending accounts: the organization sees in the panel whether the
// signup email was confirmed.
export function EmailConfirmation() {
  const { data } = useData<{ verified: boolean }>("/auth/email-verification");
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
        Confirme seu e-mail pelo link que enviamos no cadastro. Não chegou?
        Confira a caixa de spam ou peça outro.
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
