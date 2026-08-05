import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { money, usd, type FixedClock } from "@holdco/core";
import { FlagRegistry } from "@holdco/config";
import { AuditLog } from "@holdco/audit";
import { ApprovalService } from "@holdco/approvals";
import { CostLedger } from "@holdco/cost-accounting";
import { KnowledgeBase } from "@holdco/knowledge";
import { createPlatformPromptRegistry } from "@holdco/prompts";
import { MemorySink, MetricsRegistry, createLogger } from "@holdco/observability";
import { seedOrganization, seedVenture, testClock, testStore } from "@holdco/testing";
import type { Store } from "@holdco/database";
import { AgentRunner } from "./runner.ts";
import { MockModelProvider, UnimplementedModelProvider, type ModelProvider } from "./provider.ts";
import { ToolRegistry, type Tool } from "./tools.ts";
import type { AgentDefinition } from "./definition.ts";
import { RESEARCH_AGENT } from "./platform-agents.ts";

interface Harness {
  runner: AgentRunner;
  store: Store;
  flags: FlagRegistry;
  costs: CostLedger;
  clock: FixedClock;
  provider: ModelProvider;
  tools: ToolRegistry;
  toolCalls: string[];
  organizationId: string;
  ventureId: string;
}

async function createHarness(
  options: { provider?: ModelProvider; allowPaid?: boolean } = {},
): Promise<Harness> {
  const clock = testClock();
  const store = testStore(clock);
  const audit = new AuditLog(store, clock);
  const flags = new FlagRegistry();
  const costs = new CostLedger(store, clock);
  const approvals = new ApprovalService(store, audit, clock, usd(100));
  const knowledge = new KnowledgeBase(store, clock);
  const tools = new ToolRegistry();
  const toolCalls: string[] = [];

  const readTool: Tool = {
    name: "knowledge.search",
    description: "search",
    inputSchema: { type: "object" },
    actionKind: "knowledge.index",
    readOnly: true,
    async execute() {
      toolCalls.push("knowledge.search");
      return { results: [] };
    },
  };
  const writeTool: Tool = {
    name: "crm.create_record",
    description: "create a CRM record",
    inputSchema: { type: "object" },
    actionKind: "crm.record_create",
    readOnly: false,
    async execute() {
      toolCalls.push("crm.create_record");
      return { created: true };
    },
  };
  tools.register(readTool);
  tools.register(writeTool);

  const provider = options.provider ?? new MockModelProvider();
  const organization = await seedOrganization(store);
  const venture = await seedVenture(store, organization.id);

  return {
    store, flags, costs, clock, provider, tools, toolCalls,
    organizationId: organization.id,
    ventureId: venture.id,
    runner: new AgentRunner({
      store, audit, costs, approvals,
      prompts: createPlatformPromptRegistry(),
      knowledge, tools, provider, flags,
      logger: createLogger({ level: "error", sink: new MemorySink() }),
      metrics: new MetricsRegistry(),
      clock,
      allowPaidProviders: options.allowPaid ?? false,
    }),
  };
}

const researchInput = {
  market: "Commercial door service in the upper Midwest",
  question: "Is there recurring maintenance demand?",
  sources: "Source 1: fictional interview notes.",
};

const promptVariables = {
  market: researchInput.market,
  question: researchInput.question,
  sources: researchInput.sources,
};

