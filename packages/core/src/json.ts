export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Read a dotted path out of a JSON-ish object. Used by the workflow engine to
 * evaluate conditions against trigger payloads without eval or template
 * languages.
 */
export function getPath(source: unknown, path: string): JsonValue | undefined {
  const segments = path.split(".").filter(Boolean);
  let current: unknown = source;
  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index)) return undefined;
      current = current[index];
      continue;
    }
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current as JsonValue | undefined;
}

/** Stable stringify — key order independent. Used for idempotency keys. */
export function stableStringify(value: JsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k] as JsonValue)}`)
    .join(",")}}`;
}

/**
 * Replace values at known-sensitive keys before anything is logged or shown in
 * an audit trail.
 */
const REDACT_KEYS = [
  "password", "secret", "token", "apikey", "api_key", "authorization",
  "ssn", "taxid", "tax_id", "cardnumber", "card_number", "cvv", "accountnumber",
  "account_number", "routingnumber", "routing_number", "privatekey", "private_key",
];

export function redact<T extends JsonValue>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => redact(v)) as T;
  if (isJsonObject(value)) {
    const out: JsonObject = {};
    for (const [key, v] of Object.entries(value)) {
      out[key] = REDACT_KEYS.includes(key.toLowerCase().replace(/[-\s]/g, ""))
        ? "[redacted]"
        : redact(v);
    }
    return out as T;
  }
  return value;
}
