import type { JsonObject } from "@holdco/core";
import { getPath } from "@holdco/core";

/**
 * Lead scoring.
 *
 * Rules are data, not code, so a venture can tune its own scoring without a
 * deploy and so the reasons behind a score can be shown to a human (and to a
 * lead buyer disputing quality). Every rule that fires contributes a reason
 * string; a score with no reasons is a bug.
 */
export type RuleOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "in"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "exists"
  | "missing"
  | "matches";

export interface ScoringRule {
  readonly key: string;
  /** Dotted path into the lead payload. */
  readonly field: string;
  readonly operator: RuleOperator;
  readonly value?: unknown;
  readonly points: number;
  readonly reason: string;
  /** When true, firing this rule disqualifies the lead outright. */
  readonly disqualifies?: boolean;
}

export interface ScoringModel {
  readonly key: string;
  readonly ventureKey: string;
  readonly version: number;
  readonly rules: readonly ScoringRule[];
  /** Score at or above which the lead is treated as qualified. */
  readonly qualifiedThreshold: number;
  readonly maxScore: number;
}

function evaluate(rule: ScoringRule, payload: JsonObject): boolean {
  const actual = getPath(payload, rule.field);
  switch (rule.operator) {
    case "exists":
      return actual !== undefined && actual !== null && actual !== "";
    case "missing":
      return actual === undefined || actual === null || actual === "";
    case "equals":
      return actual === rule.value;
    case "not_equals":
      return actual !== rule.value;
    case "contains":
      return typeof actual === "string" && typeof rule.value === "string"
        ? actual.toLowerCase().includes(rule.value.toLowerCase())
        : false;
    case "in":
      return Array.isArray(rule.value) && rule.value.includes(actual as never);
    case "gt":
      return typeof actual === "number" && typeof rule.value === "number" && actual > rule.value;
    case "gte":
      return typeof actual === "number" && typeof rule.value === "number" && actual >= rule.value;
    case "lt":
      return typeof actual === "number" && typeof rule.value === "number" && actual < rule.value;
    case "lte":
      return typeof actual === "number" && typeof rule.value === "number" && actual <= rule.value;
    case "matches":
      return typeof actual === "string" && typeof rule.value === "string"
        ? new RegExp(rule.value, "i").test(actual)
        : false;
  }
}

export interface LeadScore {
  readonly score: number;
  readonly normalized: number;
  readonly qualified: boolean;
  readonly disqualified: boolean;
  readonly reasons: readonly string[];
  readonly firedRules: readonly string[];
  readonly modelKey: string;
  readonly modelVersion: number;
}

export function scoreLead(model: ScoringModel, payload: JsonObject): LeadScore {
  let score = 0;
  let disqualified = false;
  const reasons: string[] = [];
  const firedRules: string[] = [];

  for (const rule of model.rules) {
    if (!evaluate(rule, payload)) continue;
    firedRules.push(rule.key);
    if (rule.disqualifies) {
      disqualified = true;
      reasons.push(`DISQUALIFIED: ${rule.reason}`);
      continue;
    }
    score += rule.points;
    reasons.push(`${rule.points >= 0 ? "+" : ""}${rule.points} ${rule.reason}`);
  }

  const bounded = Math.max(0, Math.min(model.maxScore, score));
  if (reasons.length === 0) {
    reasons.push("No scoring rules matched this lead.");
  }

  return {
    score: bounded,
    normalized: model.maxScore > 0 ? bounded / model.maxScore : 0,
    qualified: !disqualified && bounded >= model.qualifiedThreshold,
    disqualified,
    reasons,
    firedRules,
    modelKey: model.key,
    modelVersion: model.version,
  };
}

/**
 * Spam and junk detection, kept separate from scoring because the response is
 * different: a low-scoring lead is still a lead, a spam submission is not.
 */
export interface SpamSignal {
  readonly key: string;
  readonly detail: string;
}

export interface SpamCheckInput {
  email?: string | null;
  phone?: string | null;
  message?: string | null;
  name?: string | null;
  /** Hidden form field that only a bot fills in. */
  honeypot?: string | null;
  /** Milliseconds between form render and submit. */
  submissionTimeMs?: number;
}

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
  "throwawaymail.com", "yopmail.com", "trashmail.com",
]);

const SPAM_PHRASES = [
  "seo services", "guest post", "backlink", "crypto investment", "make money fast",
  "increase your ranking", "web design offer", "buy followers",
];

export function detectSpam(input: SpamCheckInput): readonly SpamSignal[] {
  const signals: SpamSignal[] = [];

  if (input.honeypot && input.honeypot.trim() !== "") {
    signals.push({ key: "honeypot_filled", detail: "Hidden form field was populated." });
  }
  if (input.submissionTimeMs !== undefined && input.submissionTimeMs < 2000) {
    signals.push({
      key: "submitted_too_fast",
      detail: `Form submitted in ${input.submissionTimeMs}ms.`,
    });
  }
  if (input.email) {
    const domain = input.email.split("@")[1]?.toLowerCase();
    if (domain && DISPOSABLE_DOMAINS.has(domain)) {
      signals.push({ key: "disposable_email", detail: `Disposable email domain "${domain}".` });
    }
  }
  if (input.phone) {
    const digits = input.phone.replace(/\D/g, "");
    if (digits.length > 0 && /^(\d)\1+$/.test(digits)) {
      signals.push({ key: "repeated_digit_phone", detail: "Phone number is a single repeated digit." });
    }
  }
  if (input.message) {
    const lower = input.message.toLowerCase();
    const hits = SPAM_PHRASES.filter((p) => lower.includes(p));
    if (hits.length > 0) {
      signals.push({ key: "solicitation_phrases", detail: `Contains: ${hits.join(", ")}.` });
    }
    const links = (input.message.match(/https?:\/\//g) ?? []).length;
    if (links >= 3) {
      signals.push({ key: "excessive_links", detail: `${links} links in the message body.` });
    }
  }
  if (input.name && /^[a-z]{16,}$/i.test(input.name.replace(/\s/g, ""))) {
    signals.push({ key: "gibberish_name", detail: "Name looks machine-generated." });
  }

  return signals;
}

/** Two or more independent signals is the bar for rejecting a submission. */
export function isSpam(signals: readonly SpamSignal[]): boolean {
  if (signals.some((s) => s.key === "honeypot_filled")) return true;
  return signals.length >= 2;
}
