import type { JsonObject, JsonValue } from "@holdco/core";

/**
 * Domain record shapes. These mirror `prisma/schema.prisma` field-for-field so
 * that the Prisma-backed store can pass rows through with a cast and the
 * in-memory store can hold the identical objects.
 *
 * Conventions applied to every record:
 *  - `id`                prefixed identifier (see @holdco/core ids)
 *  - `organizationId`    tenant isolation
 *  - `ventureId`         which business owns the row (null = holding company)
 *  - `createdAt/updatedAt`
 *  - `metadata`          open JSON for venture-specific custom fields
 */
export interface BaseRecord {
  id: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VentureOwned extends BaseRecord {
  ventureId: string | null;
}

/** Common provenance/quality fields the playbook requires on CRM records (§6). */
export interface RecordProvenance {
  source: string;
  /** 0..1 confidence that the record's key fields are correct. */
  dataConfidence: number;
  consentStatus: ConsentStatus;
  retentionPolicy: string | null;
  tags: string[];
  metadata: JsonObject;
  assignedUserId: string | null;
  assignedAgentId: string | null;
}

export type ConsentStatus = "unknown" | "granted" | "denied" | "withdrawn" | "not_required";

// ---------------------------------------------------------------------------
// Tenancy, identity and access
// ---------------------------------------------------------------------------

export interface Organization {
  id: string;
  name: string;
  slug: string;
  /** `holding` = the holdco itself; `customer` = a paying tenant. */
  kind: "holding" | "customer";
  status: "active" | "suspended" | "closed";
  createdAt: Date;
  updatedAt: Date;
  metadata: JsonObject;
}

export interface User extends BaseRecord {
  email: string;
  name: string;
  passwordHash: string | null;
  status: "invited" | "active" | "disabled";
  mfaEnrolled: boolean;
  lastLoginAt: Date | null;
}

export type RoleKey =
  | "owner"
  | "operator"
  | "venture_lead"
  | "analyst"
  | "finance"
  | "support"
  | "customer_admin"
  | "customer_user"
  | "agent";

export interface Membership extends BaseRecord {
  userId: string;
  role: RoleKey;
  /** `null` means every venture in the organization. */
  ventureIds: string[] | null;
  status: "active" | "revoked";
}

export interface Session extends BaseRecord {
  userId: string;
  tokenDigest: string;
  expiresAt: Date;
  revokedAt: Date | null;
  ipAddress: string | null;
  userAgent: string | null;
  mfaSatisfied: boolean;
}

export interface ApiKey extends VentureOwned {
  name: string;
  tokenDigest: string;
  scopes: string[];
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  rateLimitPerMinute: number;
}

// ---------------------------------------------------------------------------
// Venture registry
// ---------------------------------------------------------------------------

export type VentureStage =
  | "idea"
  | "validation"
  | "build"
  | "launched"
  | "scaling"
  | "paused"
  | "shutting_down"
  | "closed"
  | "sold";

export interface Venture extends BaseRecord {
  key: string;
  name: string;
  /** Public-facing brand, which is deliberately not the holdco's name (§42). */
  brandName: string;
  stage: VentureStage;
  thesis: string;
  ownerUserId: string | null;
  domains: string[];
  /** Autonomy ceiling granted to every workflow in this venture. */
  maxAutonomyLevel: number;
  monthlyBudgetMinor: number;
  stopLossMinor: number;
  launchedAt: Date | null;
  closedAt: Date | null;
  /** Free-form record of why the venture is in its current stage. */
  stageReason: string | null;
  metadata: JsonObject;
}

export interface VentureMetricSnapshot extends BaseRecord {
  ventureId: string;
  periodKey: string;
  revenueMinor: number;
  cogsMinor: number;
  marketingSpendMinor: number;
  contractorSpendMinor: number;
  aiSpendMinor: number;
  otherSpendMinor: number;
  customerCount: number;
  activeSubscriptions: number;
  newCustomers: number;
  churnedCustomers: number;
  refundsMinor: number;
  receivablesMinor: number;
  supportCases: number;
  humanHours: number;
  automatedActions: number;
  manualActions: number;
  capturedAt: Date;
}

export interface VentureGateResult extends BaseRecord {
  ventureId: string;
  gate: "problem" | "offer" | "demand" | "economic" | "operational";
  passed: boolean;
  evidence: JsonObject;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  notes: string | null;
}

// ---------------------------------------------------------------------------
// CRM
// ---------------------------------------------------------------------------

export type AccountType =
  | "prospect"
  | "customer"
  | "vendor"
  | "partner"
  | "affiliate"
  | "contractor"
  | "investor";

export interface Account extends VentureOwned, RecordProvenance {
  name: string;
  type: AccountType;
  domain: string | null;
  industry: string | null;
  employeeCount: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  status: "active" | "inactive" | "churned";
  ownerUserId: string | null;
}

export interface Contact extends VentureOwned, RecordProvenance {
  accountId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  emailBlindIndex: string | null;
  phone: string | null;
  title: string | null;
  timezone: string | null;
  status: "active" | "unsubscribed" | "bounced" | "deleted";
}

export type LeadStatus =
  | "new"
  | "enriching"
  | "qualifying"
  | "qualified"
  | "disqualified"
  | "converted"
  | "duplicate"
  | "spam";

export interface Lead extends VentureOwned, RecordProvenance {
  contactId: string | null;
  accountId: string | null;
  campaignId: string | null;
  status: LeadStatus;
  score: number;
  scoreReasons: string[];
  intent: string | null;
  channel: string;
  /** Fingerprint used for duplicate detection. */
  dedupeKey: string;
  duplicateOfId: string | null;
  estimatedValueMinor: number | null;
  disqualifyReason: string | null;
  /** Buyer this lead was sold/routed to, for the lead-gen venture. */
  routedToAccountId: string | null;
  routedAt: Date | null;
  acceptedAt: Date | null;
  rejectedReason: string | null;
  payload: JsonObject;
}

export interface Opportunity extends VentureOwned, RecordProvenance {
  accountId: string;
  contactId: string | null;
  name: string;
  stage: "discovery" | "proposal" | "negotiation" | "won" | "lost";
  amountMinor: number;
  probability: number;
  expectedCloseDate: Date | null;
  closedAt: Date | null;
  lostReason: string | null;
  offerKey: string | null;
}

export interface Task extends VentureOwned {
  title: string;
  description: string | null;
  status: "open" | "in_progress" | "blocked" | "done" | "cancelled";
  priority: "low" | "normal" | "high" | "urgent";
  dueAt: Date | null;
  completedAt: Date | null;
  assignedUserId: string | null;
  assignedAgentId: string | null;
  relatedType: string | null;
  relatedId: string | null;
  createdBy: string;
  metadata: JsonObject;
}

export interface Note extends VentureOwned {
  body: string;
  authorType: "human" | "agent" | "system";
  authorId: string | null;
  relatedType: string;
  relatedId: string;
  metadata: JsonObject;
}

export type CommunicationChannel = "email" | "sms" | "call" | "meeting" | "chat" | "letter";

export interface Communication extends VentureOwned {
  channel: CommunicationChannel;
  direction: "inbound" | "outbound";
  status: "queued" | "sent" | "delivered" | "failed" | "bounced" | "suppressed" | "received";
  contactId: string | null;
  accountId: string | null;
  subject: string | null;
  body: string;
  fromAddress: string | null;
  toAddress: string | null;
  providerMessageId: string | null;
  providerName: string;
  failureReason: string | null;
  sentAt: Date | null;
  durationSeconds: number | null;
  recordingUrl: string | null;
  transcript: string | null;
  summary: string | null;
  workflowRunId: string | null;
  agentRunId: string | null;
  metadata: JsonObject;
}

export interface SupportCase extends VentureOwned {
  accountId: string | null;
  contactId: string | null;
  subject: string;
  description: string;
  status: "new" | "triaged" | "waiting_customer" | "escalated" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  category: string | null;
  assignedUserId: string | null;
  assignedAgentId: string | null;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  escalatedReason: string | null;
  satisfactionScore: number | null;
  metadata: JsonObject;
}

export interface Campaign extends VentureOwned {
  name: string;
  channel: string;
  status: "draft" | "active" | "paused" | "completed";
  budgetMinor: number;
  spendMinor: number;
  startsAt: Date | null;
  endsAt: Date | null;
  offerKey: string | null;
  metadata: JsonObject;
}

export interface Project extends VentureOwned {
  accountId: string | null;
  name: string;
  status: "planned" | "active" | "on_hold" | "delivered" | "cancelled";
  packageKey: string | null;
  contractValueMinor: number;
  deliveredValueMinor: number;
  startsAt: Date | null;
  dueAt: Date | null;
  completedAt: Date | null;
  ownerUserId: string | null;
  metadata: JsonObject;
}

export interface DocumentRecord extends VentureOwned {
  name: string;
  kind: "proposal" | "contract" | "report" | "invoice" | "audit" | "sop" | "other";
  status: "draft" | "review" | "final" | "signed" | "void";
  storageKey: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  relatedType: string | null;
  relatedId: string | null;
  generatedByAgentRunId: string | null;
  metadata: JsonObject;
}

// ---------------------------------------------------------------------------
// Automation: workflows, agents, approvals
// ---------------------------------------------------------------------------

export interface WorkflowDefinitionRecord extends VentureOwned {
  key: string;
  version: number;
  name: string;
  description: string;
  triggerType: string;
  /** Serialized WorkflowDefinition from @holdco/workflows. */
  definition: JsonObject;
  autonomyLevel: number;
  status: "draft" | "active" | "paused" | "archived";
  maxRunCostMinor: number;
  publishedAt: Date | null;
  publishedByUserId: string | null;
}

export interface WorkflowRunRecord extends VentureOwned {
  workflowKey: string;
  workflowVersion: number;
  status: "pending" | "running" | "waiting_approval" | "succeeded" | "failed" | "cancelled" | "dry_run";
  mode: "live" | "dry_run" | "mock";
  triggerType: string;
  triggerPayload: JsonObject;
  idempotencyKey: string | null;
  correlationId: string;
  startedAt: Date | null;
  finishedAt: Date | null;
  attempt: number;
  costMinor: number;
  error: JsonObject | null;
  output: JsonObject | null;
}

export interface WorkflowStepRunRecord extends BaseRecord {
  workflowRunId: string;
  stepId: string;
  index: number;
  actionKind: string;
  status: "pending" | "skipped" | "succeeded" | "failed" | "awaiting_approval" | "denied";
  input: JsonObject;
  output: JsonObject | null;
  error: JsonObject | null;
  approvalId: string | null;
  costMinor: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  attempts: number;
}

export interface AgentDefinitionRecord extends VentureOwned {
  key: string;
  version: number;
  name: string;
  role: string;
  objective: string;
  allowedTools: string[];
  prohibitedActions: string[];
  promptKey: string;
  promptVersion: number;
  modelConfig: JsonObject;
  costBudgetMinor: number;
  timeoutMs: number;
  maxRetries: number;
  autonomyLevel: number;
  escalationRules: JsonObject;
  status: "draft" | "active" | "paused" | "archived";
}

export interface AgentRunRecord extends VentureOwned {
  agentKey: string;
  agentVersion: number;
  status: "running" | "succeeded" | "failed" | "escalated" | "denied" | "budget_exceeded" | "timeout";
  mode: "live" | "mock";
  input: JsonObject;
  output: JsonObject | null;
  error: JsonObject | null;
  provider: string;
  model: string;
  promptKey: string;
  promptVersion: number;
  inputTokens: number;
  outputTokens: number;
  costMinor: number;
  latencyMs: number;
  toolCalls: JsonValue[];
  escalationReason: string | null;
  workflowRunId: string | null;
  correlationId: string;
  startedAt: Date;
  finishedAt: Date | null;
  /** Grading by the quality-control agent or a human reviewer. */
  qualityScore: number | null;
  reviewedByUserId: string | null;
}

export type ApprovalStatus = "pending" | "approved" | "denied" | "expired" | "cancelled";

export interface ApprovalRecord extends VentureOwned {
  actionKind: string;
  title: string;
  summary: string;
  /** Everything a human needs to decide, captured at request time (§32). */
  reason: string;
  evidence: JsonObject;
  financialImpactMinor: number;
  riskClass: string;
  reversible: boolean;
  status: ApprovalStatus;
  requestedBy: string;
  requestedByType: "agent" | "workflow" | "human" | "system";
  agentRunId: string | null;
  workflowRunId: string | null;
  deadlineAt: Date | null;
  decidedByUserId: string | null;
  decidedAt: Date | null;
  decisionNotes: string | null;
  /** The action payload replayed verbatim if approved. */
  payload: JsonObject;
}

export interface IdempotencyRecord extends BaseRecord {
  key: string;
  scope: string;
  resultRef: string | null;
  expiresAt: Date;
}

export interface DomainEventRecord extends VentureOwned {
  type: string;
  payload: JsonObject;
  occurredAt: Date;
  processedAt: Date | null;
  correlationId: string;
  source: string;
}

export interface ScheduledJobRecord extends VentureOwned {
  key: string;
  cron: string | null;
  runAt: Date;
  status: "scheduled" | "running" | "done" | "failed" | "cancelled";
  payload: JsonObject;
  attempts: number;
  lastError: string | null;
  lockedUntil: Date | null;
}

// ---------------------------------------------------------------------------
// Money: cost accounting and billing
// ---------------------------------------------------------------------------

export type CostCategory =
  | "ai_inference"
  | "marketing"
  | "contractor"
  | "software"
  | "telephony"
  | "data"
  | "payment_fees"
  | "hosting"
  | "other";

export interface CostEntryRecord extends VentureOwned {
  category: CostCategory;
  amountMinor: number;
  currency: string;
  description: string;
  incurredAt: Date;
  periodKey: string;
  /** Attribution dimensions — every expense must land on all that apply (§27). */
  customerAccountId: string | null;
  campaignId: string | null;
  productKey: string | null;
  experimentId: string | null;
  workflowRunId: string | null;
  agentRunId: string | null;
  vendorName: string | null;
  external: boolean;
  metadata: JsonObject;
}

export interface BudgetRecord extends VentureOwned {
  category: CostCategory | "all";
  periodKey: string;
  limitMinor: number;
  /** Hard budgets refuse work; soft budgets only alert. */
  enforcement: "hard" | "soft";
  setByUserId: string | null;
  notes: string | null;
}

export interface PlanRecord extends VentureOwned {
  key: string;
  name: string;
  description: string;
  billingInterval: "one_time" | "monthly" | "quarterly" | "annual";
  priceMinor: number;
  setupFeeMinor: number;
  includedUnits: number;
  overageUnitPriceMinor: number;
  unitName: string | null;
  status: "draft" | "active" | "retired";
}

export interface SubscriptionRecord extends VentureOwned {
  accountId: string;
  planKey: string;
  status: "trialing" | "active" | "past_due" | "paused" | "cancelled";
  quantity: number;
  startedAt: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  providerSubscriptionId: string | null;
  metadata: JsonObject;
}

export interface InvoiceRecord extends VentureOwned {
  accountId: string;
  number: string;
  status: "draft" | "open" | "paid" | "void" | "uncollectible";
  subtotalMinor: number;
  totalMinor: number;
  amountPaidMinor: number;
  currency: string;
  issuedAt: Date | null;
  dueAt: Date | null;
  paidAt: Date | null;
  lines: JsonValue[];
  subscriptionId: string | null;
  providerInvoiceId: string | null;
  notes: string | null;
}

export interface PaymentRecord extends VentureOwned {
  accountId: string;
  invoiceId: string | null;
  amountMinor: number;
  currency: string;
  status: "pending" | "succeeded" | "failed" | "refunded" | "disputed";
  method: string;
  provider: string;
  providerPaymentId: string | null;
  failureReason: string | null;
  refundedMinor: number;
  processedAt: Date | null;
  metadata: JsonObject;
}

// ---------------------------------------------------------------------------
// Compliance, knowledge, experiments, audit
// ---------------------------------------------------------------------------

export interface ConsentRecord extends VentureOwned {
  contactId: string | null;
  identifier: string;
  channel: CommunicationChannel | "all";
  status: ConsentStatus;
  basis: string;
  capturedAt: Date;
  capturedVia: string;
  evidence: JsonObject;
  expiresAt: Date | null;
  withdrawnAt: Date | null;
}

export interface SuppressionRecord extends BaseRecord {
  identifier: string;
  channel: CommunicationChannel | "all";
  reason: "unsubscribe" | "complaint" | "bounce" | "legal" | "manual" | "do_not_contact";
  ventureId: string | null;
  /** Global suppressions apply across every venture in the portfolio. */
  scope: "venture" | "organization" | "global";
  notes: string | null;
  expiresAt: Date | null;
}

export interface DataSubjectRequestRecord extends VentureOwned {
  identifier: string;
  kind: "access" | "deletion" | "correction" | "portability" | "opt_out";
  status: "received" | "verifying" | "in_progress" | "completed" | "rejected";
  receivedAt: Date;
  dueAt: Date;
  completedAt: Date | null;
  handledByUserId: string | null;
  notes: string | null;
}

export interface KnowledgeDocumentRecord extends VentureOwned {
  key: string;
  version: number;
  title: string;
  body: string;
  kind:
    | "policy"
    | "playbook"
    | "customer"
    | "product"
    | "sales_script"
    | "support"
    | "legal"
    | "brand"
    | "technical"
    | "postmortem"
    | "research";
  status: "draft" | "approved" | "expired" | "archived";
  ownerUserId: string | null;
  approvedByUserId: string | null;
  effectiveFrom: Date | null;
  expiresAt: Date | null;
  accountId: string | null;
  sourceUrls: string[];
  tags: string[];
}

export interface ExperimentRecord extends VentureOwned {
  key: string;
  hypothesis: string;
  customerDescription: string;
  problem: string;
  proposedSolution: string;
  acquisitionChannel: string;
  offer: string;
  priceMinor: number;
  budgetMinor: number;
  maxLossMinor: number;
  startsAt: Date;
  endsAt: Date;
  successMetric: string;
  successThreshold: string;
  failureMetric: string;
  failureThreshold: string;
  ownerUserId: string | null;
  status: "proposed" | "approved" | "running" | "review_due" | "decided";
  results: JsonObject | null;
  decision:
    | "scale"
    | "continue"
    | "modify"
    | "pause"
    | "shutdown"
    | "sell"
    | "merge"
    | null;
  decisionNotes: string | null;
  decidedAt: Date | null;
  spendMinor: number;
}

export interface AuditEventRecord extends VentureOwned {
  action: string;
  entityType: string;
  entityId: string | null;
  actorType: "human" | "agent" | "workflow" | "system" | "customer";
  actorId: string | null;
  summary: string;
  before: JsonObject | null;
  after: JsonObject | null;
  correlationId: string | null;
  ipAddress: string | null;
  occurredAt: Date;
  metadata: JsonObject;
}

export interface FlagOverrideRecord extends VentureOwned {
  key: string;
  value: boolean;
  reason: string;
  setByUserId: string | null;
  expiresAt: Date | null;
}

/** Every collection the store exposes, keyed by name. */
export interface EntityMap {
  organizations: Organization;
  users: User;
  memberships: Membership;
  sessions: Session;
  apiKeys: ApiKey;
  ventures: Venture;
  ventureMetricSnapshots: VentureMetricSnapshot;
  ventureGateResults: VentureGateResult;
  accounts: Account;
  contacts: Contact;
  leads: Lead;
  opportunities: Opportunity;
  tasks: Task;
  notes: Note;
  communications: Communication;
  supportCases: SupportCase;
  campaigns: Campaign;
  projects: Project;
  documents: DocumentRecord;
  workflowDefinitions: WorkflowDefinitionRecord;
  workflowRuns: WorkflowRunRecord;
  workflowStepRuns: WorkflowStepRunRecord;
  agentDefinitions: AgentDefinitionRecord;
  agentRuns: AgentRunRecord;
  approvals: ApprovalRecord;
  idempotencyRecords: IdempotencyRecord;
  domainEvents: DomainEventRecord;
  scheduledJobs: ScheduledJobRecord;
  costEntries: CostEntryRecord;
  budgets: BudgetRecord;
  plans: PlanRecord;
  subscriptions: SubscriptionRecord;
  invoices: InvoiceRecord;
  payments: PaymentRecord;
  consents: ConsentRecord;
  suppressions: SuppressionRecord;
  dataSubjectRequests: DataSubjectRequestRecord;
  knowledgeDocuments: KnowledgeDocumentRecord;
  experiments: ExperimentRecord;
  auditEvents: AuditEventRecord;
  flagOverrides: FlagOverrideRecord;
}

export type EntityName = keyof EntityMap;
