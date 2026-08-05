import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Envelope encryption for individual sensitive fields (§34 "encryption for
 * sensitive stored data"): AES-256-GCM with a random 96-bit IV per value and
 * the authentication tag stored alongside.
 *
 * The key comes from FIELD_ENCRYPTION_KEY. Rotating it requires re-encrypting
 * existing values — see docs/SECURITY.md.
 */
const VERSION = "v1";

function normalizeKey(key: string): Buffer {
  // Accept either 32 raw base64 bytes or any passphrase (hashed to 32 bytes).
  try {
    const decoded = Buffer.from(key, "base64");
    if (decoded.length === 32) return decoded;
  } catch {
    // fall through to hashing
  }
  return createHash("sha256").update(key).digest();
}

export function encryptField(plaintext: string, key: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", normalizeKey(key), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptField(encoded: string, key: string): string {
  const [version, ivB64, tagB64, dataB64] = encoded.split(":");
  if (version !== VERSION || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Encrypted field is malformed or uses an unsupported version.");
  }
  const decipher = createDecipheriv("aes-256-gcm", normalizeKey(key), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(`${VERSION}:`);
}

/**
 * Deterministic blind index for equality lookups on encrypted columns
 * (e.g. "find the contact with this email") without decrypting the whole
 * table. Not reversible; not a substitute for encryption.
 */
export function blindIndex(value: string, key: string): string {
  return createHash("sha256")
    .update(normalizeKey(key))
    .update(value.trim().toLowerCase())
    .digest("hex");
}
