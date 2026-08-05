import { grossMarginRatio, money } from "@holdco/core";
import type { VentureMetricSnapshot } from "@holdco/database";

/**
 * Kill criteria (playbook §30).
 *
 * These are evaluated mechanically and reported without softening. The
 * playbook is explicit that sunk cost is not a reason to continue, so nothing
 * in this module weighs "effort already invested", and the recommendation
 * never mentions how much code exists.
 */
export type KillCriterionKey =
  | "no_paid_demand"
  | "cac_exceeds_ltv"
  | "gross_margin_below_target"
  | "refund_rate_high"
  | "retention_poor"
  | "support_burden_high"
  | "founder_dependence_high"
  | "ai_cost_destroys_economics"
  | "stop_loss_breached";

export interface KillCriterion {
  readonly key: KillCriterionKey;
  readonly label: string;
  readonly rationale: string;
}

export const KILL_CRITERIA: readonly KillCriterion[] = [
  { key: "no_paid_demand", label: "No paid demand after the defined outreach volume", rationale: "Interest that never converts to payment is not demand." },
  { key: "cac_exceeds_ltv", label: "Acquisition cost exceeds lifetime value", rationale: "Growth makes the loss larger, not smaller." },
  { key: "gross_margin_below_target", label: "Gross margin below target", rationale: "Delivery cost leaves nothing to fund the portfolio." },
  { key: "refund_rate_high", label: "Refund rate above threshold", rationale: "Customers are paying and then deciding it was not worth it." },
  { key: "retention_poor", label: "Retention below threshold", rationale: "Recurring revenue that does not recur is one-time revenue with extra steps." },
  { key: "support_burden_high", label: "Support burden above threshold", rationale: "Every new customer adds cost faster than margin." },
  { key: "founder_dependence_high", label: "Founder intervention above threshold", rationale: "The venture is a job, not an asset." },
  { key: "ai_cost_destroys_economics", label: "AI cost above share of revenue", rationale: "Inference cost is eating the margin the business exists to produce." },
  { key: "stop_loss_breached", label: "Cumulative loss beyond the stop-loss", rationale: "The owner set a maximum loss in advance; it has been reached." },
];

export interface KillThresholds {
  /** Minimum outreach attempts before "no paid demand" can be judged. */
  minOutreachForDemandJudgement: number;
  minGrossMarginRatio: number;
  maxRefundRatio: number;
  maxMonthlyChurnRatio: number;
  maxSupportCasesPerCustomer: number;
  maxHumanHoursPerMonth: number;
  maxAiCostShareOfRevenue: number;
  maxCacToLtvRatio: number;
}

export const DEFAULT_KILL_THRESHOLDS: KillThresholds = {
  minOutreachForDemandJudgement: 200,
  minGrossMarginRatio: 0.5,
  maxRefundRatio: 0.1,
  maxMonthlyChurnRatio: 0.1,
  maxSupportCasesPerCustomer: 2,
  maxHumanHoursPerMonth: 60,
  maxAiCostShareOfRevenue: 0.25,
  maxCacToLtvRatio: 1,
};

export interface KillEvaluationInput {
  snapshot: VentureMetricSnapshot;
  previous?: VentureMetricSnapshot | null;
  thresholds?: Partial<KillThresholds>;
  /** Outreach attempts made in the venture to date. */
  outreachAttempts?: number;
  /** Estimated lifetime value per customer, in minor units. */
  estimatedLtvMinor?: number;
  /** Cumulative net loss to date, minor units (positive number = loss). */
  cumulativeLossMinor?: number;
  /** The venture's configured stop-loss, minor units. */
  stopLossMinor?: number;
}

export interface TriggeredCriterion {
  readonly key: KillCriterionKey;
  readonly label: string;
  readonly detail: string;
}

export interface KillEvaluation {
  readonly triggered: readonly TriggeredCriterion[];
  readonly unevaluable: readonly { key: KillCriterionKey; reason: string }[];
  /**
   * `continue` — nothing triggered.
   * `review` — one criterion triggered; the owner should decide deliberately.
   * `shutdown_recommended` — two or more triggered, or the stop-loss breached.
   */
  readonly recommendation: "continue" | "review" | "shutdown_recommended";
  readonly summary: string;
}

