import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../env";
// Fails closed: without the secret or with Cloudflare unreachable, nothing
// that depends on the challenge goes through.
export async function verifyTurnstile(
  c: Context<AppEnv>,
  token: string,
  action: "signup" | "reset",
  messages: { unavailable: string; failed: string },
) {
  if (!c.env.TURNSTILE_SECRET)
    throw new HTTPException(503, { message: messages.unavailable });
  let valid = false;
  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          secret: c.env.TURNSTILE_SECRET,
          response: token,
          remoteip: c.req.header("cf-connecting-ip"),
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    const result = (await response.json()) as {
      success?: boolean;
      hostname?: string;
      action?: string;
    };
    valid =
      response.ok &&
      result.success === true &&
      result.hostname === new URL(c.env.APP_ORIGIN).hostname &&
      result.action === action;
  } catch {
    throw new HTTPException(503, { message: messages.failed });
  }
  if (!valid)
    throw new HTTPException(400, {
      message: "Refaça a verificação de segurança.",
    });
}
