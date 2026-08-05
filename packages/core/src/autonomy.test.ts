import { describe, expect, it } from "vitest";
import { decideAutonomy, riskClassFor, MAX_AUTONOMY_BY_RISK } from "./autonomy.ts";
import { usd } from "./money.ts";

describe("riskClassFor", () => {
  it("classifies known actions", () => {
    expect(riskClassFor("report.generate")).toBe("low");
    expect(riskClassFor("email.send_marketing")).toBe("medium");
    expect(riskClassFor("payment.charge")).toBe("high");
    expect(riskClassFor("legal.advice")).toBe("prohibited");
  });

  it("treats unknown actions as high risk rather than low", () => {
    expect(riskClassFor("some.action.nobody.classified")).toBe("high");
  });
});

describe("decideAutonomy", () => {
  it("denies prohibited actions at every autonomy level", () => {
    for (const level of [0, 1, 2, 3, 4, 5] as const) {
      const decision = decideAutonomy({ actionKind: "medical.advice", grantedLevel: level });
      expect(decision.outcome).toBe("deny");
    }
  });

  it("executes low-risk work at level 5", () => {
    const decision = decideAutonomy({ actionKind: "report.generate", grantedLevel: 5 });
    expect(decision.outcome).toBe("execute");
  });

  it("caps high-risk actions at approval even when level 5 is granted", () => {
    const decision = decideAutonomy({ actionKind: "payment.charge", grantedLevel: 5 });
    expect(decision.outcome).toBe("require_approval");
    expect(MAX_AUTONOMY_BY_RISK.high).toBe(2);
  });

  it("caps medium-risk actions at level 4 rather than 5", () => {
    const decision = decideAutonomy({ actionKind: "email.send_marketing", grantedLevel: 5 });
    expect(decision.outcome).toBe("execute");
    if (decision.outcome === "execute") expect(decision.effectiveLevel).toBe(4);
  });

  it("requires approval at or above the financial threshold", () => {
    const below = decideAutonomy({
      actionKind: "report.generate",
      grantedLevel: 5,
      financialImpact: usd(99),
      approvalThreshold: usd(100),
    });
    expect(below.outcome).toBe("execute");

    const atThreshold = decideAutonomy({
      actionKind: "report.generate",
      grantedLevel: 5,
      financialImpact: usd(100),
      approvalThreshold: usd(100),
    });
    expect(atThreshold.outcome).toBe("require_approval");
  });

  it("caps irreversible actions at level 2 regardless of grant", () => {
    const decision = decideAutonomy({
      actionKind: "content.publish_scheduled",
      grantedLevel: 4,
      reversible: false,
    });
    expect(decision.outcome).toBe("require_approval");
    if (decision.outcome === "require_approval") {
      expect(decision.reason).toContain("irreversible");
    }
  });

  it("requires approval at levels 0 through 2", () => {
    for (const level of [0, 1, 2] as const) {
      const decision = decideAutonomy({ actionKind: "report.generate", grantedLevel: level });
      expect(decision.outcome).toBe("require_approval");
    }
  });
});
