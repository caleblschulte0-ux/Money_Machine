import {
  errors,
  money,
  newCorrelationId,
  newId,
  systemClock,
  toAppError,
  type Clock,
  type JsonObject,
  type JsonValue,
  type Result,
} from "@holdco/core";
import { err, ok } from "@holdco/core";
import type { AgentRunRecord, Store } from "@holdco/database";
import type { FlagRegistry } from "@holdco/config";
import { AUDIT_ACTIONS, AuditLog } from "@holdco/audit";
import { CostLedger, costOfUsage, isPriceVerified } from "@holdco/cost-accounting";
import { ApprovalService } from "@holdco/approvals";
import { KnowledgeBase } from "@holdco/knowledge";
import { PromptRegistry, promptHash, renderPrompt, type PromptVariables } from "@holdco/prompts";
import { METRICS, type Logger, type MetricsRegistry } from "@holdco/observability";
import type { AgentDefinition } from "./definition.ts";
import { assertToolPermitted, ToolRegistry, type ToolContext } from "./tools.ts";
import type { ModelProvider, ModelToolCall } from "./provider.ts";

export interface AgentRunContext {
  organizationId: string;
  ventureId: string | null;
  correlationId?: string;
  workflowRunId?: string | null;
  /** Customer this run is on behalf of, for cost attribution. */
  customerAccountId?: string | null;
  /** Overrides the definition's mode; dry runs never call a billable provider. */
  mode?: "live" | "mock";
}

export interface AgentRunOutcome<Output> {
  readonly runId: string;
  readonly output: Output;
  readonly costMinor: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly citations: readonly string[];
  readonly toolCalls: readonly ModelToolCall[];
}

export interface AgentRunFailure {
  readonly runId: string;
  readonly status: AgentRunRecord["status"];
  readonly reason: string;
  readonly approvalId?: string;
}

export interface AgentRunnerDeps {
  store: Store;
  audit: AuditLog;
  costs: CostLedger;
  approvals: ApprovalService;
  prompts: PromptRegistry;
  knowledge: KnowledgeBase;
  tools: ToolRegistry;
  provider: ModelProvider;
  flags: FlagRegistry;
  logger: Logger;
  metrics: MetricsRegistry;
  clock?: Clock;
  allowPaidProviders: boolean;
}

/**
 * The agent runner.
 *
 * Order of checks before any inference happens:
 *   1. kill switches (global automation, agent spend)
 *   2. feature flag
 *   3. agent status and test-suite requirement
 *   4. input schema
 *   5. budget — both the agent's per-run cap and the venture's monthly budget
 *   6. provider billability against ALLOW_PAID_PROVIDERS
 *
 * Nothing is charged, sent or written before all six pass.
 */
export class AgentRunner {
  private readonly clock: Clock;

  constructor(private readonly deps: AgentRunnerDeps) {
    this.clock = deps.clock ?? systemClock;
  }

