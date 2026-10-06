import type { Env } from "../env";
export async function notifyApproval(env: Env, applicationId: string) {
  const unavailable = {
    emailStatus: "unavailable",
    message:
      "A conta está aprovada, mas o envio de e-mail está indisponível. Tente pelo botão de aviso mais tarde.",
  };
  if (!env.APPROVAL_EMAIL) return unavailable;
  try {
    const response = await env.APPROVAL_EMAIL.fetch(
      "https://approval.internal/",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ applicationId }),
      },
    );
    if (!response.ok) return unavailable;
    return (await response.json()) as { emailStatus: string; message: string };
  } catch {
    return unavailable;
  }
}
