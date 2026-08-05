import { describe, expect, it } from "vitest";
import { snapshotFixture } from "@holdco/testing";
import { evaluateKillCriteria } from "./kill-criteria.ts";

const org = "org_1";
const venture = "vnt_1";

describe("evaluateKillCriteria", () => {
  it("recommends continuing when nothing triggers", () => {
    const result = evaluateKillCriteria({
      snapshot: snapshotFixture(org, venture, "2026-03", {
        revenueMinor: 1_000_000,
        cogsMinor: 200_000,
        aiSpendMinor: 50_000,
        customerCount: 20,
        newCustomers: 3,
        churnedCustomers: 0,
        supportCases: 5,
        humanHours: 20,
      }),
    });
    expect(result.recommendation).toBe("continue");
    expect(result.triggered).toHaveLength(0);
  });

  it("reports criteria it cannot evaluate instead of passing them silently", () => {
    const result = evaluateKillCriteria({
      snapshot: snapshotFixture(org, venture, "2026-03"),
    });
    expect(result.unevaluable.map((u) => u.key)).toContain("cac_exceeds_ltv");
    expect(result.unevaluable.map((u) => u.key)).toContain("stop_loss_breached");
  });

  it("flags no paid demand once the outreach bar is met", () => {
    const result = evaluateKillCriteria({
      snapshot: snapshotFixture(org, venture, "2026-03"),
      outreachAttempts: 250,
    });
    expect(result.triggered.map((t) => t.key)).toContain("no_paid_demand");
  });

  it("does not judge demand before enough outreach has happened", () => {
    const result = evaluateKillCriteria({
      snapshot: snapshotFixture(org, venture, "2026-03"),
      outreachAttempts: 10,
    });
    expect(result.triggered.map((t) => t.key)).not.toContain("no_paid_demand");
  });

  it("flags AI cost eating the margin", () => {
    const result = evaluateKillCriteria({
      snapshot: snapshotFixture(org, venture, "2026-03", {
        revenueMinor: 100_000,
        aiSpendMinor: 40_000,
      }),
    });
    expect(result.triggered.map((t) => t.key)).toContain("ai_cost_destroys_economics");
  });

  it("recommends shutdown when the stop-loss is breached, even alone", () => {
    const result = evaluateKillCriteria({
      snapshot: snapshotFixture(org, venture, "2026-03", {
        revenueMinor: 1_000_000,
        cogsMinor: 100_000,
        customerCount: 10,
        newCustomers: 1,
      }),
      cumulativeLossMinor: 600_000,
      stopLossMinor: 500_000,
    });
    expect(result.recommendation).toBe("shutdown_recommended");
    expect(result.summary).toContain("stop-loss");
  });

  it("escalates from review to shutdown as criteria accumulate", () => {
    const one = evaluateKillCriteria({
      snapshot: snapshotFixture(org, venture, "2026-03", {
        revenueMinor: 100_000,
        cogsMinor: 90_000,
        customerCount: 10,
      }),
    });
    expect(one.recommendation).toBe("review");

    const many = evaluateKillCriteria({
      snapshot: snapshotFixture(org, venture, "2026-03", {
        revenueMinor: 100_000,
        cogsMinor: 90_000,
        aiSpendMinor: 40_000,
        refundsMinor: 30_000,
        customerCount: 10,
        churnedCustomers: 4,
        humanHours: 120,
        supportCases: 40,
      }),
    });
    expect(many.recommendation).toBe("shutdown_recommended");
    expect(many.triggered.length).toBeGreaterThanOrEqual(2);
  });

  it("never cites work already invested as a reason to continue", () => {
    const result = evaluateKillCriteria({
      snapshot: snapshotFixture(org, venture, "2026-03", {
        revenueMinor: 100_000,
        cogsMinor: 90_000,
        aiSpendMinor: 40_000,
        customerCount: 10,
        humanHours: 200,
      }),
    });
    expect(result.summary.toLowerCase()).not.toMatch(/sunk|already built|invested in code/);
    expect(result.summary).toContain("not a reason to continue");
  });
});
