import { createHash } from "node:crypto";

/**
 * Duplicate detection for inbound leads.
 *
 * Lead-gen buyers pay per lead, so a duplicate that slips through is a refund
 * request and a credibility problem. The strategy is a deterministic
 * fingerprint plus a similarity check for near-misses.
 */
export function normalizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const [local, domain] = trimmed.split("@");
  if (!local || !domain) return trimmed;
  // Gmail-style dots and +tags are the same mailbox.
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return `${local.split("+")[0]!.replace(/\./g, "")}@gmail.com`;
  }
  return `${local.split("+")[0]}@${domain}`;
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // Treat a leading US country code as equivalent to the 10-digit form.
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export interface DedupeFingerprintInput {
  ventureId: string | null;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  postalCode?: string | null;
  serviceType?: string | null;
}

/**
 * The fingerprint is venture-scoped: the same person requesting a roofing
 * quote and an HVAC quote is two legitimate leads, not one duplicate.
 */
export function dedupeFingerprint(input: DedupeFingerprintInput): string {
  const parts = [
    input.ventureId ?? "holdco",
    input.email ? normalizeEmail(input.email) : "",
    input.phone ? normalizePhone(input.phone) : "",
    input.companyName ? normalizeName(input.companyName) : "",
    input.postalCode?.trim().toLowerCase() ?? "",
    input.serviceType?.trim().toLowerCase() ?? "",
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

/** Normalised Levenshtein similarity in [0,1]. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const rows = a.length + 1;
  const cols = b.length + 1;
  let previous = Array.from({ length: cols }, (_, i) => i);
  for (let i = 1; i < rows; i++) {
    const current = [i, ...Array<number>(cols - 1).fill(0)];
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1]! + 1, previous[j]! + 1, previous[j - 1]! + cost);
    }
    previous = current;
  }
  const distance = previous[cols - 1]!;
  return 1 - distance / Math.max(a.length, b.length);
}

export interface DuplicateCandidate {
  readonly id: string;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly companyName?: string | null;
  readonly createdAt: Date;
}

export interface DuplicateMatch {
  readonly candidateId: string;
  readonly confidence: number;
  readonly reasons: readonly string[];
}

export interface DuplicateCheckOptions {
  /** Matches older than this are not treated as duplicates. */
  windowDays?: number;
  now?: Date;
  minConfidence?: number;
}

/**
 * Compare an incoming lead against existing ones. Exact contact matches score
 * 1.0; fuzzy company-name matches alone are reported but stay below the
 * default acceptance threshold, because rejecting a real lead costs a sale.
 */
export function findDuplicates(
  incoming: { email?: string | null; phone?: string | null; companyName?: string | null },
  candidates: readonly DuplicateCandidate[],
  options: DuplicateCheckOptions = {},
): readonly DuplicateMatch[] {
  const windowDays = options.windowDays ?? 30;
  const now = options.now ?? new Date();
  const minConfidence = options.minConfidence ?? 0.8;
  const cutoff = now.getTime() - windowDays * 24 * 60 * 60 * 1000;

  const email = incoming.email ? normalizeEmail(incoming.email) : null;
  const phone = incoming.phone ? normalizePhone(incoming.phone) : null;
  const company = incoming.companyName ? normalizeName(incoming.companyName) : null;

  const matches: DuplicateMatch[] = [];

  for (const candidate of candidates) {
    if (candidate.createdAt.getTime() < cutoff) continue;

    const reasons: string[] = [];
    let confidence = 0;

    if (email && candidate.email && normalizeEmail(candidate.email) === email) {
      confidence = Math.max(confidence, 1);
      reasons.push("identical email after normalisation");
    }
    if (phone && candidate.phone && normalizePhone(candidate.phone) === phone) {
      confidence = Math.max(confidence, 1);
      reasons.push("identical phone after normalisation");
    }
    if (company && candidate.companyName) {
      const score = similarity(company, normalizeName(candidate.companyName));
      if (score >= 0.9) {
        confidence = Math.max(confidence, score * 0.75);
        reasons.push(`company name ${(score * 100).toFixed(0)}% similar`);
      }
    }

    if (confidence >= minConfidence) {
      matches.push({ candidateId: candidate.id, confidence, reasons });
    }
  }

  return matches.sort((a, b) => b.confidence - a.confidence);
}
