import { useState } from "react";
import { CheckCircle } from "lucide-react";
import { save } from "../lib/api";
import { Notice } from "./ui";
import type { Meeting, MeetingRsvp as Rsvp } from "../../shared/contracts";

export function MeetingRsvp({
  meeting,
  initial,
}: {
  meeting: Pick<Meeting, "id" | "starts_at" | "status">;
  initial: Rsvp | null;
}) {
  const [rsvp, setRsvp] = useState(initial),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (
    meeting.status !== "scheduled" ||
    !meeting.starts_at ||
    Date.parse(meeting.starts_at) <= Date.now()
  )
    return null;
  async function answer(response: Rsvp) {
    setBusy(true);
    setError("");
    try {
      const result = await save<{ rsvp: Rsvp }>(
        "/meetings/" + encodeURIComponent(meeting.id) + "/rsvp",
        { response },
        "PUT",
      );
      setRsvp(result.rsvp);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="calendar-actions meeting-rsvp">
      <p>
        <CheckCircle size={17} aria-hidden="true" /> Você vai participar?
      </p>
      <div className="whatsapp-actions">
        <button
          className={"button" + (rsvp === "yes" ? " primary" : "")}
          aria-pressed={rsvp === "yes"}
          disabled={busy}
          onClick={() => void answer("yes")}
        >
          Vou participar
        </button>
        <button
          className={"button" + (rsvp === "no" ? " primary" : "")}
          aria-pressed={rsvp === "no"}
          disabled={busy}
          onClick={() => void answer("no")}
        >
          Não vou poder
        </button>
      </div>
      {rsvp && (
        <p className="success" role="status">
          {rsvp === "yes"
            ? "Presença confirmada. Até lá!"
            : "Obrigado por avisar. Você pode mudar a resposta até o encontro."}
        </p>
      )}
      {error && <Notice>{error}</Notice>}
    </div>
  );
}
