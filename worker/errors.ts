import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import type { z } from "zod";
import type { AppEnv } from "./env";
export async function input<T>(
  c: Context<AppEnv>,
  schema: z.ZodType<T>,
): Promise<T> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: "Envie um formulário válido." });
  }
  const result = schema.safeParse(body);
  if (!result.success)
    throw new HTTPException(400, {
      message: result.error.issues[0]?.message || "Confira os campos.",
    });
  return result.data;
}
export function missing(): never {
  throw new HTTPException(404, { message: "Não encontramos este conteúdo." });
}
