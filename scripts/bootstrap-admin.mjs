import { scryptSync, randomBytes } from "node:crypto";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
const args = process.argv.slice(2);
const option = (k) => args[args.indexOf(k) + 1];
if (!args.includes("--email") || !args.includes("--output"))
  throw Error(
    "Use --email EMAIL --output PRIVATE_FILE and --local or --remote.",
  );
const remote = args.includes("--remote");
if (!remote && !args.includes("--local"))
  throw Error("Choose --local or --remote explicitly.");
const email = option("--email").trim().toLowerCase();
const name = args.includes("--name") ? option("--name").trim() : "Organizador";
if (!name || name.length > 200) throw Error("Invalid name");
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw Error("Invalid email");
const password = randomBytes(24).toString("base64url");
const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, 64, {
  N: 16384,
  r: 8,
  p: 5,
  maxmem: 32 * 1024 * 1024,
}).toString("hex");
const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
const id = crypto.randomUUID();
const sql =
  "INSERT INTO users(id,email,name,password_hash,role,must_change_password) VALUES(" +
  [id, email, name, "scrypt:16384:8:5:" + salt + ":" + hash, "admin"]
    .map(quote)
    .join(",") +
  ",1);";
// The SQL contains the password hash: keep it outside the project and remove it.
const directory = mkdtempSync(join(tmpdir(), "readline-bootstrap-"));
const file = join(directory, "bootstrap.sql");
writeFileSync(file, sql, { mode: 0o600 });
const command = [
  "node_modules/wrangler/bin/wrangler.js",
  "d1",
  "execute",
  "DB",
  remote ? "--remote" : "--local",
  "--config",
  remote ? "wrangler.jsonc" : "wrangler.local.jsonc",
  "--file",
  file,
  "--yes",
];
const result = spawnSync(process.execPath, command, { encoding: "utf8" });
rmSync(directory, { recursive: true, force: true });
if (result.status !== 0) {
  console.error(
    "Administrator creation failed. No existing account was overwritten.",
  );
  process.exit(1);
}
writeFileSync(
  resolve(option("--output")),
  "ACESSO PRIVADO — não enviar ao GitHub\n\nE-mail: " +
    email +
    "\nSenha inicial: " +
    password +
    "\n\nAcesse /entrar. A plataforma exigirá uma nova senha no primeiro acesso.\n",
  { mode: 0o600 },
);
console.log(
  "Administrator created. Initial credentials saved to the requested private file.",
);
