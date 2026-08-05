import { beforeEach, describe, expect, it } from "vitest";
import { money, usd, type FixedClock } from "@holdco/core";
import { createPlatform, installVentureModule, type Platform } from "@holdco/platform";
import { seedOrganization, seedVenture, testClock, testEnv, testLogger } from "@holdco/testing";
import { MODULE as AGENCY, SCORING_MODEL } from "@venture/automation-agency";
import { LAUNCH_GATES } from "@holdco/ventures";

/**
 * End-to-end: a real inbound lead flows through scoring, triggers the venture's
 * workflow, produces work for a human, and every step is attributable.
 *
 * This is the test that would catch the composition root drifting away from
 * the packages it wires together.
 */
describe("integration: inbound lead through the platform", () => {
  let platform: Platform;
  let clock: FixedClock;
  let organizationId: string;
  let ventureId: string;

  beforeEach(async () => {
    clock = testClock();
    const { logger } = testLogger();
    platform = await createPlatform({ env: testEnv(), clock, logger });
    installVentureModule(platform, AGENCY);

    const organization = await seedOrganization(platform.store);
    organizationId = organization.id;
    const venture = await seedVenture(platform.store, organizationId, {
      key: "automation-agency",
      name: "AI Automation Agency",
      brandName: "Ridgeline Operations",
      maxAutonomyLevel: 3,
    });
    ventureId = venture.id;
  });

  it("boots with every provider on a mock and no spend enabled", () => {
    expect(platform.store.driver).toBe("memory");
    expect(platform.providers.model.name).toBe("mock");
    expect(platform.providers.model.billable).toBe(false);
    expect(platform.providers.email.delivers).toBe(false);
    expect(platform.providers.payments.movesMoney).toBe(false);
    expect(platform.env.ALLOW_PAID_PROVIDERS).toBe(false);
    expect(platform.env.ALLOW_LIVE_COMMUNICATIONS).toBe(false);
  });

  it("registers the venture module's workflows, agents and flags", () => {
    expect(platform.ventureModules.get("automation-agency")).toBeDefined();
    expect(platform.workflows.has("agency.lead_intake")).toBe(true);
    expect(platform.agents.has("agency.audit_analyst")).toBe(true);
    expect(platform.flags.get("feature.venture.automation_agency")).toBeDefined();
  });

  it("scores an inbound lead and runs the intake workflow to completion", async () => {
    const capture = await platform.crm.captureLead(
      {
        organizationId,
        ventureId,
        actor: { type: "system" },
      },
      {
        channel: "web_form",
        source: "pricing_page",
        companyName: "Harbor Mechanical Services",
        serviceType: "operations_audit",
        contact: {
          firstName: "Dana",
          lastName: "Whitmore",
          email: "dana.whitmore@harbor-mechanical.invalid",
          phone: "555-0142",
          title: "Operations Manager",
          source: "pricing_page",
        },
        scoringModel: SCORING_MODEL,
        payload: {
          employeeCount: 64,
          monthlyHoursOnProcess: 45,
          budgetRange: "10k-25k",
          role: "Operations Manager",
          systems: "QuickBooks, ServiceTitan, Outlook",
          timeline: "this_quarter",
        },
      },
    );

    expect(capture.outcome).toBe("captured");
    expect(capture.lead.status).toBe("qualified");

    const definition = platform.workflows.get("agency.lead_intake");
    const result = await platform.engine.run(definition, {
      type: "lead.created",
      organizationId,
      ventureId,
      payload: {
        ventureKey: "automation-agency",
        leadId: capture.lead.id,
        companyName: "Harbor Mechanical Services",
        channel: "web_form",
        score: capture.lead.score,
      },
    });

    expect(result.run.status).toBe("succeeded");

    const tasks = await platform.store.tasks.all({ where: { organizationId } });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.title).toContain("Harbor Mechanical Services");

    const lead = await platform.store.leads.require(capture.lead.id);
    expect(lead.tags).toContain("web_form");

    // A human can reconstruct what happened from the audit trail alone.
    const audit = await platform.audit.query({ organizationId, limit: 50 });
    const actions = audit.map((e) => e.action);
    expect(actions).toContain("lead.scored");
    expect(actions).toContain("workflow.run_started");
    expect(actions).toContain("workflow.run_finished");
  });

  it("dry-runs the delivery workflow without spending or writing", async () => {
    const definition = platform.workflows.get("agency.audit_delivery");
    const before = await platform.store.agentRuns.count({});

    const result = await platform.engine.dryRun(definition, {
      type: "manual",
      organizationId,
      ventureId,
      payload: {
        projectId: "prj_1",
        accountId: "cus_1",
        companyName: "Harbor Mechanical Services",
        industry: "HVAC",
        employeeCount: "64",
        processes: "Dispatch scheduling: 45 hours/month. Invoice entry: 30 hours/month.",
        systems: "ServiceTitan, QuickBooks",
      },
    });

    expect(result.run.status).toBe("dry_run");
    expect(result.plan.length).toBeGreaterThan(0);
    expect(await platform.store.agentRuns.count({})).toBe(before);
    expect((await platform.costs.total({ organizationId })).amountMinor).toBe(0);
  });

  it("stops the proposal step at the approval queue", async () => {
    const definition = platform.workflows.get("agency.audit_delivery");
    const result = await platform.engine.run(definition, {
      type: "manual",
      organizationId,
      ventureId,
      payload: {
        projectId: "prj_2",
        accountId: "cus_1",
        companyName: "Harbor Mechanical Services",
        industry: "HVAC",
        employeeCount: "64",
        processes: "Dispatch scheduling: 45 hours/month.",
        systems: "ServiceTitan",
      },
    });

    // Autonomy level 2 means every step needs a human, so the run stops at the
    // first step and queues an approval rather than silently proceeding.
    expect(result.run.status).toBe("waiting_approval");
    const pending = await platform.approvals.pending(organizationId);
    expect(pending).toHaveLength(1);
    expect(pending[0]!.requestedByType).toBe("workflow");
  });

  it("keeps a venture out of build until its gates pass, then lets it through", async () => {
    const actor = { type: "human" as const, id: "usr_owner" };
    await platform.ventures.transition(
      { organizationId, ventureId, to: "validation", reason: "beginning validation" },
      actor,
    );

    await expect(
      platform.ventures.transition(
        { organizationId, ventureId, to: "build", reason: "impatient" },
        actor,
      ),
    ).rejects.toThrow(/launch gate/);

    for (const gate of LAUNCH_GATES) {
      await platform.ventures.recordGate(
        {
          organizationId,
          ventureId,
          gate: gate.key,
          evidence: Object.fromEntries(
            gate.requirements.map((r) => [r.key, `Evidence for ${r.key} collected 2026-02-20.`]),
          ),
        },
        actor,
      );
    }

    const built = await platform.ventures.transition(
      { organizationId, ventureId, to: "build", reason: "all gates passed" },
      actor,
    );
    expect(built.stage).toBe("build");
  });

  it("produces a portfolio summary that admits what it cannot measure", async () => {
    const summary = await platform.analytics.portfolio(organizationId, "2026-03");
    expect(summary.ventures).toHaveLength(1);
    expect(summary.ventures[0]!.revenue).toBeNull();
    expect(summary.measurementGaps.length).toBeGreaterThan(0);
    expect(summary.disclaimer).toContain("Not audited financial statements");
  });

  it("attributes cost to the venture and the customer", async () => {
    await platform.costs.record({
      organizationId,
      ventureId,
      category: "ai_inference",
      amount: usd(4.5),
      description: "audit analysis",
      customerAccountId: "cus_1",
    });
    await platform.costs.record({
      organizationId,
      ventureId: null,
      category: "software",
      amount: usd(20),
      description: "holdco tooling",
    });

    const byVenture = await platform.costs.byVenture(organizationId, "2026-03");
    expect(byVenture.get(ventureId)?.amountMinor).toBe(450);
    expect(byVenture.get(null)?.amountMinor).toBe(2000);

    const byCustomer = await platform.costs.byCustomer(organizationId, "2026-03", ventureId);
    expect(byCustomer.get("cus_1")?.amountMinor).toBe(450);
  });

  it("refuses to charge while live billing is disabled", async () => {
    await expect(
      platform.billing.charge({
        organizationId,
        ventureId,
        accountId: "cus_1",
        amount: money(250_000),
        description: "Automation audit",
        actor: { type: "human", id: "usr_owner" },
      }),
    ).rejects.toThrow(/Live billing is disabled/);
  });
});
