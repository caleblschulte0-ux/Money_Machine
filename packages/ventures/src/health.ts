import { grossMarginRatio, money, type Money } from "@holdco/core";
import type { VentureMetricSnapshot } from "@holdco/database";

/**
 * Venture health scoring (playbook §5).
 *
 * Design rule: a dimension with no evidence scores `null`, not zero and not
 * fifty. The overall score is the weighted average of the dimensions we can
 * actually evidence, reported alongside `coverage` — the share of weight that
 * had evidence. A venture with 20% coverage and a score of 80 is not a healthy
 * venture; it is an unmeasured one, and the command center must say so.
 */
export type HealthDimensionKey =
  | "revenue_growth"
  | "gross_margin"
  | "retention"
  | "customer_concentration"
  | "acquisition_cost"
  | "payback_period"
  | "support_burden"
  | "engineering_burden"
  | "legal_risk"
  | "automation_level"
  | "market_size"
  | "competitive_pressure"
  | "founder_dependence"
  | "data_advantage"
  | "portfolio_synergy";

export interface HealthDimension {
  readonly key: HealthDimensionKey;
  readonly label: string;
  readonly weight: number;
  /** How this dimension gets evidence, shown in the UI when it is unscored. */
  readonly evidenceSource: string;
}

export const HEALTH_DIMENSIONS: readonly HealthDimension[] = [
  { key: "revenue_growth", label: "Revenue growth", weight: 3, evidenceSource: "Monthly metric snapshots" },
  { key: "gross_margin", label: "Gross margin", weight: 3, evidenceSource: "Revenue minus COGS and AI cost" },
  { key: "retention", label: "Customer retention", weight: 3, evidenceSource: "Churned vs starting customers" },
  { key: "customer_concentration", label: "Customer concentration", weight: 2, evidenceSource: "Revenue share of largest account" },
  { key: "acquisition_cost", label: "Acquisition cost", weight: 2, evidenceSource: "Marketing spend per new customer" },
  { key: "payback_period", label: "Payback period", weight: 2, evidenceSource: "CAC divided by monthly gross profit per customer" },
  { key: "support_burden", label: "Support burden", weight: 1, evidenceSource: "Support cases per customer" },
  { key: "engineering_burden", label: "Engineering burden", weight: 1, evidenceSource: "Manual engineering hours (entered)" },
  { key: "legal_risk", label: "Legal risk", weight: 2, evidenceSource: "Compliance review (entered)" },
  { key: "automation_level", label: "Automation level", weight: 2, evidenceSource: "Automated vs manual actions" },
  { key: "market_size", label: "Market size", weight: 1, evidenceSource: "Research agent output (entered)" },
  { key: "competitive_pressure", label: "Competitive pressure", weight: 1, evidenceSource: "Research agent output (entered)" },
  { key: "founder_dependence", label: "Founder dependence", weight: 2, evidenceSource: "Human hours per month" },
  { key: "data_advantage", label: "Data advantage", weight: 1, evidenceSource: "Owner assessment (entered)" },
  { key: "portfolio_synergy", label: "Cross-venture synergy", weight: 1, evidenceSource: "Owner assessment (entered)" },
];

export interface DimensionScore {
  readonly key: HealthDimensionKey;
  readonly label: string;
  readonly weight: number;
  /** 0..100, or null when there is no evidence. */
  readonly score: number | null;
  readonly explanation: string;
}

export interface VentureHealth {
  readonly ventureId: string;
  readonly periodKey: string;
  /** 0..100 over evidenced dimensions only, or null when nothing is evidenced. */
  readonly score: number | null;
  /** Share of total weight that had evidence, 0..1. */
  readonly coverage: number;
  readonly dimensions: readonly DimensionScore[];
  readonly grossProfit: Money;
  readonly netContribution: Money;
  readonly warnings: readonly string[];
}

