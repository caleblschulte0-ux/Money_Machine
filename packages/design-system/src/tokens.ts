/**
 * Design tokens.
 *
 * One system, many brands (playbook §37, §42). The palette below is the
 * holding company's internal chrome; each venture supplies its own brand
 * colours and wordmark, and customer-facing surfaces render the venture's
 * brand rather than the holdco's — most customers should never encounter the
 * parent name at all.
 */
export interface BrandTheme {
  readonly key: string;
  readonly name: string;
  readonly accent: string;
  readonly accentContrast: string;
  readonly logoText: string;
  readonly fontStack?: string;
}

export const HOLDCO_THEME: BrandTheme = {
  key: "holdco",
  name: "Command Center",
  accent: "#2f6f5f",
  accentContrast: "#ffffff",
  logoText: "Northbridge",
};

/** Status colours shared by every surface, tuned for light and dark. */
export const STATUS_COLORS = {
  neutral: { fg: "var(--fg-muted)", bg: "var(--surface-2)" },
  positive: { fg: "#1c6b45", bg: "rgba(28,107,69,0.12)" },
  caution: { fg: "#8a5a12", bg: "rgba(138,90,18,0.14)" },
  negative: { fg: "#9b2c2c", bg: "rgba(155,44,44,0.12)" },
  info: { fg: "#2b5b8a", bg: "rgba(43,91,138,0.12)" },
} as const;

export type StatusTone = keyof typeof STATUS_COLORS;

/** Venture stage → tone, so the portfolio table reads at a glance. */
export const STAGE_TONE: Record<string, StatusTone> = {
  idea: "neutral",
  validation: "info",
  build: "info",
  launched: "positive",
  scaling: "positive",
  paused: "caution",
  shutting_down: "negative",
  closed: "neutral",
  sold: "neutral",
};

export const APPROVAL_TONE: Record<string, StatusTone> = {
  pending: "caution",
  approved: "positive",
  denied: "negative",
  expired: "negative",
  cancelled: "neutral",
};

export const RISK_TONE: Record<string, StatusTone> = {
  low: "positive",
  medium: "caution",
  high: "negative",
  prohibited: "negative",
};
