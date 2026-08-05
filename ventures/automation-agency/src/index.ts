import { z } from "zod";
import type { AgentDefinition } from "@holdco/agents";
import type { VentureManifest } from "@holdco/ventures";
import type { WorkflowDefinition } from "@holdco/workflows";
import type { FlagDefinition } from "@holdco/config";
import type { PromptVersion } from "@holdco/prompts";
import { BASE_GUARDRAILS } from "@holdco/prompts";
import { SCORING_MODEL } from "./scoring.ts";

/**
 * AI Automation Agency — Phase 2, the first revenue venture (playbook §9, §40).
 *
 * Sells measurable operational savings: hours reduced, errors reduced,
 * response time improved. It explicitly does not sell headcount elimination,
 * and the manifest's `nonClaims` are surfaced to the SDR agent's prompt so the
 * claim boundary is enforced at generation time, not at review time.
 */
export const FLAGS: readonly FlagDefinition[] = [
  {
    key: "feature.venture.automation_agency",
    description: "AI Automation Agency venture module.",
    defaultValue: true,
    status: "experimental",
    owner: "venture_lead",
    ventures: ["automation-agency"],
  },
  {
    key: "killswitch.automation_agency_outreach",
    description: "Stop all outbound prospecting for the automation agency.",
    defaultValue: false,
    status: "stable",
    owner: "owner",
    ventures: ["automation-agency"],
  },
];

export const PROMPTS: readonly PromptVersion[] = [
  {
    key: "agency.audit_findings",
    version: 1,
    description: "Turn a completed automation audit intake into prioritised findings.",
    system: [
      "You analyse a company's operational processes to find automation opportunities.",
      "You quantify savings only from numbers the client supplied. You never estimate a",
      "number the client did not give you.",
      ...BASE_GUARDRAILS,
    ].join("\n"),
    template: [
      "Company: {{companyName}} ({{industry}}, {{employeeCount}} employees)",
      "",
      "Processes the client described, with their own time and volume figures:",
      "{{processes}}",
      "",
      "Systems they use: {{systems}}",
      "",
      "For each process, return: the process name, the hours per month the client",
      "reported, what could be automated, what must stay human and why, the residual",
      "hours after automation, and the confidence (high/medium/low) with a reason.",
      "",
      "Rules:",
      "- If the client gave no hours figure for a process, output \"hours not supplied\"",
      "  and do not estimate one.",
      "- Never claim a role or person can be eliminated. Report hours, not headcount.",
      "- Flag any process where automation would touch payments, contracts, hiring,",
      "  termination, medical or legal decisions as REQUIRES_HUMAN_APPROVAL.",
    ].join("\n"),
    requiredVariables: ["companyName", "industry", "employeeCount", "processes", "systems"],
    guardrails: [
      "Estimated savings must trace to a client-supplied figure.",
      "Headcount reduction is never an output of this prompt.",
    ],
    createdOn: "2026-08-05",
    status: "active",
  },
];

const auditOutput = z.object({ text: z.string().min(1) });

export const AUDIT_ANALYST_AGENT: AgentDefinition<
  {
    companyName: string;
    industry: string;
    employeeCount: string;
    processes: string;
    systems: string;
  },
  { text: string }
> = {
  key: "agency.audit_analyst",
  version: 1,
  name: "Automation Audit Analyst",
  ventureKey: "automation-agency",
  role: "Analyse audit intake and produce prioritised findings",
  objective:
    "Convert a client's own process and volume figures into a prioritised list of automation opportunities with residual human work stated honestly.",
  allowedTools: ["knowledge.search"],
  prohibitedActions: [
    "email.send_marketing",
    "contract.send",
    "payment.charge",
    "employment.terminate",
  ],
  inputSchema: z.object({
    companyName: z.string().min(1),
    industry: z.string(),
    employeeCount: z.string(),
    processes: z.string().min(10),
    systems: z.string(),
  }),
  outputSchema: auditOutput,
  promptKey: "agency.audit_findings",
  promptVersion: 1,
  model: { provider: "mock", model: "mock-large", maxOutputTokens: 3000 },
  costBudgetMinor: 75,
  timeoutMs: 90_000,
  maxRetries: 1,
  autonomyLevel: 1,
  escalationRules: [
    { when: "no_grounding", action: "escalate_to_human", note: "Missing client figures must not be invented." },
    { when: "output_invalid", action: "escalate_to_human", note: "A malformed audit goes to the venture lead." },
    { when: "budget_exceeded", action: "escalate_to_human", note: "Audits are billable; overruns are a pricing signal." },
  ],
  appliesActionKind: "document.generate",
  hasTestSuite: true,
  status: "active",
};

