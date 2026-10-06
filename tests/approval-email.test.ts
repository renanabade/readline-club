import { beforeAll, afterAll, test, expect, vi } from "vitest";
import { fixture, session } from "./helpers";
import { createApp } from "../worker/index";

let f: Awaited<ReturnType<typeof fixture>>;
let owner: Awaited<ReturnType<typeof session>>;
const app = createApp();
beforeAll(async () => {
  f = await fixture();
  owner = await session(f.DB, "admin");
  f.env.ADMIN_EMAIL = owner.email;
});
afterAll(async () => {
  await f.mf.dispose();
});
function request(
  id: string,
  env: object,
  cookie = owner.cookie,
  retry = false,
) {
  return app.request(
    `/api/admin/applications/${id}${retry ? "/notify" : ""}`,
    {
      method: retry ? "POST" : "PATCH",
      headers: {
        origin: f.env.APP_ORIGIN,
        cookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({ status: "approved" }),
    },
    { ...f.env, ...env },
  );
}
test("approval invokes the private notifier and reports its result", async () => {
  const member = await session(f.DB, "member", "pending");
  const fetch = vi.fn(async () =>
    Response.json({ emailStatus: "sent", message: "Aviso enviado." }),
  );
  const response = await request(member.id, { APPROVAL_EMAIL: { fetch } });
  expect(response.status).toBe(200);
  expect(fetch).toHaveBeenCalledOnce();
  expect(await response.json()).toMatchObject({ emailStatus: "sent" });
});
test("approval remains valid when mail transport is unavailable, with an explicit warning", async () => {
  const member = await session(f.DB, "member", "pending");
  const response = await request(member.id, {});
  expect(await response.json()).toMatchObject({ emailStatus: "unavailable" });
  expect(
    await f.DB.prepare("SELECT status FROM applications WHERE id=?")
      .bind(member.id)
      .first("status"),
  ).toBe("approved");
});
test("members cannot trigger notification sends", async () => {
  const member = await session(f.DB);
  const fetch = vi.fn();
  const response = await request(
    member.id,
    { APPROVAL_EMAIL: { fetch } },
    member.cookie,
    true,
  );
  expect(response.status).toBe(403);
  expect(fetch).not.toHaveBeenCalled();
});
