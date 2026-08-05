import {
  errors,
  money,
  newCorrelationId,
  newId,
  stableStringify,
  systemClock,
  toAppError,
  type Clock,
  type JsonObject,
  type JsonValue,
} from "@holdco/core";
import { getPath } from "@holdco/core";
import type { Store, WorkflowRunRecord, WorkflowStepRunRecord } from "@holdco/database";
import type { FlagRegistry } from "@holdco/config";
import { AUDIT_ACTIONS, AuditLog } from "@holdco/audit";
import { ApprovalService } from "@holdco/approvals";
import { CostLedger } from "@holdco/cost-accounting";
import { METRICS, type Logger, type MetricsRegistry } from "@holdco/observability";
import { evaluateCondition, resolveTemplate } from "./conditions.ts";
import type { WorkflowDefinition, WorkflowStep } from "./definition.ts";
import { ActionRegistry, type ActionContext, type ActionResult } from "./actions.ts";

export type RunMode = "live" | "dry_run" | "mock";

export interface TriggerEvent {
  readonly type: string;
  readonly payload: JsonObject;
  readonly organizationId: string;
  readonly ventureId: string | null;
  readonly correlationId?: string;
  readonly source?: string;
}

export interface RunOptions {
  readonly mode?: RunMode;
  /** Explicit key; otherwise derived from trigger.idempotencyPath. */
  readonly idempotencyKey?: string;
  readonly actor?: { type: "human" | "agent" | "system"; id?: string };
}

export interface WorkflowRunResult {
  readonly run: WorkflowRunRecord;
  readonly steps: readonly WorkflowStepRunRecord[];
  readonly context: JsonObject;
  /** Populated in dry-run mode: what each step would have done. */
  readonly plan: readonly string[];
  readonly deduplicated: boolean;
}

export interface WorkflowEngineDeps {
  store: Store;
  audit: AuditLog;
  approvals: ApprovalService;
  costs: CostLedger;
  actions: ActionRegistry;
  flags: FlagRegistry;
  logger: Logger;
  metrics: MetricsRegistry;
  clock?: Clock;
}

const IDEMPOTENCY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The workflow engine.
 *
 * Guarantees, in the order they are enforced:
 *  1. Kill switches stop everything, without editing definitions.
 *  2. Idempotency — a replayed trigger does not run the workflow twice.
 *  3. Per-step approval gating via the autonomy policy.
 *  4. A hard run-cost ceiling, checked before each step.
 *  5. Retries with a failure queue, never an infinite loop.
 *  6. Compensation of completed steps when a later step fails.
 *  7. Every decision recorded on a step run a human can read.
 */
export class WorkflowEngine {
  private readonly clock: Clock;

  constructor(private readonly deps: WorkflowEngineDeps) {
    this.clock = deps.clock ?? systemClock;
  }

