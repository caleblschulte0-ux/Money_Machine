import { money, type Money } from "@holdco/core";

/**
 * Capital allocation recommendations (playbook §5).
 *
 * This module *recommends*. It never moves money, never commits spend and
 * never changes a budget — the command center renders the recommendation and a
 * human with the `capital:allocate` permission decides. That separation is the
 * whole point of the section.
 */
export interface VentureAllocationInput {
  readonly ventureId: string;
  readonly ventureKey: string;
  readonly stage: string;
  /** 0..100 health score, or null when unevidenced. */
  readonly healthScore: number | null;
  /** 0..1 share of health weight that had evidence. */
  readonly healthCoverage: number;
  readonly monthlyRevenue: Money;
  readonly monthlyGrossProfit: Money;
  readonly monthlySpend: Money;
  readonly currentBudget: Money;
  /** Triggered kill criteria, if any. */
  readonly killCriteriaTriggered: number;
  /** Whether the venture has passed every launch gate. */
  readonly gatesPassed: boolean;
}

export type AllocationAction =
  | "increase"
  | "hold"
  | "decrease"
  | "freeze"
  | "wind_down";

export interface AllocationRecommendation {
  readonly ventureId: string;
  readonly ventureKey: string;
  readonly action: AllocationAction;
  readonly recommendedBudget: Money;
  readonly delta: Money;
  readonly rationale: readonly string[];
  /** How much to trust this recommendation, 0..1. */
  readonly confidence: number;
  readonly requiresHumanApproval: true;
}

export interface AllocationPlan {
  readonly periodKey: string;
  readonly available: Money;
  readonly allocated: Money;
  readonly unallocated: Money;
  readonly recommendations: readonly AllocationRecommendation[];
  readonly notes: readonly string[];
  readonly disclaimer: string;
}

const DISCLAIMER =
  "Advisory only. The platform does not move, commit or authorise money. " +
  "A human with the capital:allocate permission must approve every change, and " +
  "these figures are internal management estimates, not audited financials.";

function recommendFor(input: VentureAllocationInput): AllocationRecommendation {
  const rationale: string[] = [];
  let action: AllocationAction = "hold";
  let multiplier = 1;

  if (input.killCriteriaTriggered >= 2) {
    action = "wind_down";
    multiplier = 0;
    rationale.push(`${input.killCriteriaTriggered} kill criteria are triggered.`);
  } else if (input.killCriteriaTriggered === 1) {
    action = "freeze";
    multiplier = 1;
    rationale.push("One kill criterion is triggered; hold spend flat until it is resolved or accepted.");
  } else if (!input.gatesPassed && input.stage !== "validation" && input.stage !== "idea") {
    action = "freeze";
    multiplier = 1;
    rationale.push("Launch gates are not all passed; do not add capital until they are.");
  } else if (input.healthScore === null) {
    action = "hold";
    rationale.push("No health evidence yet. Capital decisions need measurement first.");
  } else if (input.healthScore >= 70 && input.monthlyGrossProfit.amountMinor > 0) {
    action = "increase";
    multiplier = 1.5;
    rationale.push(`Health ${input.healthScore}/100 with positive gross profit.`);
  } else if (input.healthScore >= 55) {
    action = "hold";
    rationale.push(`Health ${input.healthScore}/100 — keep spend flat and gather another period of data.`);
  } else {
    action = "decrease";
    multiplier = 0.5;
    rationale.push(`Health ${input.healthScore}/100 is below the 55 hold threshold.`);
  }

  if (input.healthCoverage < 0.5) {
    rationale.push(
      `Only ${(input.healthCoverage * 100).toFixed(0)}% of health dimensions are evidenced; ` +
        `treat this recommendation as weak.`,
    );
    if (action === "increase") {
      action = "hold";
      multiplier = 1;
      rationale.push("Downgraded from increase to hold because the evidence base is thin.");
    }
  }

  if (input.monthlyGrossProfit.amountMinor < 0 && action === "increase") {
    action = "hold";
    multiplier = 1;
    rationale.push("Gross profit is negative; growth spend would scale a loss.");
  }

  const recommendedBudget = money(Math.round(input.currentBudget.amountMinor * multiplier));
  const confidence = Math.min(1, Math.max(0.1, input.healthCoverage * (input.healthScore === null ? 0.3 : 1)));

  return {
    ventureId: input.ventureId,
    ventureKey: input.ventureKey,
    action,
    recommendedBudget,
    delta: money(recommendedBudget.amountMinor - input.currentBudget.amountMinor),
    rationale,
    confidence,
    requiresHumanApproval: true,
  };
}

export function buildAllocationPlan(
  periodKey: string,
  available: Money,
  ventures: readonly VentureAllocationInput[],
): AllocationPlan {
  const recommendations = ventures.map(recommendFor);
  const notes: string[] = [];

  let allocated = recommendations.reduce((sum, r) => sum + r.recommendedBudget.amountMinor, 0);

  if (allocated > available.amountMinor && allocated > 0) {
    // Scale proportionally rather than picking winners silently.
    const scale = available.amountMinor / allocated;
    notes.push(
      `Recommended budgets exceeded available capital by ` +
        `$${((allocated - available.amountMinor) / 100).toFixed(2)}; all recommendations were scaled by ` +
        `${(scale * 100).toFixed(0)}%. Choosing which venture to cut instead is an owner decision.`,
    );
    const scaled = recommendations.map((r) => ({
      ...r,
      recommendedBudget: money(Math.floor(r.recommendedBudget.amountMinor * scale)),
    }));
    allocated = scaled.reduce((sum, r) => sum + r.recommendedBudget.amountMinor, 0);
    return {
      periodKey,
      available,
      allocated: money(allocated),
      unallocated: money(available.amountMinor - allocated),
      recommendations: scaled.map((r) => ({
        ...r,
        delta: money(
          r.recommendedBudget.amountMinor -
            (ventures.find((v) => v.ventureId === r.ventureId)?.currentBudget.amountMinor ?? 0),
        ),
      })),
      notes,
      disclaimer: DISCLAIMER,
    };
  }

  const winding = recommendations.filter((r) => r.action === "wind_down");
  if (winding.length > 0) {
    notes.push(
      `${winding.length} venture(s) recommended for wind-down: ` +
        `${winding.map((r) => r.ventureKey).join(", ")}. ` +
        `Capital already spent is not a reason to continue funding them.`,
    );
  }

  return {
    periodKey,
    available,
    allocated: money(allocated),
    unallocated: money(available.amountMinor - allocated),
    recommendations,
    notes,
    disclaimer: DISCLAIMER,
  };
}
