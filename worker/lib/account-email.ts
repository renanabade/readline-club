import type { Env } from "../env";
// Account emails go through the private mailer, like the approval notice.
// Without the binding (local, preview) the result is "unavailable".
export async function requestAccountEmail(
  env: Env,
  path: "/email-verification",
  body: object,
): Promise<string> {
  if (!env.APPROVAL_EMAIL) return "unavailable";
  try {
    const response = await env.APPROVAL_EMAIL.fetch(
      "https://approval.internal" + path,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) return "unavailable";
    const { status } = (await response.json()) as { status?: unknown };
    return typeof status === "string" ? status : "unavailable";
  } catch {
    return "unavailable";
  }
}
