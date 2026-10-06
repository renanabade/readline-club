import { test, expect, vi } from "vitest";
import { onRequest } from "../functions/api/[[path]]";
import { onRequest as middleware } from "../functions/_middleware";
import legacy from "../worker/legacy-redirect";
import type { Env } from "../worker/env";

const origin = "https://readline.club";
test("Pages uses the existing API and refuses alternate deployment origins before database access", async () => {
  const prepare = vi.fn(() => {
    throw new Error("Database must not be called");
  });
  const env = { APP_ORIGIN: origin, DB: { prepare } as unknown as D1Database };
  expect(
    (await onRequest({ request: new Request(origin + "/api/health"), env }))
      .status,
  ).toBe(200);
  const preview = await onRequest({
    request: new Request(
      "https://preview.readlineclub.pages.dev/api/public/home",
    ),
    env,
  });
  expect(preview.status).toBe(403);
  expect(prepare).not.toHaveBeenCalled();
});
test("old address redirects safely with deep links and query strings preserved", async () => {
  for (const path of [
    "/",
    "/livros/entendendo-algoritmos",
    "/redefinir-senha?from=club",
    "//attacker.test/path",
  ]) {
    const result = await legacy.fetch(
      new Request("https://legacy.example.workers.dev" + path),
    );
    expect(result.status).toBe(308);
    const url = new URL(result.headers.get("location")!);
    expect(url.origin).toBe(origin);
    expect(url.pathname + url.search).toBe(path);
  }
});
test("old domain never forwards submitted credentials to another origin", async () => {
  const response = await legacy.fetch(
    new Request("https://legacy.example.workers.dev/api/auth/login", {
      method: "POST",
      body: "private-payload",
    }),
  );
  expect(response.status).toBe(409);
  expect(response.headers.get("location")).toBeNull();
  expect(await response.text()).not.toContain("private-payload");
});
test("old Pages API links redirect to the primary domain before database access", async () => {
  const prepare = vi.fn(() => {
    throw new Error("Database must not be called");
  });
  const env = { APP_ORIGIN: origin, DB: { prepare } as unknown as D1Database };
  const response = await onRequest({
    request: new Request("https://readlineclub.pages.dev/api/health?x=1"),
    env,
  });
  expect(response.status).toBe(308);
  expect(response.headers.get("location")).toBe(origin + "/api/health?x=1");
  expect(prepare).not.toHaveBeenCalled();
});

test("Pages redirects static deep links while serving the primary domain normally", async () => {
  const next = vi.fn(async () => new Response("primary page"));
  const old = await middleware({
    request: new Request(
      "https://readlineclub.pages.dev/encontros/primeiro?origem=calendario",
    ),
    next,
  });
  expect(old.status).toBe(308);
  expect(old.headers.get("location")).toBe(
    origin + "/encontros/primeiro?origem=calendario",
  );
  expect(next).not.toHaveBeenCalled();
  const primary = await middleware({
    request: new Request(origin + "/entrar"),
    next,
  });
  expect(await primary.text()).toBe("primary page");
});
