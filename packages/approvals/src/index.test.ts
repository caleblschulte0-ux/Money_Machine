import { beforeEach, describe, expect, it } from "vitest";
import { usd } from "@holdco/core";
import { AuditLog } from "@holdco/audit";
import { seedOrganization, testClock, testStore, type SnapshotOverrides } from "@holdco/testing";
import type { Store } from "@holdco/database";
import type { FixedClock } from "@holdco/core";
import { ApprovalService } from "./index.ts";

const human = { type: "human" as const, id: "usr_owner" };
const agent = { type: "agent" as const, id: "research.market" };

describe("ApprovalService", () => {
  let store: Store;
  let service: ApprovalService;
  let clock: FixedClock;
  let organizationId: string;

  beforeEach(async () => {
    clock = testClock();
    store = testStore(clock);
    service = new ApprovalService(store, new AuditLog(store, clock), clock, usd(100));
    organizationId = (await seedOrganization(store)).id;
  });

  const request = () =>
    service.request(
      {
        organizationId,
        ventureId: null,
        actionKind: "payment.refund",
        title: "Refund Harbor Mechanical",
        summary: "Refund $450 for the cancelled audit.",
        reason: "Refunds are high risk and always require a human.",
        financialImpact: usd(450),
        requestedBy: "workflow:agency.refund",
        requestedByType: "workflow",
        payload: { accountId: "cus_1", amountMinor: 45_000 },
      },
      agent,
    );

  describe("gate", () => {
    it("lets low-risk work through at high autonomy", () => {
      const result = service.gate({
        organizationId,
        ventureId: null,
        actionKind: "report.generate",
        grantedLevel: 4,
      });
      expect(result.outcome).toBe("execute");
    });

    it("escalates money movement regardless of autonomy", () => {
      const result = service.gate({
        organizationId,
        ventureId: null,
        actionKind: "payment.charge",
        grantedLevel: 5,
      });
      expect(result.outcome).toBe("needs_approval");
    });

    it("denies prohibited actions outright", () => {
      const result = service.gate({
        organizationId,
        ventureId: null,
        actionKind: "employment.terminate",
        grantedLevel: 5,
      });
      expect(result.outcome).toBe("denied");
    });
  });

  it("refuses to queue a prohibited action for approval", async () => {
    await expect(
      service.request(
        {
          organizationId,
          ventureId: null,
          actionKind: "legal.advice",
          title: "Advise the client",
          summary: "x",
          reason: "y",
          requestedBy: "agent",
          requestedByType: "agent",
          payload: {},
        },
        agent,
      ),
    ).rejects.toThrow(/prohibited/);
  });

  it("captures the payload so approval replays the original action", async () => {
    const approval = await request();
    expect(approval.payload).toEqual({ accountId: "cus_1", amountMinor: 45_000 });
    expect(approval.riskClass).toBe("high");
    expect(approval.financialImpactMinor).toBe(45_000);
  });

  it("refuses a decision from a non-human actor", async () => {
    const approval = await request();
    await expect(
      service.decide(
        { approvalId: approval.id, decidedByUserId: "usr_owner", decision: "approved" },
        agent,
      ),
    ).rejects.toThrow(/Only a human/);
  });

  it("records a human decision and refuses to decide twice", async () => {
    const approval = await request();
    const decided = await service.decide(
      { approvalId: approval.id, decidedByUserId: "usr_owner", decision: "approved", notes: "verified" },
      human,
    );
    expect(decided.status).toBe("approved");
    expect(decided.decidedByUserId).toBe("usr_owner");

    await expect(
      service.decide(
        { approvalId: approval.id, decidedByUserId: "usr_owner", decision: "denied" },
        human,
      ),
    ).rejects.toThrow(/already approved/);
  });

  it("expires an approval past its deadline instead of allowing a stale decision", async () => {
    const approval = await service.request(
      {
        organizationId,
        ventureId: null,
        actionKind: "campaign.launch",
        title: "Launch spring campaign",
        summary: "Start the $2,000 campaign.",
        reason: "Campaign launches are high risk.",
        deadlineAt: new Date(clock.epochMillis() + 60_000),
        requestedBy: "workflow:x",
        requestedByType: "workflow",
        payload: {},
      },
      agent,
    );

    clock.advance(120_000);
    await expect(
      service.decide(
        { approvalId: approval.id, decidedByUserId: "usr_owner", decision: "approved" },
        human,
      ),
    ).rejects.toThrow(/deadline/);

    expect((await store.approvals.require(approval.id)).status).toBe("expired");
  });

  it("summarises the queue for the command center", async () => {
    await request();
    clock.advance(3600_000);
    const summary = await service.summary(organizationId);
    expect(summary.pending).toBe(1);
    expect(summary.pendingFinancialImpact.amountMinor).toBe(45_000);
    expect(summary.oldestPendingAgeMs).toBe(3600_000);
  });
});

export type { SnapshotOverrides };