  async run<I, O>(
    definition: AgentDefinition<I, O>,
    input: I,
    context: AgentRunContext,
    options: { knowledgeQuery?: string; promptVariables?: PromptVariables } = {},
  ): Promise<Result<AgentRunOutcome<O>, AgentRunFailure>> {
    const correlationId = context.correlationId ?? newCorrelationId();
    const startedAt = this.clock.now();
    const runId = newId("agr", startedAt.getTime());
    const flagContext = {
      organizationId: context.organizationId,
      ventureId: context.ventureId ?? undefined,
    };
    const logger = this.deps.logger.child({
      agentKey: definition.key,
      agentRunId: runId,
      correlationId,
      ventureId: context.ventureId,
    });

    const bail = async (
      status: AgentRunRecord["status"],
      reason: string,
      extra: { approvalId?: string } = {},
    ): Promise<Result<AgentRunOutcome<O>, AgentRunFailure>> => {
      logger.warn("agent run refused", { status, reason });
      this.deps.metrics.increment(METRICS.agentFailures, {
        agent: definition.key,
        status,
      });
      await this.persistRun(runId, definition, context, correlationId, startedAt, {
        status,
        error: { reason, ...(extra.approvalId ? { approvalId: extra.approvalId } : {}) },
        input: input as unknown as JsonObject,
      });
      return err({ runId, status, reason, ...extra });
    };

    // 1. Kill switches
    if (this.deps.flags.automationStopped(flagContext)) {
      return bail("denied", "Global automation kill switch is engaged.");
    }
    if (this.deps.flags.isStopped("killswitch.agent_spend", flagContext)) {
      return bail("denied", "Agent spend kill switch is engaged.");
    }

    // 2. Feature flag
    if (!this.deps.flags.isEnabled("feature.agent_runner", flagContext)) {
      return bail("denied", "The agent runner feature flag is disabled.");
    }

    // 3. Definition status
    if (definition.status !== "active") {
      return bail("denied", `Agent "${definition.key}" is ${definition.status}, not active.`);
    }
    const mode = context.mode ?? (this.deps.provider.billable ? "live" : "mock");
    if (mode === "live" && !definition.hasTestSuite) {
      return bail("denied", `Agent "${definition.key}" has no test suite and may not run live.`);
    }

    // 4. Input validation
    const parsedInput = definition.inputSchema.safeParse(input);
    if (!parsedInput.success) {
      return bail(
        "failed",
        `Input failed validation: ${parsedInput.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      );
    }

    // 5. Provider billability
    if (this.deps.provider.billable && !this.deps.allowPaidProviders) {
      return bail("denied", "Provider is billable but paid providers are not enabled.");
    }
    // The definition names the provider it was written and priced for. If the
    // injected provider differs, cost accounting would bill against the wrong
    // rate card — refuse rather than mis-attribute spend.
    if (this.deps.provider.name !== definition.model.provider) {
      return bail(
        "denied",
        `Agent "${definition.key}" declares provider "${definition.model.provider}" but the runner was ` +
          `given "${this.deps.provider.name}". Refusing to run against a provider this agent was not priced for.`,
      );
    }
    if (this.deps.provider.billable && !isPriceVerified(this.deps.provider.name, definition.model.model)) {
      return bail(
        "denied",
        `No human-verified price exists for ${this.deps.provider.name}/${definition.model.model}. ` +
          `Refusing to spend against an unknown rate.`,
      );
    }

    // 6. Budget
    const estimated = money(Math.min(definition.costBudgetMinor, 100));
    const spendCheck = await this.deps.costs.checkSpend({
      organizationId: context.organizationId,
      ventureId: context.ventureId,
      category: "ai_inference",
      estimated,
    });
    if (!spendCheck.allowed) {
      // A blocked budget is worth a human's attention, so queue it rather than
      // failing silently into a retry loop.
      const approval = await this.deps.approvals.request(
        {
          organizationId: context.organizationId,
          ventureId: context.ventureId,
          actionKind: "agent.run",
          title: `Budget exceeded: ${definition.name}`,
          summary: spendCheck.reason,
          reason: "The AI inference budget for this period is exhausted.",
          evidence: {
            agentKey: definition.key,
            spentMinor: spendCheck.status.spent.amountMinor,
            limitMinor: spendCheck.status.limit.amountMinor,
          },
          financialImpact: estimated,
          requestedBy: definition.key,
          requestedByType: "agent",
          payload: { agentKey: definition.key, input: parsedInput.data as JsonValue },
        },
        { type: "agent", id: definition.key },
      );
      return bail("budget_exceeded", spendCheck.reason, { approvalId: approval.id });
    }

    // --- Execute --------------------------------------------------------
    const prompt = this.deps.prompts.get(definition.promptKey, definition.promptVersion);

    let knowledgeText = "";
    let citations: readonly string[] = [];
    if (options.knowledgeQuery) {
      const context_ = await this.deps.knowledge.contextFor(options.knowledgeQuery, {
        organizationId: context.organizationId,
        ventureId: context.ventureId,
        accountId: context.customerAccountId ?? null,
      });
      knowledgeText = context_.text;
      citations = context_.citations;
    }

    const variables: PromptVariables = {
      ...(options.promptVariables ?? {}),
      ...(knowledgeText ? { knowledge: knowledgeText } : {}),
    };

    let rendered: string;
    try {
      rendered = renderPrompt(prompt, variables);
    } catch (error) {
      return bail("failed", `Prompt rendering failed: ${toAppError(error).message}`);
    }

    const toolCalls: ModelToolCall[] = [];
    let inputTokens = 0;
    let outputTokens = 0;
    let costMinor = 0;
    let attempt = 0;
    let lastError: string | null = null;

    while (attempt <= definition.maxRetries) {
      attempt++;
      try {
        const response = await this.withTimeout(
          this.deps.provider.complete({
            model: definition.model.model,
            messages: [
              { role: "system", content: prompt.system },
              { role: "user", content: rendered },
            ],
            maxOutputTokens: definition.model.maxOutputTokens,
            temperature: definition.model.temperature,
            tools: this.deps.tools.definitionsFor(definition.allowedTools),
            timeoutMs: definition.timeoutMs,
          }),
          definition.timeoutMs,
        );

        inputTokens += response.inputTokens;
        outputTokens += response.outputTokens;
        costMinor += costOfUsage(this.deps.provider.name, definition.model.model, {
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
        }).amountMinor;

        if (costMinor > definition.costBudgetMinor) {
          return bail(
            "budget_exceeded",
            `Run cost ${costMinor} minor units exceeded the agent's per-run budget of ${definition.costBudgetMinor}.`,
          );
        }

        // Tool calls
        const toolContext: ToolContext = {
          organizationId: context.organizationId,
          ventureId: context.ventureId,
          agentRunId: runId,
          correlationId,
        };
        for (const call of response.toolCalls) {
          const tool = assertToolPermitted(this.deps.tools, {
            toolName: call.name,
            allowedTools: definition.allowedTools,
            prohibitedActions: definition.prohibitedActions,
          });
          if (!tool.readOnly) {
            const gate = this.deps.approvals.gate({
              organizationId: context.organizationId,
              ventureId: context.ventureId,
              actionKind: tool.actionKind,
              grantedLevel: definition.autonomyLevel,
            });
            if (gate.outcome !== "execute") {
              return bail("escalated", `Tool "${tool.name}" requires human approval: ${gate.reason}`);
            }
          }
          await tool.execute(call.input, toolContext);
          toolCalls.push(call);
        }

        const parsedOutput = definition.outputSchema.safeParse(
          this.coerceOutput(response.text),
        );
        if (!parsedOutput.success) {
          lastError = `Output failed validation: ${parsedOutput.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")}`;
          if (attempt <= definition.maxRetries) continue;
          const rule = definition.escalationRules.find((r) => r.when === "output_invalid");
          if (rule?.action === "escalate_to_human") {
            return bail("escalated", lastError);
          }
          return bail("failed", lastError);
        }

        // Record cost against every attribution dimension we know.
        if (costMinor > 0) {
          await this.deps.costs.record({
            organizationId: context.organizationId,
            ventureId: context.ventureId,
            category: "ai_inference",
            amount: money(costMinor),
            description: `Agent run ${definition.key} v${definition.version}`,
            customerAccountId: context.customerAccountId ?? null,
            agentRunId: runId,
            workflowRunId: context.workflowRunId ?? null,
            vendorName: this.deps.provider.name,
            metadata: { promptHash: promptHash(prompt.system, rendered) },
          });
        }

        await this.persistRun(runId, definition, context, correlationId, startedAt, {
          status: "succeeded",
          input: parsedInput.data as unknown as JsonObject,
          output: parsedOutput.data as unknown as JsonObject,
          inputTokens,
          outputTokens,
          costMinor,
          toolCalls: toolCalls as unknown as JsonValue[],
        });

        this.deps.metrics.increment(METRICS.agentRuns, { agent: definition.key, status: "succeeded" });
        this.deps.metrics.increment(METRICS.agentTokens, { agent: definition.key }, inputTokens + outputTokens);
        this.deps.metrics.increment(METRICS.agentCostMinor, { agent: definition.key }, costMinor);
        this.deps.metrics.observe(METRICS.agentLatency, this.clock.epochMillis() - startedAt.getTime(), {
          agent: definition.key,
        });

        await this.deps.audit.record({
          scope: { organizationId: context.organizationId, correlationId },
          ventureId: context.ventureId,
          action: AUDIT_ACTIONS.agentRunFinished,
          entityType: "agent_run",
          entityId: runId,
          actor: { type: "agent", id: definition.key, label: definition.name },
          summary: `Agent "${definition.name}" completed (cost ${costMinor} minor units, ${citations.length} citations)`,
          after: { costMinor, inputTokens, outputTokens, citations: [...citations] },
        });

        return ok({
          runId,
          output: parsedOutput.data,
          costMinor,
          inputTokens,
          outputTokens,
          citations,
          toolCalls,
        });
      } catch (error) {
        const appError = toAppError(error);
        lastError = appError.message;
        logger.warn("agent attempt failed", { attempt, error: appError.message });
        if (appError.code === "forbidden" || appError.code === "policy_violation") {
          return bail("denied", appError.message);
        }
        if (!appError.retryable || attempt > definition.maxRetries) break;
      }
    }

    const timedOut = lastError?.toLowerCase().includes("timed out") ?? false;
    return bail(timedOut ? "timeout" : "failed", lastError ?? "Agent run failed for an unknown reason");
  }

  private coerceOutput(text: string): unknown {
    const trimmed = text.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // fall through — the schema will reject it with a useful message
      }
    }
    return { text: trimmed };
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(errors.timeout(`Agent call timed out after ${timeoutMs}ms`)),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async persistRun(
    runId: string,
    definition: AgentDefinition<never, never> | AgentDefinition<unknown, unknown>,
    context: AgentRunContext,
    correlationId: string,
    startedAt: Date,
    fields: {
      status: AgentRunRecord["status"];
      input?: JsonObject;
      output?: JsonObject;
      error?: JsonObject;
      inputTokens?: number;
      outputTokens?: number;
      costMinor?: number;
      toolCalls?: JsonValue[];
    },
  ): Promise<void> {
    await this.deps.store.agentRuns.create({
      id: runId,
      organizationId: context.organizationId,
      ventureId: context.ventureId,
      agentKey: definition.key,
      agentVersion: definition.version,
      status: fields.status,
      mode: context.mode ?? (this.deps.provider.billable ? "live" : "mock"),
      input: fields.input ?? {},
      output: fields.output ?? null,
      error: fields.error ?? null,
      provider: this.deps.provider.name,
      model: definition.model.model,
      promptKey: definition.promptKey,
      promptVersion: definition.promptVersion,
      inputTokens: fields.inputTokens ?? 0,
      outputTokens: fields.outputTokens ?? 0,
      costMinor: fields.costMinor ?? 0,
      latencyMs: this.clock.epochMillis() - startedAt.getTime(),
      toolCalls: fields.toolCalls ?? [],
      escalationReason: fields.status === "escalated" ? String(fields.error?.["reason"] ?? "") : null,
      workflowRunId: context.workflowRunId ?? null,
      correlationId,
      startedAt,
      finishedAt: this.clock.now(),
      qualityScore: null,
      reviewedByUserId: null,
    });
  }
}