export function evaluateKillCriteria(input: KillEvaluationInput): KillEvaluation {
  const t = { ...DEFAULT_KILL_THRESHOLDS, ...input.thresholds };
  const s = input.snapshot;
  const triggered: TriggeredCriterion[] = [];
  const unevaluable: { key: KillCriterionKey; reason: string }[] = [];

  const push = (key: KillCriterionKey, detail: string): void => {
    triggered.push({ key, label: KILL_CRITERIA.find((c) => c.key === key)!.label, detail });
  };

  // No paid demand
  if (input.outreachAttempts === undefined) {
    unevaluable.push({ key: "no_paid_demand", reason: "Outreach volume not supplied" });
  } else if (input.outreachAttempts >= t.minOutreachForDemandJudgement && s.revenueMinor === 0) {
    push("no_paid_demand", `${input.outreachAttempts} outreach attempts and no revenue.`);
  }

  // Gross margin
  const directCost = money(s.cogsMinor + s.aiSpendMinor + s.contractorSpendMinor);
  const margin = grossMarginRatio(money(s.revenueMinor), directCost);
  if (margin === null) {
    unevaluable.push({ key: "gross_margin_below_target", reason: "No revenue this period" });
  } else if (margin < t.minGrossMarginRatio) {
    push("gross_margin_below_target",
      `Gross margin ${(margin * 100).toFixed(1)}% is below the ${(t.minGrossMarginRatio * 100).toFixed(0)}% target.`);
  }

  // CAC vs LTV
  const cacMinor = s.newCustomers > 0 ? s.marketingSpendMinor / s.newCustomers : null;
  if (cacMinor === null || input.estimatedLtvMinor === undefined) {
    unevaluable.push({
      key: "cac_exceeds_ltv",
      reason: cacMinor === null ? "No new customers this period" : "Estimated LTV not supplied",
    });
  } else if (input.estimatedLtvMinor > 0 && cacMinor / input.estimatedLtvMinor > t.maxCacToLtvRatio) {
    push("cac_exceeds_ltv",
      `CAC $${(cacMinor / 100).toFixed(0)} against estimated LTV $${(input.estimatedLtvMinor / 100).toFixed(0)}.`);
  }

  // Refunds
  if (s.revenueMinor > 0) {
    const refundRatio = s.refundsMinor / s.revenueMinor;
    if (refundRatio > t.maxRefundRatio) {
      push("refund_rate_high", `Refunds are ${(refundRatio * 100).toFixed(1)}% of revenue.`);
    }
  } else {
    unevaluable.push({ key: "refund_rate_high", reason: "No revenue this period" });
  }

  // Retention
  const startingCustomers = s.customerCount - s.newCustomers + s.churnedCustomers;
  if (startingCustomers > 0) {
    const churn = s.churnedCustomers / startingCustomers;
    if (churn > t.maxMonthlyChurnRatio) {
      push("retention_poor", `Monthly churn ${(churn * 100).toFixed(1)}%.`);
    }
  } else {
    unevaluable.push({ key: "retention_poor", reason: "No customers at start of period" });
  }

  // Support burden
  if (s.customerCount > 0) {
    const perCustomer = s.supportCases / s.customerCount;
    if (perCustomer > t.maxSupportCasesPerCustomer) {
      push("support_burden_high", `${perCustomer.toFixed(2)} support cases per customer.`);
    }
  } else {
    unevaluable.push({ key: "support_burden_high", reason: "No customers this period" });
  }

  // Founder dependence
  if (s.humanHours > t.maxHumanHoursPerMonth) {
    push("founder_dependence_high", `${s.humanHours} human hours this period.`);
  }

  // AI cost share
  if (s.revenueMinor > 0) {
    const share = s.aiSpendMinor / s.revenueMinor;
    if (share > t.maxAiCostShareOfRevenue) {
      push("ai_cost_destroys_economics", `AI inference is ${(share * 100).toFixed(1)}% of revenue.`);
    }
  } else if (s.aiSpendMinor > 0) {
    push("ai_cost_destroys_economics", `AI inference spend with no revenue this period.`);
  }

  // Stop-loss
  if (input.cumulativeLossMinor === undefined || !input.stopLossMinor) {
    unevaluable.push({ key: "stop_loss_breached", reason: "Cumulative loss or stop-loss not supplied" });
  } else if (input.cumulativeLossMinor >= input.stopLossMinor) {
    push("stop_loss_breached",
      `Cumulative loss $${(input.cumulativeLossMinor / 100).toFixed(0)} has reached the stop-loss of $${(input.stopLossMinor / 100).toFixed(0)}.`);
  }

  const stopLossBreached = triggered.some((c) => c.key === "stop_loss_breached");
  const recommendation: KillEvaluation["recommendation"] =
    stopLossBreached || triggered.length >= 2
      ? "shutdown_recommended"
      : triggered.length === 1
        ? "review"
        : "continue";

  const summary =
    recommendation === "continue"
      ? `No kill criteria triggered${unevaluable.length ? ` (${unevaluable.length} could not be evaluated)` : ""}.`
      : recommendation === "review"
        ? `One kill criterion triggered: ${triggered[0]!.label}. Decide deliberately rather than drifting.`
        : `${triggered.length} kill criteria triggered${stopLossBreached ? ", including the stop-loss" : ""}. ` +
          `Recommend pause, sale or shutdown. Work already invested is not a reason to continue.`;

  return { triggered, unevaluable, recommendation, summary };
}
