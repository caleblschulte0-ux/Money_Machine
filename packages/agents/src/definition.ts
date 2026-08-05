import { z } from "zod";
import type { AutonomyLevel, JsonObject } from "@holdco/core";

/**
 * Agent definitions (playbook §7).
 *
 * Every field the playbook requires is mandatory here, enforced by the schema
 * below rather than by convention: name, venture, role, objective, allowed
 * tools, prohibited actions, input/output schemas, prompt version, model
 * config, cost budget, timeout, retries, escalation rules, approval
 * requirements, logging and tests.
 */
export interface AgentModelConfig {
  readonly provider: "mock" | "anthropic" | "openai";
  readonly model: string;
  readonly maxOutputTokens: number;
  readonly temperature?: number;
}

export interface EscalationRule {
  /** Condition key the runner understands. */
  readonly when:
    | "low_confidence"
    | "no_grounding"
    | "budget_exceeded"
    | "timeout"
    | "tool_denied"
    | "output_invalid"
    | "explicit_request";
  readonly action: "escalate_to_human" | "retry" | "fail";
  readonly note: string;
}

export interface AgentDefinition<Input = unknown, Output = unknown> {
  readonly key: string;
  readonly version: number;
  readonly name: string;
  /** `null` = a holding-company agent shared by every venture. */
  readonly ventureKey: string | null;
  readonly role: string;
  readonly objective: string;
  readonly allowedTools: readonly string[];
  /** Action kinds this agent must never take, checked before every tool call. */
  readonly prohibitedActions: readonly string[];
  readonly inputSchema: z.ZodType<Input>;
  readonly outputSchema: z.ZodType<Output>;
  readonly promptKey: string;
  readonly promptVersion: number;
  readonly model: AgentModelConfig;
  /** Hard ceiling per run, in minor units. */
  readonly costBudgetMinor: number;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly autonomyLevel: AutonomyLevel;
  readonly escalationRules: readonly EscalationRule[];
  /** Action kind used when the agent's *output* is applied to the world. */
  readonly appliesActionKind: string | null;
  /** Must be true before the agent can run outside dry-run mode. */
  readonly hasTestSuite: boolean;
  readonly status: "draft" | "active" | "paused" | "archived";
}

export class AgentDefinitionError extends Error {}

export function validateAgentDefinition(definition: AgentDefinition): void {
  const problems: string[] = [];

  if (!/^[a-z][a-z0-9_.-]{2,60}$/.test(definition.key)) {
    problems.push(`key "${definition.key}" must be lowercase and dotted/hyphenated`);
  }
  if (definition.objective.trim().length < 20) {
    problems.push("objective must describe what success looks like (20+ characters)");
  }
  if (definition.costBudgetMinor <= 0) {
    problems.push("costBudgetMinor must be positive — an agent with no budget cap can bankrupt a venture");
  }
  if (definition.timeoutMs <= 0 || definition.timeoutMs > 15 * 60_000) {
    problems.push("timeoutMs must be between 1ms and 15 minutes");
  }
  if (definition.maxRetries < 0 || definition.maxRetries > 5) {
    problems.push("maxRetries must be between 0 and 5");
  }
  if (definition.escalationRules.length === 0) {
    problems.push("at least one escalation rule is required — an agent with nowhere to escalate hides failures");
  }
  if (definition.autonomyLevel >= 3 && !definition.hasTestSuite) {
    problems.push(
      "autonomyLevel 3+ requires hasTestSuite=true; unattended execution without tests is not permitted",
    );
  }
  const overlap = definition.allowedTools.filter((t) => definition.prohibitedActions.includes(t));
  if (overlap.length > 0) {
    problems.push(`tools are both allowed and prohibited: ${overlap.join(", ")}`);
  }

  if (problems.length > 0) {
    throw new AgentDefinitionError(
      `Invalid agent definition "${definition.key}":\n${problems.map((p) => `  - ${p}`).join("\n")}`,
    );
  }
}

export class AgentRegistry {
  private readonly agents = new Map<string, AgentDefinition<never, never>>();

  register<I, O>(definition: AgentDefinition<I, O>): void {
    validateAgentDefinition(definition as AgentDefinition);
    const existing = this.agents.get(definition.key);
    if (existing && existing.version >= definition.version) {
      throw new AgentDefinitionError(
        `Agent "${definition.key}" v${definition.version} does not supersede the registered v${existing.version}.`,
      );
    }
    this.agents.set(definition.key, definition as unknown as AgentDefinition<never, never>);
  }

  get(key: string): AgentDefinition<never, never> {
    const found = this.agents.get(key);
    if (!found) throw new AgentDefinitionError(`Unknown agent "${key}"`);
    return found;
  }

  has(key: string): boolean {
    return this.agents.has(key);
  }

  list(ventureKey?: string | null): readonly AgentDefinition<never, never>[] {
    const all = [...this.agents.values()];
    if (ventureKey === undefined) return all;
    return all.filter((a) => a.ventureKey === ventureKey || a.ventureKey === null);
  }
}

export function agentDefinitionToJson(definition: AgentDefinition): JsonObject {
  return {
    key: definition.key,
    version: definition.version,
    name: definition.name,
    ventureKey: definition.ventureKey,
    role: definition.role,
    objective: definition.objective,
    allowedTools: [...definition.allowedTools],
    prohibitedActions: [...definition.prohibitedActions],
    promptKey: definition.promptKey,
    promptVersion: definition.promptVersion,
    model: { ...definition.model },
    costBudgetMinor: definition.costBudgetMinor,
    timeoutMs: definition.timeoutMs,
    maxRetries: definition.maxRetries,
    autonomyLevel: definition.autonomyLevel,
    escalationRules: definition.escalationRules.map((r) => ({ ...r })),
    appliesActionKind: definition.appliesActionKind,
    hasTestSuite: definition.hasTestSuite,
    status: definition.status,
  };
}
