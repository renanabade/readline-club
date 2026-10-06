import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../env";
import { digest } from "./password";
export async function rateLimit(
  c: Context<AppEnv>,
  scope: string,
  limit: number,
  identity?: string,
) {
  const key = digest(
    scope + ":" + (identity || c.req.header("cf-connecting-ip") || "local"),
  );
  const now = Date.now(),
    expires = now + 15 * 60000;
  const row = await c.env.DB.prepare(
    "INSERT INTO auth_limits(key,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END, expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING attempts",
  )
    .bind(key, expires, now, now)
    .first<{ attempts: number }>();
  if (!row || row.attempts > limit)
    throw new HTTPException(429, {
      message: "Muitas tentativas. Tente novamente em 15 minutos.",
    });
}
