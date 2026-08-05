import { beforeEach, describe, expect, it } from "vitest";
import { money, type FixedClock, type JsonObject } from "@holdco/core";
import { FlagRegistry } from "@holdco/config";
import { AuditLog } from "@holdco/audit";
import { ApprovalService } from "@holdco/approvals";
import { CostLedger } from "@holdco/cost-accounting";
import { MetricsRegistry, createLogger, MemorySink } from "@holdco/observability";
import { seedOrganization, seedVenture, testClock, testStore } from "@holdco/testing";
import type { Store } from "@holdco/database";
import { ActionRegistry, type ActionHandler } from "./actions.ts";
import { WorkflowEngine, type TriggerEvent } from "./engine.ts";
import type { WorkflowDefinition } from "./definition.ts";

interface Harness {
  store: Store;
  engine: WorkflowEngine;
  flags: FlagRegistry;
  approvals: ApprovalService;
  clock: FixedClock;
  calls: string[];
  failNext: Set<string>;
  organizationId: string;
  ventureId: string;
}

function recordingHandler(
  type: ActionHandler["type"],
  harness: { calls: string[]; failNext: Set<string> },
  cost = 0,
): ActionHandler {
  return {
    type,
    describe: (input) => `${type} ${JSON.stringify(input)}`,
    async execute(input, context) {
      if (harness.failNext.has(context.stepId)) {
        harness.calls.push(`${context.stepId}:attempt`);
        throw new Error(`simulated failure in ${context.stepId}`);
      }
      harness.calls.push(`${context.stepId}:${type}`);
      return { output: { ok: true, echoed: input as JsonObject }, cost: money(cost) };
    },
    async compensate(_input, context) {
      harness.calls.push(`${context.stepId}:compensated`);
    },
  };
}

async function createHarness(): Promise<Harness> {
  const clock = testClock();
  const store = testStore(clock);
  const audit = new AuditLog(store, clock);
  const flags = new FlagRegistry();
  const approvals = new ApprovalService(store, audit, clock, money(10_000));
  const costs = new CostLedger(store, clock);
  const actions = new ActionRegistry();
  const state = { calls: [] as string[], failNext: new Set<string>() };

  for (const type of ["task.create", "email.send", "record.tag", "human.notify"] as const) {
    actions.register(recordingHandler(type, state));
  }

  const organization = await seedOrganization(store);
  const venture = await seedVenture(store, organization.id);

  return {
    store,
    flags,
    approvals,
    clock,
    calls: state.calls,
    failNext: state.failNext,
    organizationId: organization.id,
    ventureId: venture.id,
    engine: new WorkflowEngine({
      store, audit, approvals, costs, actions, flags,
      logger: createLogger({ level: "error", sink: new MemorySink() }),
      metrics: new MetricsRegistry(),
      clock,
    }),
  };
}

function workflow(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  return {
    key: "test.flow",
    version: 1,
    name: "Test flow",
    description: "A workflow used only in tests.",
    ventureKey: "test-venture",
    trigger: { type: "lead.created", idempotencyPath: "leadId" },
    autonomyLevel: 3,
    maxRunCostMinor: 1000,
    status: "active",
    steps: [
      {
        id: "tag",
        name: "Tag the lead",
        action: "record.tag",
        actionKind: "record.tag",
        input: { entity: "leads", id: "{{trigger.leadId}}", tag: "inbound" },
      },
      {
        id: "task",
        name: "Create the follow-up task",
        action: "task.create",
        actionKind: "task.create",
        input: { title: "Follow up with {{trigger.companyName}}" },
      },
    ],
    ...overrides,
  };
}

function trigger(harness: Harness, payload: JsonObject = {}): TriggerEvent {
  return {
    type: "lead.created",
    organizationId: harness.organizationId,
    ventureId: harness.ventureId,
    payload: { leadId: "led_1", companyName: "Harbor Mechanical", score: 80, ...payload },
  };
}

