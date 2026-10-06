import type { Identity } from "../shared/contracts";
export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
  APP_ORIGIN: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET?: string;
  ADMIN_EMAIL?: string;
  APPROVAL_EMAIL?: Fetcher;
}
export type AppEnv = { Bindings: Env; Variables: { identity: Identity } };
