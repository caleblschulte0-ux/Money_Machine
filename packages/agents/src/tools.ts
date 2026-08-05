import { errors, riskClassFor, type JsonObject } from "@holdco/core";
import type { ToolDefinition } from "./provider.ts";

/**
 * Agent tools.
 *
 * Two guarantees this module provides:
 *  1. An agent can only call tools on its allow-list, checked at call time and
 *     not merely declared to the model.
 *  2. Every tool declares the action kind it performs, so the autonomy policy
 *     and approval gate apply to tool calls the same way they apply to
 *     workflow steps.
 */
export interface ToolContext {
  readonly organizationId: string;
  readonly ventureId: string | null;
  readonly agentRunId: string;
  readonly correlationId: string;
}

export interface Tool<Input = JsonObject, Output = JsonObject> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonObject;
  /** The action kind used for risk classification. */
  readonly actionKind: string;
  /** True when the tool only reads. Read-only tools skip the approval gate. */
  readonly readOnly: boolean;
  execute(input: Input, context: ToolContext): Promise<Output>;
}

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered.`);
    }
    if (!tool.readOnly && riskClassFor(tool.actionKind) === "prohibited") {
      throw new Error(
        `Tool "${tool.name}" performs a prohibited action kind "${tool.actionKind}" and cannot be registered.`,
      );
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool {
    const tool = this.tools.get(name);
    if (!tool) throw errors.notFound("tool", name);
    return tool;
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  /** Definitions handed to the model — only the agent's allowed tools. */
  definitionsFor(allowed: readonly string[]): readonly ToolDefinition[] {
    return allowed
      .filter((name) => this.tools.has(name))
      .map((name) => {
        const tool = this.tools.get(name)!;
        return {
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        };
      });
  }

  list(): readonly Tool[] {
    return [...this.tools.values()];
  }
}

export interface ToolCallCheck {
  toolName: string;
  allowedTools: readonly string[];
  prohibitedActions: readonly string[];
}

/**
 * Enforce the allow-list. Called before every tool execution — a model that
 * asks for a tool it was never given is a signal worth logging, not a request
 * to satisfy.
 */
export function assertToolPermitted(registry: ToolRegistry, check: ToolCallCheck): Tool {
  if (!check.allowedTools.includes(check.toolName)) {
    throw errors.forbidden(
      `Agent attempted to call tool "${check.toolName}", which is not on its allow-list.`,
      { toolName: check.toolName, allowedTools: [...check.allowedTools] },
    );
  }
  const tool = registry.get(check.toolName);
  if (check.prohibitedActions.includes(tool.actionKind) || check.prohibitedActions.includes(tool.name)) {
    throw errors.policyViolation(
      `Tool "${tool.name}" performs action "${tool.actionKind}", which this agent is prohibited from taking.`,
      { toolName: tool.name, actionKind: tool.actionKind },
    );
  }
  return tool;
}
