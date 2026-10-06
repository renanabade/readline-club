import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Context } from "hono";
import type { AppEnv, Env } from "../env";
import type { Identity, ApplicationStatus } from "../../shared/contracts";
import { digest, randomToken } from "./password";
export const SESSION_COOKIE = "club_session";
export async function getIdentity(
  request: Request,
  env: Env,
): Promise<Identity | null> {
  const raw = request.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(SESSION_COOKIE + "="))
    ?.slice(SESSION_COOKIE.length + 1);
  if (!raw || raw.length > 256) return null;
  const row = await env.DB.prepare(
    "SELECT u.id,u.email,u.name,u.role,u.must_change_password,a.status FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN applications a ON a.email=u.email WHERE s.token_hash=? AND s.expires_at>?",
  )
    .bind(digest(raw), Date.now())
    .first<{
      id: string;
      email: string;
      name: string;
      role: "member" | "admin";
      must_change_password: number;
      status: ApplicationStatus | null;
    }>();
  if (!row) return null;
  return {
    userId: row.id,
    email: row.email,
    name: row.name,
    role:
      row.role === "admin" &&
      !!env.ADMIN_EMAIL?.trim() &&
      row.email.trim().toLowerCase() === env.ADMIN_EMAIL.trim().toLowerCase()
        ? "admin"
        : "member",
    status: row.status,
    mustChangePassword: !!row.must_change_password,
  };
}
export async function startSession(c: Context<AppEnv>, userId: string) {
  const token = randomToken();
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM sessions WHERE expires_at<=?").bind(
      Date.now(),
    ),
    c.env.DB.prepare(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",
    ).bind(digest(token), userId, Date.now() + 7 * 86400000),
  ]);
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: new URL(c.env.APP_ORIGIN).protocol === "https:",
    sameSite: "Lax",
    path: "/",
    maxAge: 7 * 86400,
  });
}
export async function endSession(c: Context<AppEnv>) {
  const token = getCookie(c, SESSION_COOKIE);
  if (token)
    await c.env.DB.prepare("DELETE FROM sessions WHERE token_hash=?")
      .bind(digest(token))
      .run();
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}
