import { createContext, useContext, useState, type ReactNode } from "react";
import { Lock, LockKeyhole, MailCheck, X } from "lucide-react";
import { useSession } from "../lib/session";
import { useDialogFocus } from "../lib/useDialogFocus";
import { EmailConfirmation } from "./EmailConfirmation";

// Access starts at signup, but the call links, group invitations, recordings
// and materials wait for the signup email to be confirmed. Locked items stay on
// the page and open this dialog instead.
const Context = createContext<{ pending: boolean; ask: () => void }>({
  pending: false,
  ask: () => {},
});
export const useEmailGate = () => useContext(Context);

export function EmailGateProvider({ children }: { children: ReactNode }) {
  const { user, refresh } = useSession();
  const pending = !!user?.emailConfirmationPending;
  const [open, setOpen] = useState(false),
    [checking, setChecking] = useState(false),
    [stillPending, setStillPending] = useState(false);
  const close = () => {
    setOpen(false);
    setStillPending(false);
  };
  useDialogFocus(open && pending, close);
  // Confirming happens in the email, usually in another tab: check again here.
  async function check() {
    setChecking(true);
    setStillPending(false);
    try {
      await refresh();
    } finally {
      setChecking(false);
      setStillPending(true);
    }
  }
  return (
    <Context.Provider value={{ pending, ask: () => setOpen(true) }}>
      {children}
      {open && pending && (
        <div className="modal-overlay">
          <section
            className="dialog email-gate"
            role="dialog"
            aria-modal="true"
            aria-labelledby="email-gate-title"
          >
            <button
              className="dialog-close icon-btn"
              onClick={close}
              aria-label="Fechar"
            >
              <X />
            </button>
            <MailCheck size={30} strokeWidth={1.5} aria-hidden="true" />
            <h2 id="email-gate-title">Confirme seu e-mail para liberar.</h2>
            <p>
              O link da chamada dos encontros, os grupos do WhatsApp e do
              Discord, as gravações e os resumos ficam disponíveis assim que
              você abre o link que enviamos para o e-mail do cadastro. O resto
              da plataforma já está liberado.
            </p>
            <EmailConfirmation />
            {stillPending && (
              <p role="status">
                Ainda não recebemos a confirmação. Abra o link do e-mail e tente
                de novo.
              </p>
            )}
            <div className="row-actions">
              <button className="button" onClick={close}>
                Agora não
              </button>
              <button
                className="button primary"
                disabled={checking}
                onClick={() => void check()}
              >
                {checking ? "Conferindo…" : "Já confirmei"}
              </button>
            </div>
          </section>
        </div>
      )}
    </Context.Provider>
  );
}

// A reminder on every page until the email is confirmed.
export function EmailGateBanner() {
  const { pending, ask } = useEmailGate();
  if (!pending) return null;
  return (
    <aside className="email-gate-banner" aria-label="Confirmação de e-mail">
      <div className="container">
        <Lock size={16} aria-hidden="true" />
        <span>
          Confirme seu e-mail para liberar os grupos, as gravações e os resumos.
        </span>
        <button className="text-link" onClick={ask}>
          Como confirmar
        </button>
      </div>
    </aside>
  );
}

// What a locked group invitation, recording or material shows instead of
// the link.
export function LockedButton({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const { ask } = useEmailGate();
  return (
    <button type="button" className={className} onClick={ask}>
      {children}
    </button>
  );
}

// Shown where the call link would be, while the email is not confirmed.
export function LockedCall({ className }: { className?: string }) {
  return (
    <LockedButton className={className}>
      <LockKeyhole size={16} aria-hidden="true" /> Confirme seu e-mail para ver
      o link da chamada
    </LockedButton>
  );
}