  async run(
    definition: WorkflowDefinition,
    trigger: TriggerEvent,
    options: RunOptions = {},
  ): Promise<WorkflowRunResult> {
    const mode: RunMode = options.mode ?? "live";
    const correlationId = trigger.correlationId ?? newCorrelationId();
    const startedAt = this.clock.now();
    const runId = newId("wfr", startedAt.getTime());
    const actor = options.actor ?? { type: "system" as const };
    const flagContext = {
      organizationId: trigger.organizationId,
      ventureId: trigger.ventureId ?? undefined,
    };
    const logger = this.deps.logger.child({
      workflowKey: definition.key,
      workflowRunId: runId,
      correlationId,
      mode,
    });

    // 1. Kill switches and flags -----------------------------------------
    const stopped = this.stopReason(definition, flagContext);
    if (stopped && mode !== "dry_run") {
      const run = await this.createRun(runId, definition, trigger, correlationId, mode, null, {
        status: "cancelled",
        error: { reason: stopped },
      });
      logger.warn("workflow blocked", { reason: stopped });
      await this.deps.audit.record({
        scope: { organizationId: trigger.organizationId, correlationId },
        ventureId: trigger.ventureId,
        action: AUDIT_ACTIONS.workflowKilled,
        entityType: "workflow_run",
        entityId: runId,
        actor: { type: "system" },
        summary: `Workflow "${definition.key}" blocked: ${stopped}`,
      });
      return { run, steps: [], context: trigger.payload, plan: [], deduplicated: false };
    }

    // 2. Trigger condition -----------------------------------------------
    if (definition.trigger.when) {
      const result = evaluateCondition(definition.trigger.when, trigger.payload);
      if (!result.passed) {
        const run = await this.createRun(runId, definition, trigger, correlationId, mode, null, {
          status: "cancelled",
          error: { reason: "Trigger condition not met", trace: result.trace as unknown as JsonValue },
        });
        return { run, steps: [], context: trigger.payload, plan: [...result.trace], deduplicated: false };
      }
    }

    // 3. Idempotency -------------------------------------------------------
    const idempotencyKey = this.idempotencyKey(definition, trigger, options);
    if (idempotencyKey && mode === "live") {
      const existing = await this.deps.store.idempotencyRecords.findFirst({
        where: {
          organizationId: trigger.organizationId,
          scope: `workflow:${definition.key}`,
          key: idempotencyKey,
        },
      });
      if (existing && existing.expiresAt.getTime() > this.clock.epochMillis()) {
        logger.info("workflow run deduplicated", { idempotencyKey });
        const priorRun = existing.resultRef
          ? await this.deps.store.workflowRuns.get(existing.resultRef)
          : null;
        if (priorRun) {
          return {
            run: priorRun,
            steps: await this.stepsFor(priorRun.id),
            context: priorRun.triggerPayload,
            plan: [],
            deduplicated: true,
          };
        }
      }
    }

    // 4. Execute -----------------------------------------------------------
    let run = await this.createRun(runId, definition, trigger, correlationId, mode, idempotencyKey, {
      status: mode === "dry_run" ? "dry_run" : "running",
      startedAt,
    });

    await this.deps.audit.record({
      scope: { organizationId: trigger.organizationId, correlationId },
      ventureId: trigger.ventureId,
      action: AUDIT_ACTIONS.workflowRunStarted,
      entityType: "workflow_run",
      entityId: runId,
      actor: { type: actor.type === "human" ? "human" : actor.type === "agent" ? "agent" : "system", id: actor.id },
      summary: `Started "${definition.name}" (${mode})`,
      after: { workflowKey: definition.key, version: definition.version, mode },
    });

    const context: JsonObject = { trigger: trigger.payload, steps: {} };
    const steps: WorkflowStepRunRecord[] = [];
    const plan: string[] = [];
    const completed: Array<{ step: WorkflowStep; input: JsonObject }> = [];
    let runCostMinor = 0;
    let failure: { stepId: string; error: JsonObject } | null = null;
    let awaitingApproval = false;

    for (const [index, step] of definition.steps.entries()) {
      const stepRunId = newId("wfs", this.clock.epochMillis());

      // Step condition
      if (step.when) {
        const conditionResult = evaluateCondition(step.when, context);
        if (!conditionResult.passed) {
          steps.push(
            await this.createStepRun(stepRunId, runId, trigger.organizationId, step, index, {
              status: "skipped",
              input: {},
              output: { skipped: true, trace: conditionResult.trace as unknown as JsonValue },
            }),
          );
          plan.push(`[${step.id}] skipped — condition not met`);
          continue;
        }
      }

      const input = resolveTemplate(step.input as JsonValue, context) as JsonObject;
      const handler = this.deps.actions.get(step.action);

      // Cost ceiling
      const estimate = step.estimatedCostMinor ?? 0;
      if (definition.maxRunCostMinor > 0 && runCostMinor + estimate > definition.maxRunCostMinor) {
        failure = {
          stepId: step.id,
          error: {
            reason: `Run cost ceiling reached: ${runCostMinor} + ${estimate} > ${definition.maxRunCostMinor} minor units.`,
          },
        };
        steps.push(
          await this.createStepRun(stepRunId, runId, trigger.organizationId, step, index, {
            status: "failed",
            input,
            error: failure.error,
          }),
        );
        break;
      }

      // Approval gate
      const gate = this.deps.approvals.gate({
        organizationId: trigger.organizationId,
        ventureId: trigger.ventureId,
        actionKind: step.actionKind,
        grantedLevel: definition.autonomyLevel,
        reversible: step.reversible,
      });

      if (gate.outcome === "denied") {
        failure = { stepId: step.id, error: { reason: gate.reason, riskClass: gate.riskClass } };
        steps.push(
          await this.createStepRun(stepRunId, runId, trigger.organizationId, step, index, {
            status: "denied",
            input,
            error: failure.error,
          }),
        );
        break;
      }

      if (gate.outcome === "needs_approval" && mode === "live") {
        const approval = await this.deps.approvals.request(
          {
            organizationId: trigger.organizationId,
            ventureId: trigger.ventureId,
            actionKind: step.actionKind,
            title: `${definition.name}: ${step.name}`,
            summary: handler.describe(input, this.actionContext(runId, step, trigger, correlationId, mode, context)),
            reason: gate.reason,
            evidence: { workflowKey: definition.key, stepId: step.id, runContext: context },
            reversible: step.reversible ?? true,
            requestedBy: definition.key,
            requestedByType: "workflow",
            workflowRunId: runId,
            payload: { stepId: step.id, action: step.action, input },
          },
          { type: "workflow", id: definition.key },
        );
        steps.push(
          await this.createStepRun(stepRunId, runId, trigger.organizationId, step, index, {
            status: "awaiting_approval",
            input,
            approvalId: approval.id,
          }),
        );
        plan.push(`[${step.id}] awaiting approval ${approval.id} — ${gate.reason}`);
        awaitingApproval = true;
        break;
      }

      // Dry run stops here: describe, never execute.
      if (mode === "dry_run") {
        const description = handler.describe(
          input,
          this.actionContext(runId, step, trigger, correlationId, mode, context),
        );
        plan.push(`[${step.id}] would ${description}`);
        steps.push(
          await this.createStepRun(stepRunId, runId, trigger.organizationId, step, index, {
            status: "succeeded",
            input,
            output: { dryRun: true, wouldDo: description },
          }),
        );
        continue;
      }

      // Execute with retries
      const maxRetries = step.maxRetries ?? 1;
      let attempts = 0;
      let result: ActionResult | null = null;
      let lastError: JsonObject | null = null;

      while (attempts <= maxRetries) {
        attempts++;
        try {
          result = await handler.execute(
            input,
            this.actionContext(runId, step, trigger, correlationId, mode, context),
          );
          break;
        } catch (error) {
          const appError = toAppError(error);
          lastError = appError.toJSON() as JsonObject;
          logger.warn("workflow step failed", { stepId: step.id, attempts, error: appError.message });
          if (!appError.retryable || attempts > maxRetries) break;
        }
      }

      if (!result) {
        const stepRun = await this.createStepRun(stepRunId, runId, trigger.organizationId, step, index, {
          status: "failed",
          input,
          error: lastError ?? { reason: "unknown failure" },
          attempts,
        });
        steps.push(stepRun);

        const onFailure = step.onFailure ?? "stop";
        if (onFailure === "continue") {
          plan.push(`[${step.id}] failed, continuing (onFailure=continue)`);
          continue;
        }
        if (onFailure === "queue") {
          await this.enqueueRetry(definition, trigger, runId, step.id);
          plan.push(`[${step.id}] failed, queued for retry`);
        }
        failure = { stepId: step.id, error: lastError ?? { reason: "unknown failure" } };
        break;
      }

      const stepCost = result.cost?.amountMinor ?? 0;
      runCostMinor += stepCost;
      context["steps"] = { ...(context["steps"] as JsonObject), [step.id]: result.output };

      steps.push(
        await this.createStepRun(stepRunId, runId, trigger.organizationId, step, index, {
          status: "succeeded",
          input,
          output: result.output,
          costMinor: stepCost,
          attempts,
        }),
      );
      completed.push({ step, input });
      plan.push(`[${step.id}] ${handler.describe(input, this.actionContext(runId, step, trigger, correlationId, mode, context))}`);
    }

    // 5. Compensation ------------------------------------------------------
    if (failure && mode === "live") {
      for (const done of [...completed].reverse()) {
        const compensation = done.step.compensate;
        const ownHandler = this.deps.actions.get(done.step.action);
        // A step-declared compensating action wins; otherwise fall back to the
        // handler's own undo. A step with neither is simply not undoable, and
        // the plan says so rather than implying the world was restored.
        if (!compensation && !ownHandler.compensate) {
          plan.push(`[${done.step.id}] NOT COMPENSATED — no undo is defined for this action`);
          continue;
        }
        try {
          const stepContext = this.actionContext(runId, done.step, trigger, correlationId, mode, context);
          if (compensation) {
            const handler = this.deps.actions.get(compensation.action);
            await handler.execute(
              resolveTemplate(compensation.input as JsonValue, context) as JsonObject,
              stepContext,
            );
          } else {
            await ownHandler.compensate!(done.input, stepContext);
          }
          plan.push(`[${done.step.id}] compensated`);
        } catch (error) {
          logger.error("compensation failed", {
            stepId: done.step.id,
            error: toAppError(error).message,
          });
          plan.push(`[${done.step.id}] COMPENSATION FAILED — needs human attention`);
        }
      }
    }

    // 6. Finish ------------------------------------------------------------
    const status: WorkflowRunRecord["status"] =
      mode === "dry_run"
        ? "dry_run"
        : awaitingApproval
          ? "waiting_approval"
          : failure
            ? "failed"
            : "succeeded";

    run = await this.deps.store.workflowRuns.update(runId, {
      status,
      finishedAt: this.clock.now(),
      costMinor: runCostMinor,
      error: failure ? { stepId: failure.stepId, ...failure.error } : null,
      output: { steps: (context["steps"] as JsonObject) ?? {} },
    });

    if (idempotencyKey && mode === "live" && status === "succeeded") {
      await this.deps.store.idempotencyRecords.create({
        id: newId("idm", this.clock.epochMillis()),
        organizationId: trigger.organizationId,
        key: idempotencyKey,
        scope: `workflow:${definition.key}`,
        resultRef: runId,
        expiresAt: new Date(this.clock.epochMillis() + IDEMPOTENCY_TTL_MS),
      });
    }

    if (runCostMinor > 0 && mode === "live") {
      await this.deps.costs.record({
        organizationId: trigger.organizationId,
        ventureId: trigger.ventureId,
        category: "other",
        amount: money(runCostMinor),
        description: `Workflow run ${definition.key} v${definition.version}`,
        workflowRunId: runId,
      });
    }

    this.deps.metrics.increment(METRICS.workflowRuns, { workflow: definition.key, status });
    if (status === "failed") {
      this.deps.metrics.increment(METRICS.workflowFailures, { workflow: definition.key });
    }
    this.deps.metrics.observe(
      METRICS.workflowLatency,
      this.clock.epochMillis() - startedAt.getTime(),
      { workflow: definition.key },
    );

    await this.deps.audit.record({
      scope: { organizationId: trigger.organizationId, correlationId },
      ventureId: trigger.ventureId,
      action: AUDIT_ACTIONS.workflowRunFinished,
      entityType: "workflow_run",
      entityId: runId,
      actor: { type: "system" },
      summary: `Workflow "${definition.name}" ${status} (${steps.length} steps, ${runCostMinor} minor units)`,
      after: { status, costMinor: runCostMinor, stepCount: steps.length },
    });

    return { run, steps, context, plan, deduplicated: false };
  }

