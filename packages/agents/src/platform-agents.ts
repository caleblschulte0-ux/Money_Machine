import { z } from "zod";
import type { AgentDefinition } from "./definition.ts";
import { AgentRegistry } from "./definition.ts";

/**
 * The holding-company agent roster (playbook §7).
 *
 * These are shared across every venture (`ventureKey: null`). Venture modules
 * register their own specialised agents on top.
 *
 * Autonomy levels here are deliberately low. Research, content and finance
 * agents draft; humans decide. The engineering agent in particular is capped
 * at level 1 and holds no deployment tool — the playbook forbids it deploying
 * to production without passing tests and the configured approval process, and
 * the safest way to enforce that is to not give it the capability at all.
 */

const commonEscalation = [
  { when: "output_invalid", action: "escalate_to_human", note: "Malformed output reaches a human rather than a retry loop." },
  { when: "budget_exceeded", action: "escalate_to_human", note: "Budget decisions belong to the owner." },
  { when: "no_grounding", action: "escalate_to_human", note: "Refuse to answer from memory when the knowledge base is silent." },
] as const;

const textOutput = z.object({ text: z.string().min(1) });

export const RESEARCH_AGENT: AgentDefinition<
  { market: string; question: string; sources: string },
  { text: string }
> = {
  key: "research.market",
  version: 1,
  name: "Research Agent",
  ventureKey: null,
  role: "Market and competitor research",
  objective:
    "Summarise what supplied sources establish about a market, name what they do not establish, and propose the cheapest tests to close the biggest gap.",
  allowedTools: ["knowledge.search"],
  prohibitedActions: ["email.send_marketing", "payment.charge", "contract.send", "data.export"],
  inputSchema: z.object({
    market: z.string().min(2),
    question: z.string().min(5),
    sources: z.string().min(1),
  }),
  outputSchema: textOutput,
  promptKey: "research.market_scan",
  promptVersion: 1,
  model: { provider: "mock", model: "mock-large", maxOutputTokens: 2000 },
  costBudgetMinor: 50,
  timeoutMs: 60_000,
  maxRetries: 1,
  autonomyLevel: 1,
  escalationRules: [...commonEscalation],
  appliesActionKind: null,
  hasTestSuite: true,
  status: "active",
};

export const SDR_AGENT: AgentDefinition<
  {
    prospectName: string;
    prospectRole: string;
    companyName: string;
    researchNotes: string;
    offerName: string;
    offerDeliverable: string;
    outcomeClaim: string;
    nonClaims: string;
  },
  { text: string }
> = {
  key: "sales.sdr",
  version: 1,
  name: "Sales Development Agent",
  ventureKey: null,
  role: "Prospect research and outreach drafting",
  objective:
    "Draft first-touch outreach grounded in verified research, for a human to review and send. Never sends anything itself.",
  allowedTools: ["crm.find_contact", "knowledge.search"],
  prohibitedActions: ["email.send_marketing", "sms.send", "call.place_outbound", "contract.send"],
  inputSchema: z.object({
    prospectName: z.string().min(1),
    prospectRole: z.string().min(1),
    companyName: z.string().min(1),
    researchNotes: z.string(),
    offerName: z.string().min(1),
    offerDeliverable: z.string().min(1),
    outcomeClaim: z.string().min(1),
    nonClaims: z.string().min(1),
  }),
  outputSchema: textOutput,
  promptKey: "sales.outreach_draft",
  promptVersion: 1,
  model: { provider: "mock", model: "mock-small", maxOutputTokens: 600 },
  costBudgetMinor: 20,
  timeoutMs: 30_000,
  maxRetries: 1,
  autonomyLevel: 1,
  escalationRules: [...commonEscalation],
  appliesActionKind: "email.send_marketing",
  hasTestSuite: true,
  status: "active",
};

export const SUPPORT_AGENT: AgentDefinition<
  { message: string; knowledge: string },
  { text: string }
> = {
  key: "support.reply",
  version: 1,
  name: "Support Agent",
  ventureKey: null,
  role: "Draft support replies from approved knowledge",
  objective:
    "Answer common customer questions using only approved knowledge documents, and escalate anything the knowledge base does not cover.",
  allowedTools: ["knowledge.search", "crm.find_contact"],
  prohibitedActions: ["payment.refund", "discount.grant", "contract.send", "legal.advice"],
  inputSchema: z.object({ message: z.string().min(1), knowledge: z.string() }),
  outputSchema: textOutput,
  promptKey: "support.draft_reply",
  promptVersion: 1,
  model: { provider: "mock", model: "mock-small", maxOutputTokens: 800 },
  costBudgetMinor: 15,
  timeoutMs: 30_000,
  maxRetries: 1,
  autonomyLevel: 2,
  escalationRules: [...commonEscalation],
  appliesActionKind: "email.send_transactional",
  hasTestSuite: true,
  status: "active",
};

export const QUALITY_CONTROL_AGENT: AgentDefinition<
  { task: string; output: string; sources: string },
  { text: string }