describe("AgentRunner", () => {
  let harness: Harness;

  beforeEach(async () => {
    harness = await createHarness();
  });

  it("runs an agent and records the run with its prompt version", async () => {
    const result = await harness.runner.run(
      RESEARCH_AGENT,
      researchInput,
      { organizationId: harness.organizationId, ventureId: harness.ventureId },
      { promptVariables },
    );
    expect(result.ok).toBe(true);

    const runs = await harness.store.agentRuns.all({});
    expect(runs).toHaveLength(1);
    expect(runs[0]!.status).toBe("succeeded");
    expect(runs[0]!.promptKey).toBe("research.market_scan");
    expect(runs[0]!.promptVersion).toBe(1);
    expect(runs[0]!.provider).toBe("mock");
  });

  it("refuses to run when the global kill switch is engaged", async () => {
    harness.flags.setOverride({
      key: "killswitch.all_automation",
      value: true,
      reason: "incident",
      setBy: "owner",
      setAt: harness.clock.now(),
    });
    const result = await harness.runner.run(
      RESEARCH_AGENT,
      researchInput,
      { organizationId: harness.organizationId, ventureId: harness.ventureId },
      { promptVariables },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.status).toBe("denied");
  });

  it("refuses to run when the agent-spend kill switch is engaged", async () => {
    harness.flags.setOverride({
      key: "killswitch.agent_spend",
      value: true,
      reason: "cost anomaly",
      setBy: "finance",
      setAt: harness.clock.now(),
    });
    const result = await harness.runner.run(
      RESEARCH_AGENT,
      researchInput,
      { organizationId: harness.organizationId, ventureId: harness.ventureId },
      { promptVariables },
    );
    expect(result.ok).toBe(false);
  });

  it("rejects input that fails the agent's schema", async () => {
    const result = await harness.runner.run(
      RESEARCH_AGENT,
      { market: "", question: "", sources: "" },
      { organizationId: harness.organizationId, ventureId: harness.ventureId },
      { promptVariables },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.reason).toContain("Input failed validation");
  });

  it("refuses a draft agent", async () => {
    const draft: AgentDefinition<typeof researchInput, { text: string }> = {
      ...RESEARCH_AGENT,
      status: "draft",
    };
    const result = await harness.runner.run(
      draft,
      researchInput,
      { organizationId: harness.organizationId, ventureId: harness.ventureId },
      { promptVariables },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.reason).toContain("draft");
  });

  it("stops when the venture's AI budget is exhausted and queues an approval", async () => {
    await harness.costs.setBudget({
      organizationId: harness.organizationId,
      ventureId: harness.ventureId,
      category: "ai_inference",
      periodKey: "2026-03",
      limit: money(10),
      enforcement: "hard",
    });
    await harness.costs.record({
      organizationId: harness.organizationId,
      ventureId: harness.ventureId,
      category: "ai_inference",
      amount: money(10),
      description: "earlier spend",
    });

    const result = await harness.runner.run(
      RESEARCH_AGENT,
      researchInput,
      { organizationId: harness.organizationId, ventureId: harness.ventureId },
      { promptVariables },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe("budget_exceeded");
      expect(result.error.approvalId).toBeDefined();
    }
    expect(await harness.store.approvals.count({ status: "pending" })).toBe(1);
  });

  it("refuses a billable provider when paid providers are not allowed", async () => {
    const paid = await createHarness({
      provider: new UnimplementedModelProvider("anthropic", "not implemented"),
      allowPaid: false,
    });
    const result = await paid.runner.run(
      RESEARCH_AGENT,
      researchInput,
      { organizationId: paid.organizationId, ventureId: paid.ventureId },
      { promptVariables },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.reason).toContain("paid providers are not enabled");
  });

  it("refuses when the injected provider is not the one the agent was priced for", async () => {
    const paid = await createHarness({
      provider: new UnimplementedModelProvider("anthropic", "not implemented"),
      allowPaid: true,
    });
    const result = await paid.runner.run(
      RESEARCH_AGENT, // declares provider "mock"
      researchInput,
      { organizationId: paid.organizationId, ventureId: paid.ventureId },
      { promptVariables },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.reason).toContain("was not priced for");
  });

  it("refuses a billable provider whose price is not human-verified", async () => {
    const paidAgent: AgentDefinition<typeof researchInput, { text: string }> = {
      ...RESEARCH_AGENT,
      model: { provider: "anthropic", model: "some-unpriced-model", maxOutputTokens: 1000 },
    };
    const paid = await createHarness({
      provider: new UnimplementedModelProvider("anthropic", "not implemented"),
      allowPaid: true,
    });
    const result = await paid.runner.run(
      paidAgent,
      researchInput,
      { organizationId: paid.organizationId, ventureId: paid.ventureId },
      { promptVariables },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.reason).toContain("No human-verified price");
  });

  it("executes read-only tools the agent is allowed", async () => {
    const scripted = await createHarness({
      provider: new MockModelProvider([
        {
          when: "Commercial door",
          respondWith: "looked it up",
          toolCalls: [{ name: "knowledge.search", input: { query: "doors" } }],
        },
      ]),
    });
    const result = await scripted.runner.run(
      RESEARCH_AGENT,
      researchInput,
      { organizationId: scripted.organizationId, ventureId: scripted.ventureId },
      { promptVariables },
    );
    expect(result.ok).toBe(true);
    expect(scripted.toolCalls).toEqual(["knowledge.search"]);
  });

  it("denies a tool call outside the agent's allow-list", async () => {
    const scripted = await createHarness({
      provider: new MockModelProvider([
        {
          when: "Commercial door",
          respondWith: "tried something else",
          toolCalls: [{ name: "crm.create_record", input: {} }],
        },
      ]),
    });
    const result = await scripted.runner.run(
      RESEARCH_AGENT,
      researchInput,
      { organizationId: scripted.organizationId, ventureId: scripted.ventureId },
      { promptVariables },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.status).toBe("denied");
    expect(scripted.toolCalls).toHaveLength(0);
  });

  it("escalates a write tool call that exceeds the agent's autonomy", async () => {
    const writer: AgentDefinition<typeof researchInput, { text: string }> = {
      ...RESEARCH_AGENT,
      key: "research.writer",
      allowedTools: ["crm.create_record"],
      autonomyLevel: 1,
      outputSchema: z.object({ text: z.string() }),
    };
    const scripted = await createHarness({
      provider: new MockModelProvider([
        {
          when: "Commercial door",
          respondWith: "creating a record",
          toolCalls: [{ name: "crm.create_record", input: {} }],
        },
      ]),
    });
    const result = await scripted.runner.run(
      writer,
      researchInput,
      { organizationId: scripted.organizationId, ventureId: scripted.ventureId },
      { promptVariables },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.status).toBe("escalated");
    expect(scripted.toolCalls).toHaveLength(0);
  });

  it("grounds answers in approved knowledge and returns citations", async () => {
    const knowledge = new KnowledgeBase(harness.store, harness.clock);
    const document = await knowledge.create({
      organizationId: harness.organizationId,
      ventureId: harness.ventureId,
      key: "doors.maintenance",
      title: "Commercial door maintenance intervals",
      body: "Commercial door closers require inspection every six months in high-traffic buildings.",
      kind: "research",
    });
    await knowledge.approve(document.id, "usr_owner");

    const result = await harness.runner.run(
      RESEARCH_AGENT,
      researchInput,
      { organizationId: harness.organizationId, ventureId: harness.ventureId },
      { promptVariables, knowledgeQuery: "commercial door maintenance" },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.citations).toContain("doors.maintenance v1");
  });

  it("does not surface unapproved knowledge to an agent", async () => {
    const knowledge = new KnowledgeBase(harness.store, harness.clock);
    await knowledge.create({
      organizationId: harness.organizationId,
      ventureId: harness.ventureId,
      key: "doors.draft",
      title: "Unreviewed pricing note",
      body: "Commercial door service should be priced at $900 per visit.",
      kind: "research",
    });

    const result = await harness.runner.run(
      RESEARCH_AGENT,
      researchInput,
      { organizationId: harness.organizationId, ventureId: harness.ventureId },
      { promptVariables, knowledgeQuery: "commercial door pricing" },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.citations).toHaveLength(0);
  });

  it("charges nothing when running against the mock provider", async () => {
    await harness.runner.run(
      RESEARCH_AGENT,
      researchInput,
      { organizationId: harness.organizationId, ventureId: harness.ventureId },
      { promptVariables },
    );
    const total = await harness.costs.total({ organizationId: harness.organizationId });
    expect(total.amountMinor).toBe(0);
  });
});