describe("WorkflowEngine", () => {
  let harness: Harness;

  beforeEach(async () => {
    harness = await createHarness();
  });

  it("runs every step and records the run", async () => {
    const result = await harness.engine.run(workflow(), trigger(harness));
    expect(result.run.status).toBe("succeeded");
    expect(harness.calls).toEqual(["tag:record.tag", "task:task.create"]);
    expect(result.steps.map((s) => s.status)).toEqual(["succeeded", "succeeded"]);
  });

  it("resolves templates against the trigger payload", async () => {
    await harness.engine.run(workflow(), trigger(harness));
    const steps = await harness.store.workflowStepRuns.all({ orderBy: { field: "index", direction: "asc" } });
    expect(steps[1]!.input).toMatchObject({ title: "Follow up with Harbor Mechanical" });
  });

  it("skips steps whose condition fails, without failing the run", async () => {
    const definition = workflow({
      steps: [
        {
          id: "tag",
          name: "Tag",
          action: "record.tag",
          actionKind: "record.tag",
          when: { op: "gte", path: "trigger.score", value: 90 },
          input: { entity: "leads", id: "{{trigger.leadId}}", tag: "hot" },
        },
        {
          id: "task",
          name: "Task",
          action: "task.create",
          actionKind: "task.create",
          input: { title: "Follow up" },
        },
      ],
    });
    const result = await harness.engine.run(definition, trigger(harness));
    expect(result.run.status).toBe("succeeded");
    expect(result.steps[0]!.status).toBe("skipped");
    expect(harness.calls).toEqual(["task:task.create"]);
  });

  it("does not run when the trigger condition is not met", async () => {
    const definition = workflow({
      trigger: {
        type: "lead.created",
        when: { op: "equals", path: "channel", value: "referral" },
      },
    });
    const result = await harness.engine.run(definition, trigger(harness));
    expect(result.run.status).toBe("cancelled");
    expect(harness.calls).toHaveLength(0);
  });

  it("stops entirely when the global kill switch is engaged", async () => {
    harness.flags.setOverride({
      key: "killswitch.all_automation",
      value: true,
      reason: "incident",
      setBy: "owner",
      setAt: harness.clock.now(),
    });
    const result = await harness.engine.run(workflow(), trigger(harness));
    expect(result.run.status).toBe("cancelled");
    expect(harness.calls).toHaveLength(0);
    expect(result.run.error).toMatchObject({ reason: expect.stringContaining("kill switch") });
  });

  it("honours a workflow-specific kill switch", async () => {
    harness.flags.define({
      key: "killswitch.test_flow",
      description: "test",
      defaultValue: false,
      status: "stable",
      owner: "owner",
    });
    harness.flags.setOverride({
      key: "killswitch.test_flow",
      value: true,
      reason: "paused for review",
      setBy: "owner",
      setAt: harness.clock.now(),
    });
    const result = await harness.engine.run(
      workflow({ killSwitchKey: "killswitch.test_flow" }),
      trigger(harness),
    );
    expect(result.run.status).toBe("cancelled");
  });

  it("deduplicates a replayed trigger", async () => {
    const first = await harness.engine.run(workflow(), trigger(harness));
    const second = await harness.engine.run(workflow(), trigger(harness));
    expect(second.deduplicated).toBe(true);
    expect(second.run.id).toBe(first.run.id);
    expect(harness.calls).toEqual(["tag:record.tag", "task:task.create"]);
  });

  it("treats a different trigger payload as a new run", async () => {
    await harness.engine.run(workflow(), trigger(harness));
    const second = await harness.engine.run(workflow(), trigger(harness, { leadId: "led_2" }));
    expect(second.deduplicated).toBe(false);
    expect(harness.calls).toHaveLength(4);
  });

  it("dry runs without executing anything", async () => {
    const result = await harness.engine.dryRun(workflow(), trigger(harness));
    expect(result.run.status).toBe("dry_run");
    expect(harness.calls).toHaveLength(0);
    expect(result.plan[0]).toContain("would record.tag");
  });

  it("queues an approval and stops when a step exceeds its autonomy", async () => {
    const definition = workflow({
      autonomyLevel: 3,
      steps: [
        {
          id: "refund",
          name: "Refund the customer",
          action: "task.create",
          actionKind: "payment.refund",
          input: { title: "refund" },
        },
        {
          id: "after",
          name: "Should not run",
          action: "task.create",
          actionKind: "task.create",
          input: { title: "after" },
        },
      ],
    });
    const result = await harness.engine.run(definition, trigger(harness));
    expect(result.run.status).toBe("waiting_approval");
    expect(harness.calls).toHaveLength(0);

    const pending = await harness.approvals.pending(harness.organizationId);
    expect(pending).toHaveLength(1);
    expect(pending[0]!.actionKind).toBe("payment.refund");
    expect(pending[0]!.payload).toMatchObject({ stepId: "refund" });
  });

  it("denies a prohibited action instead of queueing it", async () => {
    const definition = workflow({
      steps: [
        {
          id: "advice",
          name: "Give legal advice",
          action: "email.send",
          actionKind: "legal.advice",
          input: { to: "x@example.invalid" },
        },
      ],
    });
    const result = await harness.engine.run(definition, trigger(harness));
    expect(result.run.status).toBe("failed");
    expect(result.steps[0]!.status).toBe("denied");
    expect(await harness.approvals.pending(harness.organizationId)).toHaveLength(0);
  });

  it("runs a step's declared compensating action when a later step fails", async () => {
    harness.failNext.add("task");
    const definition = workflow({
      steps: [
        {
          id: "tag",
          name: "Tag",
          action: "record.tag",
          actionKind: "record.tag",
          input: { entity: "leads", id: "{{trigger.leadId}}", tag: "inbound" },
          compensate: {
            action: "record.tag",
            input: { entity: "leads", id: "{{trigger.leadId}}", tag: "reverted" },
          },
        },
        {
          id: "task",
          name: "Task",
          action: "task.create",
          actionKind: "task.create",
          input: { title: "boom" },
          maxRetries: 0,
          onFailure: "stop",
        },
      ],
    });

    const result = await harness.engine.run(definition, trigger(harness));
    expect(result.run.status).toBe("failed");
    // The compensating action ran: record.tag was invoked a second time.
    expect(harness.calls.filter((c) => c === "tag:record.tag")).toHaveLength(2);
    expect(result.plan).toContain("[tag] compensated");
  });

  it("falls back to the handler's own undo when no compensating action is declared", async () => {
    harness.failNext.add("task");
    const definition = workflow({
      steps: [
        {
          id: "tag",
          name: "Tag",
          action: "record.tag",
          actionKind: "record.tag",
          input: { entity: "leads", id: "{{trigger.leadId}}", tag: "inbound" },
        },
        {
          id: "task",
          name: "Task",
          action: "task.create",
          actionKind: "task.create",
          input: { title: "boom" },
          maxRetries: 0,
          onFailure: "stop",
        },
      ],
    });

    const result = await harness.engine.run(definition, trigger(harness));
    expect(result.run.status).toBe("failed");
    expect(harness.calls).toContain("tag:compensated");
  });

  it("says plainly when a completed step cannot be undone", async () => {
    harness.failNext.add("notify");
    const definition = workflow({
      steps: [
        {
          id: "send",
          name: "Send",
          action: "email.send",
          actionKind: "email.send_transactional",
          input: { to: "dana@harbor-mechanical.invalid" },
        },
        {
          id: "notify",
          name: "Notify",
          action: "human.notify",
          actionKind: "notification.internal",
          input: {},
          maxRetries: 0,
          onFailure: "stop",
        },
      ],
    });

    // email.send in this harness has no compensate implementation.
    const engineActions = new ActionRegistry();
    engineActions.register({
      type: "email.send",
      describe: () => "send email",
      async execute(_input, context) {
        harness.calls.push(`${context.stepId}:email.send`);
        return { output: {}, cost: money(0) };
      },
    });
    engineActions.register(recordingHandler("human.notify", harness));

    const engine = new WorkflowEngine({
      store: harness.store,
      audit: new AuditLog(harness.store, harness.clock),
      approvals: harness.approvals,
      costs: new CostLedger(harness.store, harness.clock),
      actions: engineActions,
      flags: harness.flags,
      logger: createLogger({ level: "error", sink: new MemorySink() }),
      metrics: new MetricsRegistry(),
      clock: harness.clock,
    });

    const result = await engine.run(definition, trigger(harness));
    expect(result.run.status).toBe("failed");
    expect(result.plan.some((p) => p.includes("NOT COMPENSATED"))).toBe(true);
  });

  it("continues past a failure when the step says to", async () => {
    harness.failNext.add("tag");
    const definition = workflow({
      steps: [
        {
          id: "tag",
          name: "Tag",
          action: "record.tag",
          actionKind: "record.tag",
          input: {},
          maxRetries: 0,
          onFailure: "continue",
        },
        { id: "task", name: "Task", action: "task.create", actionKind: "task.create", input: {} },
      ],
    });
    const result = await harness.engine.run(definition, trigger(harness));
    expect(result.run.status).toBe("succeeded");
    expect(harness.calls).toContain("task:task.create");
  });

  it("queues a retry job when the step asks for the failure queue", async () => {
    harness.failNext.add("tag");
    const definition = workflow({
      steps: [
        {
          id: "tag",
          name: "Tag",
          action: "record.tag",
          actionKind: "record.tag",
          input: {},
          maxRetries: 0,
          onFailure: "queue",
        },
      ],
    });
    await harness.engine.run(definition, trigger(harness));
    const jobs = await harness.store.scheduledJobs.all({});
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.key).toContain("workflow.retry");
  });

  it("aborts before exceeding the run cost ceiling", async () => {
    const definition = workflow({
      maxRunCostMinor: 50,
      steps: [
        {
          id: "expensive",
          name: "Expensive step",
          action: "task.create",
          actionKind: "task.create",
          input: {},
          estimatedCostMinor: 80,
        },
      ],
    });
    const result = await harness.engine.run(definition, trigger(harness));
    expect(result.run.status).toBe("failed");
    expect(result.steps[0]!.error).toMatchObject({
      reason: expect.stringContaining("cost ceiling"),
    });
    expect(harness.calls).toHaveLength(0);
  });

  it("refuses to run an inactive workflow", async () => {
    const result = await harness.engine.run(workflow({ status: "paused" }), trigger(harness));
    expect(result.run.status).toBe("cancelled");
  });

  it("writes an audit trail for the run", async () => {
    await harness.engine.run(workflow(), trigger(harness));
    const events = await harness.store.auditEvents.all({
      orderBy: { field: "occurredAt", direction: "asc" },
    });
    const actions = events.map((e) => e.action);
    expect(actions).toContain("workflow.run_started");
    expect(actions).toContain("workflow.run_finished");
  });
});
