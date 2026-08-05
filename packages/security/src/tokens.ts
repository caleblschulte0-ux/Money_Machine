import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Opaque bearer tokens. The plaintext is returned once to the caller; only the
 * SHA-256 digest is ever stored, so a database leak does not yield live
 * sessions or API keys.
 */
export interface IssuedToken {
  readonly plaintext: string;
  readonly digest: string;
}

export function issueToken(prefix: string, bytes = 32): IssuedToken {
  const plaintext = `${prefix}_${randomBytes(bytes).toString("base64url")}`;
  return { plaintext, digest: digestToken(plaintext) };
}

export function digestToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export function tokenMatches(plaintext: string, storedDigest: string): boolean {
  const a = Buffer.from(digestToken(plaintext), "hex");
  const b = Buffer.from(storedDigest, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Webhook signature verification (playbook §34). Constant-time, with a
 * timestamp window so a captured payload cannot be replayed indefinitely.
 */
export interface WebhookVerification {
  secret: string;
  payload: string;
  signatureHeader: string;
  timestampSeconds: number;
  now?: Date;
  toleranceSeconds?: number;
}

export function signWebhook(secret: string, payload: string, timestampSeconds: number): string {
  return createHmac("sha256", secret).update(`${timestampSeconds}.${payload}`).digest("hex");
}

export function verifyWebhook(input: WebhookVerification): { valid: boolean; reason?: string } {
  const tolerance = input.toleranceSeconds ?? 300;
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (Math.abs(nowSeconds - input.timestampSeconds) > tolerance) {
    return { valid: false, reason: "timestamp outside tolerance window" };
  }
  const expected = Buffer.from(signWebhook(input.secret, input.payload, input.timestampSeconds), "hex");
  let provided: Buffer;
  try {
    provided = Buffer.from(input.signatureHeader, "hex");
  } catch {
    return { valid: false, reason: "signature is not valid hex" };
  }
  if (provided.length !== expected.length) return { valid: false, reason: "signature length mismatch" };
  return timingSafeEqual(provided, expected)
    ? { valid: true }
    : { valid: false, reason: "signature mismatch" };
}