  /** Convenience wrapper: plan a run without side effects (playbook §8 dry-run). */
  async dryRun(
    definition: WorkflowDefinition,
    trigger: TriggerEvent,
  ): Promise<WorkflowRunResult> {
    return this.run(definition, trigger, { mode: "dry_run" });
  }

  private stopReason(
    definition: WorkflowDefinition,
    flagContext: { organizationId: string; ventureId?: string },
  ): string | null {
    if (this.deps.flags.automationStopped(flagContext)) {
      return "Global automation kill switch is engaged.";
    }
    if (!this.deps.flags.isEnabled("feature.workflow_engine", flagContext)) {
      return "The workflow engine feature flag is disabled.";
    }
    if (definition.killSwitchKey && this.deps.flags.isStopped(definition.killSwitchKey, flagContext)) {
      return `Workflow kill switch "${definition.killSwitchKey}" is engaged.`;
    }
    if (definition.status !== "active") {
      return `Workflow is ${definition.status}, not active.`;
    }
    return null;
  }

  private idempotencyKey(
    definition: WorkflowDefinition,
    trigger: TriggerEvent,
    options: RunOptions,
  ): string | null {
    if (options.idempotencyKey) return options.idempotencyKey;
    const path = definition.trigger.idempotencyPath;
    if (!path) return null;
    const value = getPath(trigger.payload, path);
    if (value === undefined || value === null) return null;
    return stableStringify({ v: definition.version, value });
  }

