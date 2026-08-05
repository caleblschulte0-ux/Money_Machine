import type { EntityMap, EntityName } from "./types.ts";

/**
 * Runtime list of every collection, and the Prisma model each maps to.
 *
 * Keeping the mapping in one place is what lets both stores be built
 * generically instead of hand-writing 40 near-identical repositories.
 */
export const ENTITY_TO_PRISMA_MODEL = {
  organizations: "organization",
  users: "user",
  memberships: "membership",
  sessions: "session",
  apiKeys: "apiKey",
  ventures: "venture",
  ventureMetricSnapshots: "ventureMetricSnapshot",
  ventureGateResults: "ventureGateResult",
  accounts: "account",
  contacts: "contact",
  leads: "lead",
  opportunities: "opportunity",
  tasks: "task",
  notes: "note",
  communications: "communication",
  supportCases: "supportCase",
  campaigns: "campaign",
  projects: "project",
  documents: "documentRecord",
  workflowDefinitions: "workflowDefinition",
  workflowRuns: "workflowRun",
  workflowStepRuns: "workflowStepRun",
  agentDefinitions: "agentDefinition",
  agentRuns: "agentRun",
  approvals: "approval",
  idempotencyRecords: "idempotencyRecord",
  domainEvents: "domainEvent",
  scheduledJobs: "scheduledJob",
  costEntries: "costEntry",
  budgets: "budget",
  plans: "plan",
  subscriptions: "subscription",
  invoices: "invoice",
  payments: "payment",
  consents: "consent",
  suppressions: "suppression",
  dataSubjectRequests: "dataSubjectRequest",
  knowledgeDocuments: "knowledgeDocument",
  experiments: "experiment",
  auditEvents: "auditEvent",
  flagOverrides: "flagOverride",
} as const satisfies Record<EntityName, string>;

export const ENTITY_NAMES = Object.keys(ENTITY_TO_PRISMA_MODEL) as readonly EntityName[];

export type { EntityMap, EntityName };
