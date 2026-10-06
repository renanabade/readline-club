export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch("/api" + path, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const body = await r
    .json()
    .catch(() => ({ error: "O servidor não respondeu como esperado." }));
  if (!r.ok) {
    if (r.status === 401 || r.status === 403)
      window.dispatchEvent(new Event("session-refresh"));
    const message =
      body && typeof body === "object" && "error" in body
        ? String(body.error)
        : "Não foi possível concluir.";
    throw new ApiError(message, r.status);
  }
  return body as T;
}
export const save = <T>(path: string, data: unknown, method = "POST") =>
  api<T>(path, { method, body: JSON.stringify(data) });
