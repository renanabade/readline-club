import { HTTPException } from "hono/http-exception";
import type { Env } from "../env";
import type { InvitationBatch } from "../../shared/contracts";
const unavailable = () =>
  new HTTPException(503, {
    message:
      "O envio de e-mail está indisponível agora. Os convites continuam na fila; tente novamente mais tarde.",
  });
export async function requestInvitationBatch(
  env: Env,
  meetingId: string,
): Promise<InvitationBatch> {
  if (!env.APPROVAL_EMAIL) throw unavailable();
  let response: Response;
  try {
    response = await env.APPROVAL_EMAIL.fetch("https://approval.internal/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ meetingId }),
    });
  } catch {
    throw unavailable();
  }
  if (response.status === 409)
    throw new HTTPException(409, {
      message:
        "Só é possível convidar para encontros agendados que ainda não aconteceram.",
    });
  if (!response.ok) throw unavailable();
  const { sent, failed, skipped, remaining } =
    (await response.json()) as InvitationBatch;
  return { sent, failed, skipped, remaining };
}
