import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { getIdentity } from "./sessions";
import type { AppEnv } from "../env";
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const identity = await getIdentity(c.req.raw, c.env);
  if (!identity)
    throw new HTTPException(401, { message: "Entre para continuar." });
  c.set("identity", identity);
  await next();
});
export const requireMember = createMiddleware<AppEnv>(async (c, next) => {
  const i = c.get("identity");
  if (i.mustChangePassword)
    throw new HTTPException(403, {
      message: "Defina sua nova senha para continuar.",
    });
  if (i.role !== "admin" && i.status !== "approved")
    throw new HTTPException(403, {
      message: "Seu acesso precisa da aprovação do clube.",
    });
  await next();
});
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get("identity").role !== "admin")
    throw new HTTPException(403, {
      message: "Acesso exclusivo da administração.",
    });
  await next();
});
