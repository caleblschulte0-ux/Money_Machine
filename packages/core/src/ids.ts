import { randomUUID, randomBytes } from "node:crypto";

/**
 * Prefixed, sortable identifiers.
 *
 * Format: `<prefix>_<48-bit-time><80-bit-random>` in lowercase base32.
 * Time-prefixing keeps ids roughly ordered by creation, which makes database
 * indexes behave and makes audit logs readable without a join.
 */
const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz"; // Crockford base32, no i/l/o/u

function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export const ID_PREFIXES = {
  organization: "org",
  user: "usr",
  session: "ses",
  membership: "mem",
  venture: "vnt",
  contact: "cnt",
  lead: "led",
  opportunity: "opp",
  customer: "cus",
  vendor: "ven",
  task: "tsk",
  note: "not",
  communication: "com",
  document: "doc",
  supportCase: "sup",
  workflow: "wfl",
  workflowRun: "wfr",
  workflowStep: "wfs",
  agent: "agt",
  agentRun: "agr",
  approval: "apr",
  costEntry: "cst",
  auditEvent: "aud",
  experiment: "exp",
  subscription: "sub",
  invoice: "inv",
  payment: "pay",
  consent: "csn",
  suppression: "sup",
  knowledge: "knw",
  campaign: "cmp",
  event: "evt",
  idempotency: "idm",
} as const;

export type IdPrefix = (typeof ID_PREFIXES)[keyof typeof ID_PREFIXES];

export function newId(prefix: IdPrefix, now: number = Date.now()): string {
  const time = Buffer.alloc(6);
  time.writeUIntBE(now, 0, 6);
  const random = randomBytes(10);
  return `${prefix}_${encodeBase32(Buffer.concat([time, random]))}`;
}

export function isId(value: unknown, prefix?: IdPrefix): value is string {
  if (typeof value !== "string") return false;
  const [head, tail] = value.split("_");
  if (!head || !tail) return false;
  if (prefix && head !== prefix) return false;
  return /^[0-9a-hjkmnp-tv-z]+$/.test(tail);
}

/** Opaque correlation id used to stitch logs, audit events and cost entries. */
export function newCorrelationId(): string {
  return randomUUID();
}
