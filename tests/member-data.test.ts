import { beforeAll, afterAll, afterEach, test, expect, vi } from "vitest";
import { fixture, session } from "./helpers";
import { createApp } from "../worker/index";
import { hashPassword } from "../worker/auth/password";
import { phoneSchema } from "../shared/validation";
import type { AdminData } from "../shared/contracts";

const app = createApp();
let f: Awaited<ReturnType<typeof fixture>>;
let admin: Awaited<ReturnType<typeof session>>;
beforeAll(async () => {
  f = await fixture();
  admin = await session(f.DB, "admin");
  f.env.ADMIN_EMAIL = admin.email;
});
afterAll(async () => {
  await f.mf.dispose();
});
afterEach(() => vi.unstubAllGlobals());
const call = (
  path: string,
  cookie: string,
  method = "GET",
  body?: unknown,
  origin = f.env.APP_ORIGIN,
) =>
  app.request(
    "/api" + path,
    {
      method,
      headers: { cookie, origin, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    f.env,
  );
const overview = async () =>
  (await (await call("/admin/overview", admin.cookie)).json()) as AdminData;

test("phone numbers are normalized and Brazilian numbers get the country code", () => {
  expect(phoneSchema.parse("(11) 91234-5678")).toBe("+5511912345678");
  expect(phoneSchema.parse("11 3123-4567")).toBe("+551131234567");
  expect(phoneSchema.parse("+351 912 345 678")).toBe("+351912345678");
  for (const invalid of ["", "1234", "+1 23", "9".repeat(16)])
    expect(phoneSchema.safeParse(invalid).success, invalid).toBe(false);
});

test("signup requires a phone and stores it normalized", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        success: true,
        hostname: "club.example",
        action: "signup",
      }),
    ),
  );
  const body = {
    name: "Bia Leitora",
    email: "bia@example.test",
    password: "uma-senha-forte-123",
    experience: "learning",
    consent: true,
    turnstileToken: "token",
  };
  expect((await call("/auth/register", "", "POST", body)).status).toBe(400);
  expect(
    (
      await call("/auth/register", "", "POST", {
        ...body,
        phone: "(21) 98765-4321",
      })
    ).status,
  ).toBe(201);
  expect(
    await f.DB.prepare("SELECT phone FROM applications WHERE email=?")
      .bind(body.email)
      .first("phone"),
  ).toBe("+5521987654321");
});

test("people read and update only their own phone", async () => {
  const member = await session(f.DB, "member", "pending");
  const other = await session(f.DB);
  expect((await call("/auth/profile", "")).status).toBe(401);
  expect(
    (await call("/auth/profile", "", "PATCH", { phone: "11912345678" })).status,
  ).toBe(401);
  expect(
    (
      await call(
        "/auth/profile",
        member.cookie,
        "PATCH",
        { phone: "11912345678" },
        "https://evil.example.test",
      )
    ).status,
  ).toBe(403);
  expect(
    (await call("/auth/profile", member.cookie, "PATCH", { phone: "12" }))
      .status,
  ).toBe(400);
  const saved = await call("/auth/profile", member.cookie, "PATCH", {
    phone: "(11) 91234-5678",
  });
  expect(await saved.json()).toEqual({ phone: "+5511912345678" });
  expect(await (await call("/auth/profile", member.cookie)).json()).toEqual({
    phone: "+5511912345678",
  });
  expect(await (await call("/auth/profile", other.cookie)).json()).toEqual({
    phone: "",
  });
});

async function account(status: string) {
  const s = await session(f.DB, "member", status);
  await f.DB.batch([
    f.DB.prepare("UPDATE users SET password_hash=? WHERE id=?").bind(
      hashPassword("account-password-123"),
      s.id,
    ),
    f.DB.prepare("UPDATE applications SET name=?,phone=? WHERE id=?").bind(
      "Saída " + status,
      "+5511900000000",
      s.id,
    ),
  ]);
  return s;
}