  private actionContext(
    runId: string,
    step: WorkflowStep,
    trigger: TriggerEvent,
    correlationId: string,
    mode: RunMode,
    runContext: JsonObject,
  ): ActionContext {
    return {
      organizationId: trigger.organizationId,
      ventureId: trigger.ventureId,
      workflowRunId: runId,
      stepId: step.id,
      correlationId,
      mode,
      runContext,
    };
  }

  private async createRun(
    runId: string,
    definition: WorkflowDefinition,
    trigger: TriggerEvent,
    correlationId: string,
    mode: RunMode,
    idempotencyKey: string | null,
    fields: Partial<WorkflowRunRecord> & { status: WorkflowRunRecord["status"] },
  ): Promise<WorkflowRunRecord> {
    return this.deps.store.workflowRuns.create({
      id: runId,
      organizationId: trigger.organizationId,
      ventureId: trigger.ventureId,
      workflowKey: definition.key,
      workflowVersion: definition.version,
      status: fields.status,
      mode: mode === "dry_run" ? "dry_run" : mode,
      triggerType: trigger.type,
      triggerPayload: trigger.payload,
      idempotencyKey,
      correlationId,
      startedAt: fields.startedAt ?? this.clock.now(),
      finishedAt: fields.finishedAt ?? null,
      attempt: 1,
      costMinor: 0,
      error: fields.error ?? null,
      output: null,
    });
  }

