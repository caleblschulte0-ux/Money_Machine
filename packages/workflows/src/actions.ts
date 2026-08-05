import { errors, money, type JsonObject, type Money } from "@holdco/core";
import type { ActionType } from "./definition.ts";

/**
 * Action handlers.
 *
 * The engine knows nothing about email, documents or agents — it knows how to
 * decide *whether* an action may run and how to record what happened. What an
 * action actually does is supplied by the composition root, which is what lets
 * every action be swapped for a mock in tests and in dry-run mode.
 */
export interface ActionContext {
  readonly organizationId: string;
  readonly ventureId: string | null;
  readonly workflowRunId: string;
  readonly stepId: string;
  readonly correlationId: string;
  readonly mode: "live" | "dry_run" | "mock";
  /** Accumulated run context: trigger payload plus prior step outputs. */
  readonly runContext: JsonObject;
}

export interface ActionResult {
  readonly output: JsonObject;
  /** Actual cost incurred, if any. */
  readonly cost?: Money;
  /** Set when the action produced something a human should look at. */
  readonly needsReview?: boolean;
}

export interface ActionHandler {
  readonly type: ActionType;
  /** What this action would do, rendered in dry-run output. */
  describe(input: JsonObject, context: ActionContext): string;
  execute(input: JsonObject, context: ActionContext): Promise<ActionResult>;
  /** Undo, where undo is possible. Absent means the action is irreversible. */
  compensate?(input: JsonObject, context: ActionContext): Promise<void>;
}

export class ActionRegistry {
  private readonly handlers = new Map<ActionType, ActionHandler>();

  register(handler: ActionHandler): void {
    if (this.handlers.has(handler.type)) {
      throw new Error(`Action handler for "${handler.type}" is already registered.`);
    }
    this.handlers.set(handler.type, handler);
  }

  get(type: ActionType): ActionHandler {
    const handler = this.handlers.get(type);
    if (!handler) {
      throw errors.notImplemented(
        `Action "${type}" has no registered handler. Register one in the composition root ` +
          `before publishing a workflow that uses it`,
      );
    }
    return handler;
  }

  has(type: ActionType): boolean {
    return this.handlers.has(type);
  }

  list(): readonly ActionType[] {
    return [...this.handlers.keys()];
  }
}

/**
 * A handler that records what it *would* have done without doing it.
 *
 * Used for dry runs and for actions whose real implementation is not built
 * yet. It returns `simulated: true` in its output so that no downstream code
 * or report can mistake a simulation for a real effect.
 */
export function simulatedHandler(type: ActionType, note: string): ActionHandler {
  return {
    type,
    describe: (input) => `${type} (simulated): ${note} ${JSON.stringify(input)}`,
    async execute(input, context): Promise<ActionResult> {
      return {
        output: {
          simulated: true,
          action: type,
          note,
          mode: context.mode,
          input,
        },
        cost: money(0),
      };
    },
  };
}
