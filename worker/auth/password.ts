import {
  scryptSync,
  randomBytes,
  timingSafeEqual,
  createHash,
} from "node:crypto";
const N = 16384,
  r = 8,
  p = 5;
export function hashPassword(password: string): string {
  const salt = Buffer.from(randomBytes(16)).toString("hex");
  const hash = Buffer.from(
    scryptSync(password, salt, 64, { N, r, p, maxmem: 32 * 1024 * 1024 }),
  ).toString("hex");
  return ["scrypt", N, r, p, salt, hash].join(":");
}
export function verifyPassword(password: string, encoded: string): boolean {
  const [kind, n, rr, pp, salt, hash] = encoded.split(":");
  if (
    kind !== "scrypt" ||
    Number(n) !== N ||
    Number(rr) !== r ||
    Number(pp) !== p ||
    !salt ||
    !hash ||
    hash.length !== 128
  )
    return false;
  const actual = scryptSync(password, salt, 64, {
    N,
    r,
    p,
    maxmem: 32 * 1024 * 1024,
  });
  return timingSafeEqual(actual, Buffer.from(hash, "hex"));
}
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export const randomToken = () => Buffer.from(randomBytes(32)).toString("hex");
