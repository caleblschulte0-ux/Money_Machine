import { describe, expect, it } from "vitest";
import { snapshotFixture } from "@holdco/testing";
import { computeVentureHealth } from "./health.ts";

const org = "org_1";
const venture = "vnt_1";

describe("computeVentureHealth", () => {
  it("scores null with no evidence rather than inventing a number", () => {
    const health = computeVentureHealth({
      ventureId: venture,
      current: snapshotFixture(org, venture, "2026-03"),
    });
    // Founder dependence is always evaluable (hours default to 0), so coverage
    // is low but not zero — the point is that the score is heavily caveated.
    expect(health.coverage).toBeLessThan(0.5);
    expect(health.warnings.some((w) => w.includes("provisional"))).toBe(true);
  });

  it("marks a dimension unscored when its evidence is missing", () => {
    const health = computeVentureHealth({
      ventureId: venture,
      current: snapshotFixture(org, venture, "2026-03", { revenueMinor: 100_000 }),
    });
    const concentration = health.dimensions.find((d) => d.key === "customer_concentration");
    expect(concentration?.score).toBeNull();
    expect(concentration?.explanation).toContain("not supplied");
  });

  it("computes gross profit net of COGS, AI and contractor spend", () => {
    const health = computeVentureHealth({
      ventureId: venture,
      current: snapshotFixture(org, venture, "2026-03", {
        revenueMinor: 1_000_000,
        cogsMinor: 200_000,
        aiSpendMinor: 50_000,
        contractorSpendMinor: 150_000,
        marketingSpendMinor: 100_000,
      }),
    });
    expect(health.grossProfit.amountMinor).toBe(600_000);
    expect(health.netContribution.amountMinor).toBe(500_000);
  });

  it("penalises a venture whose CAC can never pay back", () => {
    const health = computeVentureHealth({
      ventureId: venture,
      current: snapshotFixture(org, venture, "2026-03", {
        revenueMinor: 100_000,
        cogsMinor: 150_000,
        newCustomers: 2,
        customerCount: 10,
        marketingSpendMinor: 200_000,
      }),
    });
    const payback = health.dimensions.find((d) => d.key === "payback_period");
    expect(payback?.score).toBe(0);
    expect(health.warnings.some((w) => w.includes("CAC cannot pay back"))).toBe(true);
  });

  it("rewards growth, margin and automation together", () => {
    const previous = snapshotFixture(org, venture, "2026-02", { revenueMinor: 800_000 });
    const health = computeVentureHealth({
      ventureId: venture,
      previous,
      current: snapshotFixture(org, venture, "2026-03", {
        revenueMinor: 1_100_000,
        cogsMinor: 150_000,
        aiSpendMinor: 20_000,
        customerCount: 20,
        newCustomers: 4,
        churnedCustomers: 0,
        marketingSpendMinor: 100_000,
        automatedActions: 900,
        manualActions: 100,
        humanHours: 10,
        supportCases: 4,
      }),
    });
    expect(health.score).not.toBeNull();
    expect(health.score!).toBeGreaterThan(70);
    expect(health.coverage).toBeGreaterThan(0.6);
  });

  it("reports the automation percentage from recorded actions", () => {
    const health = computeVentureHealth({
      ventureId: venture,
      current: snapshotFixture(org, venture, "2026-03", {
        automatedActions: 75,
        manualActions: 25,
      }),
    });
    const automation = health.dimensions.find((d) => d.key === "automation_level");
    expect(automation?.score).toBe(75);
  });
});