/**
 * Lead intake workflow.
 *
 * Autonomy level 3: it scores, tags and notifies, but the proposal draft and
 * every outbound message stop at a human. Level 3 is only safe here because
 * every step is low-risk and reversible.
 */
export const LEAD_INTAKE_WORKFLOW: WorkflowDefinition = {
  key: "agency.lead_intake",
  version: 1,
  name: "Automation audit lead intake",
  description:
    "Scores an inbound automation-audit request, creates the qualification task and notifies the venture lead. Sends nothing to the prospect.",
  ventureKey: "automation-agency",
  trigger: {
    type: "lead.created",
    when: { op: "equals", path: "ventureKey", value: "automation-agency" },
    idempotencyPath: "leadId",
  },
  autonomyLevel: 3,
  maxRunCostMinor: 100,
  killSwitchKey: "killswitch.automation_agency_outreach",
  status: "active",
  steps: [
    {
      id: "tag_source",
      name: "Tag lead with its channel",
      action: "record.tag",
      actionKind: "record.tag",
      input: { entity: "leads", id: "{{trigger.leadId}}", tag: "{{trigger.channel}}" },
      reversible: true,
    },
    {
      id: "qualification_task",
      name: "Create qualification task",
      action: "task.create",
      actionKind: "task.create",
      input: {
        title: "Qualify automation audit lead: {{trigger.companyName}}",
        description:
          "Score {{trigger.score}}. Confirm process volumes and current tooling before quoting. " +
          "Do not quote a saving the prospect has not given us the baseline for.",
        priority: "high",
        relatedType: "lead",
        relatedId: "{{trigger.leadId}}",
      },
      reversible: true,
    },
    {
      id: "notify_lead_owner",
      name: "Notify the venture lead",
      action: "human.notify",
      actionKind: "notification.internal",
      when: { op: "gte", path: "trigger.score", value: 60 },
      input: {
        message:
          "High-scoring automation audit lead from {{trigger.companyName}} (score {{trigger.score}}). " +
          "Qualification task created.",
      },
      reversible: true,
    },
  ],
};

/**
 * Audit delivery workflow. The proposal step is a `document.generate` action,
 * which is high-risk-adjacent and therefore stops at the approval queue — a
 * proposal is a commercial commitment and never leaves without a human.
 */
export const AUDIT_DELIVERY_WORKFLOW: WorkflowDefinition = {
  key: "agency.audit_delivery",
  version: 1,
  name: "Deliver a paid automation audit",
  description:
    "Runs the audit analyst over collected intake, has QC review it, then queues the proposal for human approval.",
  ventureKey: "automation-agency",
  trigger: { type: "manual", idempotencyPath: "projectId" },
  autonomyLevel: 2,
  maxRunCostMinor: 300,
  status: "active",
  steps: [
    {
      id: "analyse",
      name: "Analyse the audit intake",
      action: "agent.run",
      actionKind: "agent.run",
      input: {
        agentKey: "agency.audit_analyst",
        promptVariables: {
          companyName: "{{trigger.companyName}}",
          industry: "{{trigger.industry}}",
          employeeCount: "{{trigger.employeeCount}}",
          processes: "{{trigger.processes}}",
          systems: "{{trigger.systems}}",
        },
        input: {
          companyName: "{{trigger.companyName}}",
          industry: "{{trigger.industry}}",
          employeeCount: "{{trigger.employeeCount}}",
          processes: "{{trigger.processes}}",
          systems: "{{trigger.systems}}",
        },
      },
      estimatedCostMinor: 75,
      maxRetries: 1,
      onFailure: "stop",
      reversible: true,
    },
    {
      id: "quality_review",
      name: "Quality-control the findings",
      action: "agent.run",
      actionKind: "agent.run",
      input: {
        agentKey: "quality.control",
        promptVariables: {
          task: "Produce automation audit findings from client-supplied figures only.",
          output: "{{steps.analyse.output.text}}",
          sources: "{{trigger.processes}}",
        },
        input: {
          task: "Produce automation audit findings from client-supplied figures only.",
          output: "{{steps.analyse.output.text}}",
          sources: "{{trigger.processes}}",
        },
      },
      estimatedCostMinor: 30,
      onFailure: "stop",
      reversible: true,
    },
    {
      id: "proposal",
      name: "Generate the proposal document",
      action: "document.generate",
      actionKind: "document.generate",
      input: {
        kind: "proposal",
        accountId: "{{trigger.accountId}}",
        findings: "{{steps.analyse.output.text}}",
        review: "{{steps.quality_review.output.text}}",
      },
      estimatedCostMinor: 0,
      reversible: false,
    },
  ],
};

