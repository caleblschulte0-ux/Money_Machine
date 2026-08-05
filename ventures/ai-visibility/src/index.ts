import { z } from "zod";
import type { AgentDefinition } from "@holdco/agents";
import type { VentureManifest } from "@holdco/ventures";
import type { WorkflowDefinition } from "@holdco/workflows";
import type { FlagDefinition } from "@holdco/config";
import type { PromptVersion } from "@holdco/prompts";
import { BASE_GUARDRAILS } from "@holdco/prompts";

export * from "./tracking.ts";

/**
 * AI Visibility & Answer-Engine Optimization — Phase 3 (playbook §10).
 *
 * The commercial constraint that shapes this entire module: **we cannot
 * promise placement in an AI answer, and we do not control the systems that
 * produce them.** What we can sell is measurement, comparison over time, and
 * the content work that gives an answer engine something accurate to draw on.
 * Every offer's `nonClaims` says that in the client's language.
 */
export const FLAGS: readonly FlagDefinition[] = [
  {
    key: "feature.venture.ai_visibility",
    description: "AI Visibility venture module.",
    defaultValue: false,
    status: "incomplete",
    owner: "venture_lead",
    ventures: ["ai-visibility"],
  },
  {
    key: "feature.ai_visibility_live_probing",
    description:
      "Query external answer engines for brand mentions. Off until each provider's terms have been reviewed and access is properly licensed.",
    defaultValue: false,
    status: "incomplete",
    owner: "owner",
    ventures: ["ai-visibility"],
  },
];

export const PROMPTS: readonly PromptVersion[] = [
  {
    key: "visibility.gap_analysis",
    version: 1,
    description: "Identify content gaps from recorded answer-engine observations.",
    system: [
      "You analyse how a brand appears in AI-assisted answers, using only recorded observations.",
      "You never assert what an answer engine will do in future, and you never promise placement.",
      ...BASE_GUARDRAILS,
    ].join("\n"),
    template: [
      "Brand: {{brandName}}",
      "Customer questions tracked: {{questionCount}}",
      "",
      "Recorded observations (question, engine, date, whether the brand appeared, competitors named, sources cited):",
      "{{observations}}",
      "",
      "Brand facts we have verified: {{brandFacts}}",
      "",
      "Return: (1) questions where the brand is absent and a competitor appears,",
      "(2) which cited sources are driving those answers, (3) any inaccurate statement",
      "about the brand that appeared, (4) the content assets that would give an engine",
      "something accurate to cite, ranked by how many tracked questions they address.",
      "",
      "State plainly that content work influences but does not control answer output.",
    ].join("\n"),
    requiredVariables: ["brandName", "questionCount", "observations", "brandFacts"],
    guardrails: [
      "Never predict a ranking or a placement.",
      "Never describe an observation that is not in the supplied data.",
    ],
    createdOn: "2026-08-05",
    status: "active",
  },
];

export const GAP_ANALYSIS_AGENT: AgentDefinition<
  { brandName: string; questionCount: string; observations: string; brandFacts: string },
  { text: string }
> = {
  key: "visibility.gap_analyst",
  version: 1,
  name: "AI Visibility Gap Analyst",
  ventureKey: "ai-visibility",
  role: "Analyse recorded answer-engine observations for content gaps",
  objective:
    "Turn recorded observations of how answer engines describe a brand into a ranked list of content gaps and factual corrections, without predicting future placement.",
  allowedTools: ["knowledge.search"],
  prohibitedActions: ["content.publish_scheduled", "email.send_marketing", "payment.charge"],
  inputSchema: z.object({
    brandName: z.string().min(1),
    questionCount: z.string(),
    observations: z.string().min(10),
    brandFacts: z.string(),
  }),
  outputSchema: z.object({ text: z.string().min(1) }),
  promptKey: "visibility.gap_analysis",
  promptVersion: 1,
  model: { provider: "mock", model: "mock-large", maxOutputTokens: 2500 },
  costBudgetMinor: 60,
  timeoutMs: 90_000,
  maxRetries: 1,
  autonomyLevel: 1,
  escalationRules: [
    { when: "no_grounding", action: "escalate_to_human", note: "No observations means no analysis, not a guess." },
    { when: "output_invalid", action: "escalate_to_human", note: "Client-facing analysis must be well-formed." },
    { when: "budget_exceeded", action: "escalate_to_human", note: "Monitoring cost per client drives the price." },
  ],
  appliesActionKind: "document.generate",
  hasTestSuite: true,
  status: "active",
};