/** Owner-entered judgements that have no automatic source yet. */
export interface QualitativeInputs {
  legalRisk?: number;
  marketSize?: number;
  competitivePressure?: number;
  dataAdvantage?: number;
  portfolioSynergy?: number;
  engineeringHours?: number;
  largestCustomerRevenueShare?: number;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Map a value to 0..100 where lower input is better. */
function inverseScale(value: number, best: number, worst: number): number {
  if (worst === best) return 50;
  return clamp(((worst - value) / (worst - best)) * 100);
}

/** Map a value to 0..100 where higher input is better. */
function forwardScale(value: number, worst: number, best: number): number {
  if (worst === best) return 50;
  return clamp(((value - worst) / (best - worst)) * 100);
}

export function computeVentureHealth(input: {
  ventureId: string;
  current: VentureMetricSnapshot;
  previous?: VentureMetricSnapshot | null;
  qualitative?: QualitativeInputs;
}): VentureHealth {
  const { current, previous } = input;
  const q = input.qualitative ?? {};
  const warnings: string[] = [];
  const dimensions: DimensionScore[] = [];

  const revenue = money(current.revenueMinor);
  const directCost = money(current.cogsMinor + current.aiSpendMinor + current.contractorSpendMinor);
  const grossProfit = money(revenue.amountMinor - directCost.amountMinor);
  const netContribution = money(
    grossProfit.amountMinor - current.marketingSpendMinor - current.otherSpendMinor - current.refundsMinor,
  );

  const add = (key: HealthDimensionKey, score: number | null, explanation: string): void => {
    const dimension = HEALTH_DIMENSIONS.find((d) => d.key === key)!;
    dimensions.push({ key, label: dimension.label, weight: dimension.weight, score, explanation });
  };

  // Revenue growth
  if (previous && previous.revenueMinor > 0) {
    const growth = (current.revenueMinor - previous.revenueMinor) / previous.revenueMinor;
    add("revenue_growth", forwardScale(growth, -0.2, 0.3),
      `${(growth * 100).toFixed(1)}% month over month`);
  } else if (previous && previous.revenueMinor === 0 && current.revenueMinor > 0) {
    add("revenue_growth", 70, "First revenue recorded this period");
  } else {
    add("revenue_growth", null, "No prior period snapshot to compare against");
  }

  // Gross margin
  const margin = grossMarginRatio(revenue, directCost);
  if (margin === null) {
    add("gross_margin", null, "No revenue recorded this period");
    warnings.push("No revenue recorded — margin, CAC and payback cannot be evaluated.");
  } else {
    add("gross_margin", forwardScale(margin, 0.2, 0.8), `${(margin * 100).toFixed(1)}% gross margin`);
  }

  // Retention
  const startingCustomers = current.customerCount - current.newCustomers + current.churnedCustomers;
  if (startingCustomers > 0) {
    const churn = current.churnedCustomers / startingCustomers;
    add("retention", inverseScale(churn, 0.0, 0.15),
      `${(churn * 100).toFixed(1)}% monthly customer churn`);
  } else {
    add("retention", null, "No customers at the start of the period");
  }

  // Concentration
  if (q.largestCustomerRevenueShare !== undefined) {
    add("customer_concentration", inverseScale(q.largestCustomerRevenueShare, 0.1, 0.8),
      `Largest customer is ${(q.largestCustomerRevenueShare * 100).toFixed(0)}% of revenue`);
  } else {
    add("customer_concentration", null, "Largest-customer revenue share not supplied");
  }

  // CAC and payback
  const cacMinor = current.newCustomers > 0 ? current.marketingSpendMinor / current.newCustomers : null;
  if (cacMinor === null) {
    add("acquisition_cost", null, "No new customers this period");
    add("payback_period", null, "No new customers this period");
  } else {
    add("acquisition_cost", inverseScale(cacMinor / 100, 50, 2000),
      `$${(cacMinor / 100).toFixed(0)} per new customer`);
    const grossProfitPerCustomer =
      current.customerCount > 0 ? grossProfit.amountMinor / current.customerCount : 0;
    if (grossProfitPerCustomer > 0) {
      const months = cacMinor / grossProfitPerCustomer;
      add("payback_period", inverseScale(months, 1, 18), `${months.toFixed(1)} months to pay back CAC`);
    } else {
      add("payback_period", 0, "Gross profit per customer is zero or negative — CAC never pays back");
      warnings.push("CAC cannot pay back at the current gross profit per customer.");
    }
  }

  // Support burden
  if (current.customerCount > 0) {
    const perCustomer = current.supportCases / current.customerCount;
    add("support_burden", inverseScale(perCustomer, 0.1, 3), `${perCustomer.toFixed(2)} cases per customer`);
  } else {
    add("support_burden", null, "No customers this period");
  }

  // Engineering burden
  if (q.engineeringHours !== undefined) {
    add("engineering_burden", inverseScale(q.engineeringHours, 5, 120), `${q.engineeringHours} engineering hours`);
  } else {
    add("engineering_burden", null, "Engineering hours not supplied");
  }

  // Automation level
  const totalActions = current.automatedActions + current.manualActions;
  if (totalActions > 0) {
    const ratio = current.automatedActions / totalActions;
    add("automation_level", clamp(ratio * 100), `${(ratio * 100).toFixed(0)}% of actions automated`);
  } else {
    add("automation_level", null, "No actions recorded this period");
  }

  // Founder dependence
  add("founder_dependence", inverseScale(current.humanHours, 4, 80),
    `${current.humanHours} human hours this period`);

  // Owner-entered judgements
  const qualitativeMap: Array<[HealthDimensionKey, number | undefined, string]> = [
    ["legal_risk", q.legalRisk, "Legal risk assessment"],
    ["market_size", q.marketSize, "Market size assessment"],
    ["competitive_pressure", q.competitivePressure, "Competitive pressure assessment"],
    ["data_advantage", q.dataAdvantage, "Data advantage assessment"],
    ["portfolio_synergy", q.portfolioSynergy, "Cross-venture synergy assessment"],
  ];
  for (const [key, value, label] of qualitativeMap) {
    if (value === undefined) add(key, null, `${label} not supplied`);
    else add(key, clamp(value), `${label}: ${clamp(value)}/100 (entered)`);
  }

  const evidenced = dimensions.filter((d) => d.score !== null);
  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
  const evidencedWeight = evidenced.reduce((sum, d) => sum + d.weight, 0);
  const score =
    evidencedWeight === 0
      ? null
      : Math.round(
          evidenced.reduce((sum, d) => sum + d.score! * d.weight, 0) / evidencedWeight,
        );
  const coverage = totalWeight === 0 ? 0 : evidencedWeight / totalWeight;

  if (coverage < 0.5) {
    warnings.push(
      `Only ${(coverage * 100).toFixed(0)}% of health weight is evidenced. Treat this score as provisional.`,
    );
  }

  return {
    ventureId: input.ventureId,
    periodKey: current.periodKey,
    score,
    coverage,
    dimensions,
    grossProfit,
    netContribution,
    warnings,
  };
}