export const MANIFEST: VentureManifest = {
  key: "automation-agency",
  name: "AI Automation Agency",
  brandName: "Ridgeline Operations",
  thesis:
    "Small and midsize companies run their operations on manual handoffs between tools they already pay for. Selling measured hour reductions on those specific handoffs is the fastest path to revenue and reveals which repeated problems are worth turning into software.",
  phase: 2,
  maxAutonomyLevel: 3,
  featureFlagKey: "feature.venture.automation_agency",
  status: "scaffolded",
  offers: [
    {
      key: "audit",
      name: "Automation Audit",
      deliverable:
        "A two-week review of up to eight named processes, delivered as a written findings document with hours-per-month baselines the client supplied, a prioritised automation list, and a fixed-price implementation quote.",
      priceMinor: 250_000,
      billingInterval: "one_time",
      outcomeClaim:
        "A prioritised list of automation opportunities with the client's own baseline hours attached to each.",
      nonClaims: [
        "Does not promise any specific number of hours saved before the baseline is measured.",
        "Does not promise that any employee or role can be eliminated.",
        "Does not include implementation work.",
      ],
      deliveryWorkflowKey: "agency.audit_delivery",
    },
    {
      key: "department",
      name: "Department Automation",
      deliverable:
        "Implementation of the agreed automations for one department, including integration setup, monitoring, and a monthly report showing hours before and after against the audit baseline.",
      priceMinor: 1_200_000,
      setupFeeMinor: 250_000,
      billingInterval: "monthly",
      outcomeClaim:
        "The automations specified in the signed scope run in production with monitored failure handling and a monthly before/after hours report.",
      nonClaims: [
        "Does not guarantee a revenue increase.",
        "Does not guarantee headcount reduction.",
        "Does not cover changes the client's vendors make to their own APIs without notice.",
      ],
      deliveryWorkflowKey: "agency.audit_delivery",
    },
  ],
  workflowKeys: [LEAD_INTAKE_WORKFLOW.key, AUDIT_DELIVERY_WORKFLOW.key],
  agentKeys: [AUDIT_ANALYST_AGENT.key, "sales.sdr", "quality.control", "support.reply"],
  metrics: [
    { key: "audits_sold", label: "Audits sold", unit: "count", description: "Paid audits closed in the period.", isNorthStar: true },
    { key: "audit_to_implementation_rate", label: "Audit → implementation conversion", unit: "ratio", description: "Share of audits that convert to an implementation contract." },
    { key: "delivery_hours_per_audit", label: "Human hours per audit", unit: "hours", description: "Human time spent delivering one audit. The number that decides whether this scales." },
    { key: "gross_margin", label: "Gross margin", unit: "ratio", description: "Revenue minus delivery labour, contractor and AI cost." },
    { key: "monthly_retainer_mrr", label: "Retainer MRR", unit: "currency_minor", description: "Recurring management-fee revenue." },
  ],
  killCriteria: [
    { description: "No paid audit sold after sustained outreach", threshold: "0 paid audits after 200 qualified conversations", measuredBy: "audits_sold vs outreach count in CRM" },
    { description: "Human delivery time does not fall across audits", threshold: "delivery_hours_per_audit not down 30% by the tenth audit", measuredBy: "delivery_hours_per_audit trend" },
    { description: "Gross margin below target", threshold: "gross margin under 50% for two consecutive months", measuredBy: "cost ledger vs revenue" },
    { description: "Audits do not convert", threshold: "audit → implementation conversion under 20% across ten audits", measuredBy: "audit_to_implementation_rate" },
  ],
  legalNotes: [
    "Client credentials are handled under a written access agreement; never store a client credential outside the approved secret store.",
    "Savings claims in proposals must cite the client's own supplied baseline figures.",
    "Marketing must never state or imply that staff can be eliminated.",
    "Implementations touching payment, payroll or HR data require a written scope addendum before work begins.",
  ],
};

export const MODULE = {
  manifest: MANIFEST,
  workflows: [LEAD_INTAKE_WORKFLOW, AUDIT_DELIVERY_WORKFLOW],
  agents: [AUDIT_ANALYST_AGENT],
  prompts: PROMPTS,
  flags: FLAGS,
} as const;

export { SCORING_MODEL };
