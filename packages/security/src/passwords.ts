import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * scrypt via the Node standard library — no native dependency, no vendor.
 * Parameters follow OWASP's scrypt guidance (N=2^15, r=8, p=1).
 */
const PARAMS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  assertPasswordPolicy(password);
  const salt = randomBytes(16);
  const derived = await scryptAsync(password.normalize("NFKC"), salt, KEY_LENGTH, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64!, "base64");
  const expected = Buffer.from(hashB64!, "base64");
  const derived = await scryptAsync(password.normalize("NFKC"), salt, expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
  });
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export interface PasswordPolicyViolation {
  readonly reason: string;
}

const COMMON_PASSWORDS = new Set([
  "password", "password1", "12345678", "123456789", "qwerty123", "letmein1",
  "welcome1", "admin123", "iloveyou", "changeme", "passw0rd",
]);

export function checkPasswordPolicy(password: string): PasswordPolicyViolation | null {
  if (password.length < 12) return { reason: "Password must be at least 12 characters." };
  if (password.length > 256) return { reason: "Password must be at most 256 characters." };
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { reason: "Password appears on the common-password list." };
  }
  if (/^(.)\1+$/.test(password)) return { reason: "Password must not be a single repeated character." };
  return null;
}

export function assertPasswordPolicy(password: string): void {
  const violation = checkPasswordPolicy(password);
  if (violation) throw new Error(violation.reason);
}
