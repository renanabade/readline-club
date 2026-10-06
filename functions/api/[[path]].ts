import legacy from "../../worker/legacy-redirect";
import app from "../../worker/index";
import type { Env } from "../../worker/env";
export function onRequest(context: { request: Request; env: Env }) {
  if (
    new URL(context.request.url).hostname === "readlineclub.pages.dev" ||
    new URL(context.request.url).hostname === "www.readline.club"
  ) {
    return legacy.fetch(context.request);
  }
  if (new URL(context.request.url).origin !== context.env.APP_ORIGIN) {
    return Response.json(
      { error: "Acesse o clube pelo endereço oficial." },
      {
        status: 403,
        headers: {
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  }
  return app.fetch(context.request, context.env);
}