> = {
  key: "quality.control",
  version: 1,
  name: "Quality-Control Agent",
  ventureKey: null,
  role: "Adversarial review of other agents' output",
  objective:
    "Find unsupported claims, fabricated specifics, policy violations and missing evidence in another agent's output before it reaches a customer.",
  allowedTools: ["knowledge.search"],
  prohibitedActions: ["email.send_marketing", "content.publish_scheduled", "payment.charge"],
  inputSchema: z.object({
    task: z.string().min(1),
    output: z.string().min(1),
    sources: z.string(),
  }),
  outputSchema: textOutput,
  promptKey: "quality.review_output",
  promptVersion: 1,
  model: { provider: "mock", model: "mock-large", maxOutputTokens: 1500 },
  costBudgetMinor: 30,
  timeoutMs: 60_000,
  maxRetries: 1,
  autonomyLevel: 3,
  escalationRules: [...commonEscalation],
  appliesActionKind: null,
  hasTestSuite: true,
  status: "active",
};

export const FINANCE_AGENT: AgentDefinition<
  { description: string; amount: string; vendor: string; categories: string },
  { text: string }
> = {
  key: "finance.categorize",
  version: 1,
  name: "Finance Agent",
  ventureKey: null,
  role: "Bookkeeping preparation",
  objective:
    "Categorise expenses and flag anomalies so a human bookkeeper starts from clean data. Never files, certifies or audits anything.",
  allowedTools: [],
  prohibitedActions: ["payment.charge", "payment.refund", "invoice.issue", "capital.allocate"],
  inputSchema: z.object({
    description: z.string().min(1),
    amount: z.string().min(1),
    vendor: z.string(),
    categories: z.string().min(1),
  }),
  outputSchema: textOutput,
  promptKey: "finance.categorize_expense",
  promptVersion: 1,
  model: { provider: "mock", model: "mock-small", maxOutputTokens: 300 },
  costBudgetMinor: 10,
  timeoutMs: 20_000,
  maxRetries: 1,
  autonomyLevel: 2,
  escalationRules: [...commonEscalation],
  appliesActionKind: null,
  hasTestSuite: true,
  status: "active",
};

/**
 * Operations and engineering agents are declared but left in `draft`: the
 * tools they would need (repository access, deployment) are not built, and
 * shipping an "active" agent whose capabilities do not exist would be
 * fabricating a working integration.
 */
export const OPERATIONS_AGENT: AgentDefinition<{ text: string }, { text: string }> = {
  key: "operations.monitor",
  version: 1,
  name: "Operations Agent",
  ventureKey: null,
  role: "Workflow monitoring and bottleneck detection",
  objective:
    "Watch workflow failures and queue depth, create tasks for bottlenecks, and prepare the weekly operating report.",
  allowedTools: ["knowledge.search"],
  prohibitedActions: ["deploy.production", "payment.charge", "account.delete"],
  inputSchema: z.object({ text: z.string() }),
  outputSchema: textOutput,
  promptKey: "research.market_scan",
  promptVersion: 1,
  model: { provider: "mock", model: "mock-small", maxOutputTokens: 800 },
  costBudgetMinor: 15,
  timeoutMs: 30_000,
  maxRetries: 1,
  autonomyLevel: 1,
  escalationRules: [...commonEscalation],
  appliesActionKind: null,
  hasTestSuite: false,
  status: "draft",
};

export const ENGINEERING_AGENT: AgentDefinition<{ text: string }, { text: string }> = {
  key: "engineering.diagnose",
  version: 1,
  name: "Engineering Agent",
  ventureKey: null,
  role: "Error diagnosis and change drafting",
  objective:
    "Diagnose application errors, draft changes and tests, and open pull requests. It has no deployment capability by design.",
  allowedTools: [],
  prohibitedActions: ["deploy.production", "data.export", "account.delete", "payment.charge"],
  inputSchema: z.object({ text: z.string() }),
  outputSchema: textOutput,
  promptKey: "research.market_scan",
  promptVersion: 1,
  model: { provider: "mock", model: "mock-large", maxOutputTokens: 3000 },
  costBudgetMinor: 100,
  timeoutMs: 120_000,
  maxRetries: 1,
  autonomyLevel: 1,
  escalationRules: [...commonEscalation],
  appliesActionKind: null,
  hasTestSuite: false,
  status: "draft",
};

export const PLATFORM_AGENTS = [
  RESEARCH_AGENT,
  SDR_AGENT,
  SUPPORT_AGENT,
  QUALITY_CONTROL_AGENT,
  FINANCE_AGENT,
  OPERATIONS_AGENT,
  ENGINEERING_AGENT,
] as const;

export function createPlatformAgentRegistry(): AgentRegistry {
  const registry = new AgentRegistry();
  for (const agent of PLATFORM_AGENTS) {
    registry.register(agent as AgentDefinition<unknown, unknown>);
  }
  return registry;
}