test("members who had access leave a departure for group removal; it is deleted once handled", async () => {
  const approved = await account("approved");
  const pending = await account("pending");
  for (const person of [approved, pending])
    expect(
      (
        await call("/auth/account/delete", person.cookie, "POST", {
          password: "account-password-123",
        })
      ).status,
    ).toBe(200);
  const { departures } = await overview();
  expect(departures).toHaveLength(1);
  expect(departures[0]).toMatchObject({
    name: "Saída approved",
    phone: "+5511900000000",
  });
  expect(Object.keys(departures[0]).sort()).toEqual(
    ["id", "name", "phone", "left_at"].sort(),
  );
  const path = "/admin/departures/" + departures[0].id;
  expect((await call(path, "", "DELETE", {})).status).toBe(401);
  for (const status of ["pending", "rejected", "suspended"])
    expect(
      (
        await call(
          path,
          (await session(f.DB, "member", status)).cookie,
          "DELETE",
          {},
        )
      ).status,
    ).toBe(403);
  expect(
    (await call(path, (await session(f.DB)).cookie, "DELETE", {})).status,
  ).toBe(403);
  expect(
    (await call(path, admin.cookie, "DELETE", {}, "https://evil.example.test"))
      .status,
  ).toBe(403);
  expect((await call(path, admin.cookie, "DELETE", {})).status).toBe(200);
  expect((await overview()).departures).toHaveLength(0);
});

test("departures expire after 30 days", async () => {
  await f.DB.prepare(
    "INSERT INTO member_departures(id,name,phone,left_at) VALUES('old','Antiga','+5511900000001',?),('new','Recente','+5511900000002',?)",
  )
    .bind(
      new Date(Date.now() - 31 * 86400000).toISOString(),
      new Date().toISOString(),
    )
    .run();
  expect((await overview()).departures.map((d) => d.id)).toEqual(["new"]);
  await f.DB.prepare("DELETE FROM member_departures").run();
});

test("social links are public, validated by network, and phones never reach public data", async () => {
  const settings = {
    club_name: "readline club",
    description: "Um clube.",
    instagram_url: "https://www.instagram.com/clube.example",
    linkedin_url: "https://www.linkedin.com/company/clube-example",
    youtube_url: "https://www.youtube.com/@clube-example",
    tiktok_url: "",
  };
  expect(
    (
      await call("/admin/settings", admin.cookie, "PATCH", {
        ...settings,
        instagram_url: "https://instagram.com.evil.example.test/x",
      })
    ).status,
  ).toBe(400);
  expect(
    (await call("/admin/settings", admin.cookie, "PATCH", settings)).status,
  ).toBe(200);
  const member = await session(f.DB);
  await f.DB.prepare(
    "UPDATE applications SET phone='+5599988887777' WHERE id=?",
  )
    .bind(member.id)
    .run();
  const home = await call("/public/home", "");
  const raw = await home.text();
  expect(raw).not.toContain("5599988887777");
  expect(JSON.parse(raw).settings).toMatchObject({
    instagram_url: settings.instagram_url,
    linkedin_url: settings.linkedin_url,
    youtube_url: settings.youtube_url,
    tiktok_url: "",
  });
});

test("meeting materials keep their kind and the list shows what is available", async () => {
  const id = crypto.randomUUID();
  await f.DB.prepare(
    "INSERT INTO meetings(id,cycle_id,title,status) VALUES(?,'primeira-leitura','Encontro com acervo','completed')",
  )
    .bind(id)
    .run();
  const resource = (kind: unknown) =>
    call("/admin/resources", admin.cookie, "POST", {
      meeting_id: id,
      title: "Material " + kind,
      url: "https://files.example.test/" + kind,
      kind,
    });
  expect((await resource("video")).status).toBe(400);
  for (const kind of ["slides", "summary_pdf", "summary_epub"])
    expect((await resource(kind)).status).toBe(201);
  const member = await session(f.DB);
  const detail = await (await call("/meetings/" + id, member.cookie)).json();
  expect(
    (detail as { resources: { kind: string }[] }).resources.map((r) => r.kind),
  ).toEqual(["summary_pdf", "summary_epub", "slides"]);
  const list = (await (await call("/meetings", member.cookie)).json()) as {
    id: string;
    material_kinds: string;
  }[];
  expect(
    list
      .find((m) => m.id === id)!
      .material_kinds.split(",")
      .sort(),
  ).toEqual(["slides", "summary_epub", "summary_pdf"]);
});
