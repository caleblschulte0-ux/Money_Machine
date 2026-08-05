import { z } from "zod";
import type { AutonomyLevel, JsonObject, JsonValue } from "@holdco/core";
import type { Condition } from "./conditions.ts";

/**
 * Workflow definitions (playbook §8).
 *
 * A definition is immutable data. Publishing a change means publishing a new
 * version; a run always records the exact version it executed, so "why did it
 * do that in March" is answerable.
 */
export const TRIGGER_TYPES = [
  "lead.created",
  "form.submitted",
  "email.received",
  "call.completed",
  "payment.succeeded",
  "payment.failed",
  "contract.signed",
  "task.overdue",
  "customer.inactive",
  "content.approved",
  "traffic.threshold_reached",
  "ranking.changed",
  "ai_mention.changed",
  "lead.score_changed",
  "support_case.opened",
  "file.uploaded",
  "schedule",
  "webhook.received",
  "database.condition_met",
  "manual",
] as const;

export type TriggerType = (typeof TRIGGER_TYPES)[number];

export const ACTION_TYPES = [
  "task.create",
  "email.send",
  "sms.send",
  "call.start",
  "document.generate",
  "agent.run",
  "record.update",
  "record.tag",
  "invoice.create",
  "followup.schedule",
  "approval.request",
  "human.notify",
  "content.publish",
  "file.export",
  "webhook.trigger",
  "campaign.pause",
  "case.escalate",
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

export interface WorkflowStep {
  readonly id: string;
  readonly name: string;
  readonly action: ActionType;
  /** Risk classification key from @holdco/core ACTION_RISK. */
  readonly actionKind: string;
  /** Only runs when this evaluates true against the run context. */
  readonly when?: Condition;
  /** Action input; `{{path}}` references are resolved against the run context. */
  readonly input: JsonObject;
  readonly maxRetries?: number;
  /** What to do when the step fails after retries. */
  readonly onFailure?: "stop" | "continue" | "queue";
  /** Estimated cost of this step, used for pre-flight budget checks. */
  readonly estimatedCostMinor?: number;
  /** Set false when the step cannot be undone; caps effective autonomy at 2. */
  readonly reversible?: boolean;
  /** Optional compensating step run when a later step fails. */
  readonly compensate?: { readonly action: ActionType; readonly input: JsonObject };
}

export interface WorkflowTrigger {
  readonly type: TriggerType;
  /** Runs only when the trigger payload satisfies this. */
  readonly when?: Condition;
  /** For `schedule` triggers. */
  readonly cron?: string;
  /**
   * Dotted path into the trigger payload used to build the idempotency key.
   * Without one, replays of the same event run the workflow twice.
   */
  readonly idempotencyPath?: string;
}

export interface WorkflowDefinition {
  readonly key: string;
  readonly version: number;
  readonly name: string;
  readonly description: string;
  readonly ventureKey: string | null;
  readonly trigger: WorkflowTrigger;
  readonly steps: readonly WorkflowStep[];
  readonly autonomyLevel: AutonomyLevel;
  /** Hard ceiling for one run. The run aborts rather than exceeding it. */
  readonly maxRunCostMinor: number;
  /** Additional kill switch beyond the global ones. */
  readonly killSwitchKey?: string;
  readonly status: "draft" | "active" | "paused" | "archived";
  /** Permission a human needs to trigger this manually. */
  readonly requiredPermission?: string;
}

export class WorkflowDefinitionError extends Error {}

export function validateWorkflow(definition: WorkflowDefinition): void {
  const problems: string[] = [];

  if (!/^[a-z][a-z0-9_.-]{2,60}$/.test(definition.key)) {
    problems.push(`key "${definition.key}" must be lowercase and dotted/hyphenated`);
  }
  if (definition.steps.length === 0) problems.push("a workflow must have at least one step");
  if (definition.maxRunCostMinor < 0) problems.push("maxRunCostMinor must not be negative");

  const ids = new Set<string>();
  for (const step of definition.steps) {
    if (ids.has(step.id)) problems.push(`duplicate step id "${step.id}"`);
    ids.add(step.id);
    if (!step.actionKind) problems.push(`step "${step.id}" must declare an actionKind for risk classification`);
  }

  const estimated = definition.steps.reduce((sum, s) => sum + (s.estimatedCostMinor ?? 0), 0);
  if (definition.maxRunCostMinor > 0 && estimated > definition.maxRunCostMinor) {
    problems.push(
      `estimated step cost (${estimated}) exceeds maxRunCostMinor (${definition.maxRunCostMinor}); ` +
        `this workflow could never complete`,
    );
  }

  if (definition.status === "active" && definition.autonomyLevel >= 3 && !definition.trigger.idempotencyPath) {
    problems.push(
      "workflows at autonomy level 3+ must declare trigger.idempotencyPath; " +
        "unattended execution without idempotency duplicates work on every replay",
    );
  }

  if (problems.length > 0) {
    throw new WorkflowDefinitionError(
      `Invalid workflow "${definition.key}" v${definition.version}:\n${problems.map((p) => `  - ${p}`).join("\n")}`,
    );
  }
}

export class WorkflowRegistry {
  private readonly workflows = new Map<string, WorkflowDefinition[]>();

  register(definition: WorkflowDefinition): void {
    validateWorkflow(definition);
    const versions = this.workflows.get(definition.key) ?? [];
    if (versions.some((v) => v.version === definition.version)) {
      throw new WorkflowDefinitionError(
        `Workflow "${definition.key}" v${definition.version} is already registered. Definitions are immutable.`,
      );
    }
    versions.push(definition);
    versions.sort((a, b) => a.version - b.version);
    this.workflows.set(definition.key, versions);
  }

  get(key: string, version?: number): WorkflowDefinition {
    const versions = this.workflows.get(key);
    if (!versions?.length) throw new WorkflowDefinitionError(`Unknown workflow "${key}"`);
    if (version === undefined) {
      const active = [...versions].reverse().find((v) => v.status === "active");
      return active ?? versions.at(-1)!;
    }
    const found = versions.find((v) => v.version === version);
    if (!found) throw new WorkflowDefinitionError(`Workflow "${key}" has no version ${version}`);
    return found;
  }

  has(key: string): boolean {
    return this.workflows.has(key);
  }

  list(ventureKey?: string | null): readonly WorkflowDefinition[] {
    const latest = [...this.workflows.values()].map((versions) => versions.at(-1)!);
    if (ventureKey === undefined) return latest;
    return latest.filter((w) => w.ventureKey === ventureKey || w.ventureKey === null);
  }

  /** Workflows listening for a trigger type, for the dispatcher. */
  byTrigger(type: string): readonly WorkflowDefinition[] {
    return this.list().filter((w) => w.trigger.type === type && w.status === "active");
  }
}

export function workflowToJson(definition: WorkflowDefinition): JsonObject {
  return JSON.parse(JSON.stringify(definition)) as JsonObject;
}

export const workflowStepSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  action: z.enum(ACTION_TYPES),
  actionKind: z.string().min(1),
  input: z.record(z.string(), z.unknown()),
  maxRetries: z.number().int().min(0).max(5).optional(),
  onFailure: z.enum(["stop", "continue", "queue"]).optional(),
  estimatedCostMinor: z.number().int().min(0).optional(),
  reversible: z.boolean().optional(),
});

export type { JsonValue };
