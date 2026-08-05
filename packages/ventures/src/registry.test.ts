import { beforeEach, describe, expect, it } from "vitest";
import { AuditLog } from "@holdco/audit";
import { seedOrganization, testClock, testStore } from "@holdco/testing";
import type { Store } from "@holdco/database";
import { VentureRegistry } from "./registry.ts";
import { LAUNCH_GATES } from "./launch-gate.ts";

const actor = { type: "human" as const, id: "usr_owner", label: "Owner" };

function fullEvidence(gate: (typeof LAUNCH_GATES)[number]): Record<string, string> {
  return Object.fromEntries(
    gate.requirements.map((r) => [r.key, `Documented evidence for ${r.key}, gathered 2026-02-14.`]),
  );
}

describe("VentureRegistry", () => {
  let store: Store;
  let registry: VentureRegistry;
  let organizationId: string;

  beforeEach(async () => {
    const clock = testClock();
    store = testStore(clock);
    registry = new VentureRegistry(store, new AuditLog(store, clock), clock);
    organizationId = (await seedOrganization(store)).id;
  });

  it("creates a venture in the idea stage and audits it", async () => {
    const venture = await registry.create(
      {
        organizationId,
        key: "automation-agency",
        name: "AI Automation Agency",
        brandName: "Ridgeline Operations",
        thesis: "Sell measured hour reductions on specific operational handoffs.",
      },
      actor,
    );
    expect(venture.stage).toBe("idea");

    const events = await store.auditEvents.all({ where: { entityId: venture.id } });
    expect(events).toHaveLength(1);
    expect(events[0]!.action).toBe("venture.created");
  });

  it("rejects malformed venture keys", async () => {
    await expect(
      registry.create(
        {
          organizationId,
          key: "Not A Key",
          name: "x",
          brandName: "x",
          thesis: "x",
        },
        actor,
      ),
    ).rejects.toThrow(/lowercase/);
  });

  it("refuses illegal stage transitions", async () => {
    const venture = await registry.create(
      { organizationId, key: "alpha", name: "Alpha", brandName: "Alpha", thesis: "t" },
      actor,
    );
    await expect(
      registry.transition(
        { organizationId, ventureId: venture.id, to: "launched", reason: "skipping ahead" },
        actor,
      ),
    ).rejects.toThrow(/Cannot move venture/);
  });

  it("requires a reason for every stage change", async () => {
    const venture = await registry.create(
      { organizationId, key: "alpha", name: "Alpha", brandName: "Alpha", thesis: "t" },
      actor,
    );
    await expect(
      registry.transition(
        { organizationId, ventureId: venture.id, to: "validation", reason: "  " },
        actor,
      ),
    ).rejects.toThrow(/reason/);
  });

  it("blocks entry to build until every launch gate passes", async () => {
    const venture = await registry.create(
      { organizationId, key: "alpha", name: "Alpha", brandName: "Alpha", thesis: "t" },
      actor,
    );
    await registry.transition(
      { organizationId, ventureId: venture.id, to: "validation", reason: "starting validation" },
      actor,
    );

    await expect(
      registry.transition(
        { organizationId, ventureId: venture.id, to: "build", reason: "ready" },
        actor,
      ),
    ).rejects.toThrow(/launch gate/);

    for (const gate of LAUNCH_GATES) {
      await registry.recordGate(
        { organizationId, ventureId: venture.id, gate: gate.key, evidence: fullEvidence(gate) },
        actor,
      );
    }

    const readiness = await registry.launchReadiness(venture.id);
    expect(readiness.ready).toBe(true);

    const moved = await registry.transition(
      { organizationId, ventureId: venture.id, to: "build", reason: "gates passed" },
      actor,
    );
    expect(moved.stage).toBe("build");
  });

  it("allows an owner override but records it as an override", async () => {
    const venture = await registry.create(
      { organizationId, key: "alpha", name: "Alpha", brandName: "Alpha", thesis: "t" },
      actor,
    );
    await registry.transition(
      { organizationId, ventureId: venture.id, to: "validation", reason: "starting" },
      actor,
    );
    const forced = await registry.transition(
      { organizationId, ventureId: venture.id, to: "build", reason: "owner accepts the risk", force: true },
      actor,
    );
    expect(forced.stageReason).toContain("[OVERRIDE]");

    // Select the event by its content rather than by position: the fixed clock
    // gives both stage changes the same timestamp, so ordering is ambiguous.
    const events = await store.auditEvents.all({ where: { action: "venture.stage_changed" } });
    const buildEvent = events.find((e) => (e.after as { stage?: string })?.stage === "build");
    expect(buildEvent?.after).toMatchObject({ forced: true });
  });

  it("records a failed gate rather than throwing", async () => {
    const venture = await registry.create(
      { organizationId, key: "alpha", name: "Alpha", brandName: "Alpha", thesis: "t" },
      actor,
    );
    const result = await registry.recordGate(
      {
        organizationId,
        ventureId: venture.id,
        gate: "demand",
        evidence: { paid_pilot: "no" },
      },
      actor,
    );
    expect(result.passed).toBe(false);
    expect(result.notes).toContain("At least one of");
  });

  it("upserts a metric snapshot for the same period", async () => {
    const venture = await registry.create(
      { organizationId, key: "alpha", name: "Alpha", brandName: "Alpha", thesis: "t" },
      actor,
    );
    const base = {
      organizationId,
      ventureId: venture.id,
      revenueMinor: 100,
      cogsMinor: 0, marketingSpendMinor: 0, contractorSpendMinor: 0, aiSpendMinor: 0,
      otherSpendMinor: 0, customerCount: 1, activeSubscriptions: 1, newCustomers: 1,
      churnedCustomers: 0, refundsMinor: 0, receivablesMinor: 0, supportCases: 0,
      humanHours: 0, automatedActions: 0, manualActions: 0,
    };
    await registry.recordSnapshot({ ...base, periodKey: "2026-03" });
    await registry.recordSnapshot({ ...base, periodKey: "2026-03", revenueMinor: 500 });

    const snapshots = await registry.snapshots(venture.id);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]!.revenueMinor).toBe(500);
  });
});