  private async createStepRun(
    id: string,
    workflowRunId: string,
    organizationId: string,
    step: WorkflowStep,
    index: number,
    fields: {
      status: WorkflowStepRunRecord["status"];
      input: JsonObject;
      output?: JsonObject;
      error?: JsonObject;
      approvalId?: string;
      costMinor?: number;
      attempts?: number;
    },
  ): Promise<WorkflowStepRunRecord> {
    const now = this.clock.now();
    return this.deps.store.workflowStepRuns.create({
      id,
      organizationId,
      workflowRunId,
      stepId: step.id,
      index,
      actionKind: step.actionKind,
      status: fields.status,
      input: fields.input,
      output: fields.output ?? null,
      error: fields.error ?? null,
      approvalId: fields.approvalId ?? null,
      costMinor: fields.costMinor ?? 0,
      startedAt: now,
      finishedAt: now,
      attempts: fields.attempts ?? 1,
    });
  }

  private async stepsFor(workflowRunId: string): Promise<readonly WorkflowStepRunRecord[]> {
    return this.deps.store.workflowStepRuns.all({
      where: { workflowRunId },
      orderBy: { field: "index", direction: "asc" },
    });
  }

  /** Failure queue: a scheduled job the worker picks up. */
  private async enqueueRetry(
    definition: WorkflowDefinition,
    trigger: TriggerEvent,
    runId: string,
    stepId: string,
  ): Promise<void> {
    await this.deps.store.scheduledJobs.create({
      id: newId("evt", this.clock.epochMillis()),
      organizationId: trigger.organizationId,
      ventureId: trigger.ventureId,
      key: `workflow.retry:${definition.key}`,
      cron: null,
      runAt: new Date(this.clock.epochMillis() + 15 * 60_000),
      status: "scheduled",
      payload: {
        workflowKey: definition.key,
        workflowVersion: definition.version,
        failedRunId: runId,
        failedStepId: stepId,
        trigger: trigger.payload,
      },
      attempts: 0,
      lastError: null,
      lockedUntil: null,
    });
  }

  /**
   * Resume a run whose step was approved. The approved payload is replayed
   * verbatim — the engine never re-derives the action from current state,
   * which is what makes the approval meaningful.
   */
  async resumeApprovedStep(approvalId: string): Promise<WorkflowRunResult | null> {
    const approval = await this.deps.approvals.get(approvalId);
    if (!approval || approval.status !== "approved" || !approval.workflowRunId) return null;

    const run = await this.deps.store.workflowRuns.require(approval.workflowRunId);
    const stepRun = (await this.stepsFor(run.id)).find((s) => s.approvalId === approvalId);
    if (!stepRun) return null;

    const payload = approval.payload;
    const handler = this.deps.actions.get(payload["action"] as never);
    const input = (payload["input"] ?? {}) as JsonObject;

    const result = await handler.execute(input, {
      organizationId: run.organizationId,
      ventureId: run.ventureId,
      workflowRunId: run.id,
      stepId: stepRun.stepId,
      correlationId: run.correlationId,
      mode: "live",
      runContext: run.triggerPayload,
    });

    await this.deps.store.workflowStepRuns.update(stepRun.id, {
      status: "succeeded",
      output: result.output,
      costMinor: result.cost?.amountMinor ?? 0,
      finishedAt: this.clock.now(),
    });

    const updated = await this.deps.store.workflowRuns.update(run.id, {
      status: "succeeded",
      finishedAt: this.clock.now(),
    });

    await this.deps.audit.record({
      scope: { organizationId: run.organizationId, correlationId: run.correlationId },
      ventureId: run.ventureId,
      action: AUDIT_ACTIONS.workflowRunFinished,
      entityType: "workflow_run",
      entityId: run.id,
      actor: { type: "system" },
      summary: `Resumed after approval ${approvalId} and completed step "${stepRun.stepId}"`,
    });

    return {
      run: updated,
      steps: await this.stepsFor(run.id),
      context: run.triggerPayload,
      plan: [],
      deduplicated: false,
    };
  }
}

export function assertRunnable(definition: WorkflowDefinition, actions: ActionRegistry): void {
  const missing = definition.steps
    .map((s) => s.action)
    .filter((a) => !actions.has(a));
  if (missing.length > 0) {
    throw errors.notImplemented(
      `Workflow "${definition.key}" uses unregistered actions: ${[...new Set(missing)].join(", ")}`,
    );
  }
}