export const MONTHLY_REPORT_WORKFLOW: WorkflowDefinition = {
  key: "visibility.monthly_report",
  version: 1,
  name: "Monthly AI visibility report",
  description:
    "Analyses the month's recorded observations for a client and queues the report for human review before it is sent.",
  ventureKey: "ai-visibility",
  trigger: { type: "schedule", cron: "0 9 1 * *", idempotencyPath: "periodKey" },
  autonomyLevel: 2,
  maxRunCostMinor: 200,
  status: "draft",
  steps: [
    {
      id: "analyse_gaps",
      name: "Analyse visibility gaps",
      action: "agent.run",
      actionKind: "agent.run",
      input: {
        agentKey: "visibility.gap_analyst",
        customerAccountId: "{{trigger.accountId}}",
        promptVariables: {
          brandName: "{{trigger.brandName}}",
          questionCount: "{{trigger.questionCount}}",
          observations: "{{trigger.observations}}",
          brandFacts: "{{trigger.brandFacts}}",
        },
        input: {
          brandName: "{{trigger.brandName}}",
          questionCount: "{{trigger.questionCount}}",
          observations: "{{trigger.observations}}",
          brandFacts: "{{trigger.brandFacts}}",
        },
      },
      estimatedCostMinor: 60,
      onFailure: "stop",
      reversible: true,
    },
    {
      id: "review_task",
      name: "Queue the report for human review",
      action: "task.create",
      actionKind: "task.create",
      input: {
        title: "Review AI visibility report: {{trigger.brandName}} ({{trigger.periodKey}})",
        description:
          "Check every claimed observation against the recorded data before this goes to the client. " +
          "Reject any sentence that predicts placement.",
        priority: "high",
        relatedType: "account",
        relatedId: "{{trigger.accountId}}",
      },
      reversible: true,
    },
  ],
};

export const MANIFEST: VentureManifest = {
  key: "ai-visibility",
  name: "AI Visibility and Answer-Engine Optimization",
  brandName: "Answerline",
  thesis:
    "Buyers increasingly ask AI assistants for recommendations, and most companies have no measurement of how they are described in those answers. Monitoring is a defensible recurring product even though placement itself cannot be guaranteed or controlled.",
  phase: 3,
  maxAutonomyLevel: 2,
  featureFlagKey: "feature.venture.ai_visibility",
  status: "docs_only",
  offers: [
    {
      key: "audit",
      name: "One-Time AI Visibility Audit",
      deliverable:
        "A snapshot report covering an agreed set of customer questions: whether the brand appeared, which competitors appeared, which sources the answers cited, and any factual inaccuracies observed, with a ranked content plan.",
      priceMinor: 150_000,
      billingInterval: "one_time",
      outcomeClaim:
        "A documented, reproducible measurement of how the brand was described across the tracked questions on the dates measured.",
      nonClaims: [
        "Does not guarantee the brand will appear in any AI answer.",
        "Does not guarantee any recommendation, ranking or placement.",
        "Does not control or influence the internal workings of any AI system.",
        "Observations are point-in-time; answer engines change without notice.",
      ],
      deliveryWorkflowKey: "visibility.monthly_report",
    },
    {
      key: "monitoring",
      name: "Monthly Monitoring",
      deliverable:
        "Ongoing tracking of the agreed question set with a monthly report showing changes in appearance, competitor presence, cited sources and AI-referred traffic.",
      priceMinor: 90_000,
      billingInterval: "monthly",
      outcomeClaim:
        "A monthly, comparable record of how the brand's presence in tracked answers changes over time.",
      nonClaims: [
        "Does not guarantee improvement in appearance rate.",
        "Does not guarantee traffic or conversions from AI referrals.",
        "Coverage is limited to the engines and questions named in the agreement.",
      ],
      deliveryWorkflowKey: "visibility.monthly_report",
    },
  ],
  workflowKeys: [MONTHLY_REPORT_WORKFLOW.key],
  agentKeys: [GAP_ANALYSIS_AGENT.key, "quality.control"],
  metrics: [
    { key: "tracked_questions", label: "Tracked questions", unit: "count", description: "Questions under monitoring across all clients." },
    { key: "appearance_rate", label: "Brand appearance rate", unit: "ratio", description: "Share of tracked questions where the client brand appeared.", isNorthStar: true },
    { key: "monitoring_cost_per_client", label: "Monitoring cost per client", unit: "currency_minor", description: "Inference and data cost to monitor one client for a month." },
    { key: "ai_referral_sessions", label: "AI-referred sessions", unit: "count", description: "Sessions attributed to AI assistant referrers, where the client's analytics can identify them." },
    { key: "retention_months", label: "Median retention", unit: "days", description: "How long monitoring clients stay subscribed." },
  ],
  killCriteria: [
    { description: "Clients will not renew monitoring", threshold: "under 60% renewal at month three across ten clients", measuredBy: "subscription cancellations" },
    { description: "Monitoring cost destroys the margin", threshold: "monitoring_cost_per_client above 30% of the monthly price", measuredBy: "cost ledger attributed by customer" },
    { description: "Observations are not reproducible enough to sell", threshold: "run-to-run variance makes month-over-month comparison meaningless on the same question set", measuredBy: "variance across repeated observations" },
    { description: "Access to answer engines cannot be obtained on compliant terms", threshold: "no licensed or permitted access path exists for the engines clients care about", measuredBy: "documented terms review" },
  ],
  legalNotes: [
    "No offer, proposal or marketing asset may promise placement, ranking or recommendation in any AI system.",
    "Querying third-party answer engines requires a documented review of that provider's terms before any automated probing; feature.ai_visibility_live_probing stays off until then.",
    "Reports must date-stamp every observation and state that answer engines change without notice.",
    "Do not represent observed answers as the provider's official position.",
  ],
};

export const MODULE = {
  manifest: MANIFEST,
  workflows: [MONTHLY_REPORT_WORKFLOW],
  agents: [GAP_ANALYSIS_AGENT],
  prompts: PROMPTS,
  flags: FLAGS,
} as const;
