import { createHash } from "node:crypto";
import { errors, type JsonObject } from "@holdco/core";

/**
 * Model provider port.
 *
 * Every model call in the platform goes through this interface. Adding a
 * vendor means writing an adapter here, not touching agent code — and the
 * default adapter is a mock that never touches the network and bills zero.
 */
export interface ModelMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonObject;
}

export interface ModelRequest {
  readonly model: string;
  readonly messages: readonly ModelMessage[];
  readonly maxOutputTokens: number;
  readonly temperature?: number;
  readonly tools?: readonly ToolDefinition[];
  readonly timeoutMs: number;
}

export interface ModelToolCall {
  readonly name: string;
  readonly input: JsonObject;
}

export interface ModelResponse {
  readonly text: string;
  readonly toolCalls: readonly ModelToolCall[];
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly stopReason: "end" | "max_tokens" | "tool_use";
}

export interface ModelProvider {
  readonly name: string;
  /** True when calls cost real money. Gated by ALLOW_PAID_PROVIDERS. */
  readonly billable: boolean;
  complete(request: ModelRequest): Promise<ModelResponse>;
}

/** Rough token estimate — 4 characters per token. Used only by the mock. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export interface MockScript {
  /** Matched against the rendered user prompt (case-insensitive substring). */
  readonly when: string;
  readonly respondWith: string;
  readonly toolCalls?: readonly ModelToolCall[];
}

/**
 * Deterministic mock provider.
 *
 * Same input always produces the same output, which makes agent tests
 * meaningful. Its default response is deliberately unhelpful-but-honest: it
 * echoes a structured acknowledgement rather than fabricating a plausible
 * answer, so a test that passes only because the mock invented something
 * convincing cannot exist.
 */
export class MockModelProvider implements ModelProvider {
  readonly name = "mock";
  readonly billable = false;
  private readonly calls: ModelRequest[] = [];

  constructor(private readonly scripts: readonly MockScript[] = []) {}

  get callCount(): number {
    return this.calls.length;
  }

  get lastRequest(): ModelRequest | undefined {
    return this.calls.at(-1);
  }

  async complete(request: ModelRequest): Promise<ModelResponse> {
    this.calls.push(request);
    const prompt = request.messages.map((m) => m.content).join("\n");
    const script = this.scripts.find((s) => prompt.toLowerCase().includes(s.when.toLowerCase()));

    const text =
      script?.respondWith ??
      [
        "MOCK_RESPONSE",
        `digest=${createHash("sha256").update(prompt).digest("hex").slice(0, 12)}`,
        `model=${request.model}`,
        "This is the mock model provider. No inference was performed and no facts were produced.",
      ].join("\n");

    return {
      text,
      toolCalls: script?.toolCalls ?? [],
      inputTokens: estimateTokens(prompt),
      outputTokens: estimateTokens(text),
      stopReason: "end",
    };
  }
}

/**
 * Placeholder adapters for paid vendors.
 *
 * They intentionally throw rather than half-work. Fabricating integration
 * success is explicitly forbidden by the playbook (rule 10), so an unfinished
 * adapter must fail loudly and say exactly what is missing.
 */
export class UnimplementedModelProvider implements ModelProvider {
  readonly billable = true;

  constructor(
    readonly name: string,
    private readonly missing: string,
  ) {}

  async complete(): Promise<ModelResponse> {
    throw errors.providerDisabled(
      `The "${this.name}" model adapter is not implemented. ${this.missing}`,
      { provider: this.name },
    );
  }
}

export interface ProviderSelection {
  provider: "mock" | "anthropic" | "openai";
  allowPaidProviders: boolean;
  scripts?: readonly MockScript[];
}

export function createModelProvider(selection: ProviderSelection): ModelProvider {
  if (selection.provider === "mock") return new MockModelProvider(selection.scripts);

  if (!selection.allowPaidProviders) {
    throw errors.providerDisabled(
      `MODEL_PROVIDER=${selection.provider} requires ALLOW_PAID_PROVIDERS=true. ` +
        `Enabling paid inference is an owner decision.`,
      { provider: selection.provider },
    );
  }

  return new UnimplementedModelProvider(
    selection.provider,
    "Write the adapter in packages/agents/src/provider.ts, add verified pricing to " +
      "MODEL_PRICES in @holdco/cost-accounting, and record the approval before enabling it.",
  );
}
