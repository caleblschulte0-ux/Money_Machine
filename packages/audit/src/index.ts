import {
  newId,
  redact,
  systemClock,
  type Clock,
  type JsonObject,
  type TenantScope,
} from "@holdco/core";
import type { AuditEventRecord, Store } from "@holdco/database";

/**
 * Audit logging (playbook rule 30: "build every system so a human can inspect
 * what happened").
 *
 * Two properties matter more than completeness:
 *  - every entry names an *actor type* — human, agent, workflow, system or
 *    customer — because "who did this" is the first question in a postmortem;
 *  - payloads are redacted before storage, so the audit trail is safe to read
 *    without exposing secrets.
 */
export type ActorType = AuditEventRecord["actorType"];

export interface AuditActor {
  type: ActorType;
  id?: string | null;
  /** Human-readable label shown in the command center. */
  label?: string;
}

export interface RecordAuditInput {
  scope: Pick<TenantScope, "organizationId" | "correlationId">;
  ventureId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  actor: AuditActor;
  summary: string;
  before?: JsonObject | null;
  after?: JsonObject | null;
  ipAddress?: string | null;
  metadata?: JsonObject;
}

export interface AuditQuery {
  organizationId: string;
  ventureId?: string | null;
  entityType?: string;
  entityId?: string;
  action?: string;
  actorId?: string;
  since?: Date;
  limit?: number;
}

export class AuditLog {
  constructor(
    private readonly store: Store,
    private readonly clock: Clock = systemClock,
  ) {}

  async record(input: RecordAuditInput): Promise<AuditEventRecord> {
    const now = this.clock.now();
    return this.store.auditEvents.create({
      id: newId("aud", now.getTime()),
      organizationId: input.scope.organizationId,
      ventureId: input.ventureId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      actorType: input.actor.type,
      actorId: input.actor.id ?? null,
      summary: input.summary,
      before: input.before ? (redact(input.before) as JsonObject) : null,
      after: input.after ? (redact(input.after) as JsonObject) : null,
      correlationId: input.scope.correlationId ?? null,
      ipAddress: input.ipAddress ?? null,
      occurredAt: now,
      metadata: {
        ...(input.actor.label ? { actorLabel: input.actor.label } : {}),
        ...(redact(input.metadata ?? {}) as JsonObject),
      },
    });
  }

  /**
   * Convenience wrapper that records the before/after of a mutation. Use it in
   * services so the diff is captured without every call site remembering to.
   */
  async recordChange<T extends JsonObject>(
    input: Omit<RecordAuditInput, "before" | "after">,
    before: T | null,
    after: T | null,
  ): Promise<AuditEventRecord> {
    return this.record({ ...input, before, after });
  }

  async query(query: AuditQuery): Promise<readonly AuditEventRecord[]> {
    const where: Record<string, unknown> = { organizationId: query.organizationId };
    if (query.ventureId !== undefined) where["ventureId"] = query.ventureId;
    if (query.entityType) where["entityType"] = query.entityType;
    if (query.entityId) where["entityId"] = query.entityId;
    if (query.action) where["action"] = query.action;
    if (query.actorId) where["actorId"] = query.actorId;
    if (query.since) where["occurredAt"] = { gte: query.since };

    const page = await this.store.auditEvents.list({
      where: where as never,
      orderBy: { field: "occurredAt", direction: "desc" },
      page: { limit: query.limit ?? 50 },
    });
    return page.items;
  }

  /** Full history for one entity, oldest first — the "what happened here" view. */
  async history(
    organizationId: string,
    entityType: string,
    entityId: string,
  ): Promise<readonly AuditEventRecord[]> {
    return this.store.auditEvents.all({
      where: { organizationId, entityType, entityId } as never,
      orderBy: { field: "occurredAt", direction: "asc" },
    });
  }
}

/** Canonical action names. Keeping them in one list keeps the audit filterable. */
export const AUDIT_ACTIONS = {
  userLogin: "user.login",
  userLoginFailed: "user.login_failed",
  userLogout: "user.logout",
  membershipGranted: "membership.granted",
  membershipRevoked: "membership.revoked",
  ventureCreated: "venture.created",
  ventureStageChanged: "venture.stage_changed",
  ventureGateRecorded: "venture.gate_recorded",
  recordCreated: "record.created",
  recordUpdated: "record.updated",
  recordDeleted: "record.deleted",
  leadScored: "lead.scored",
  leadRouted: "lead.routed",
  workflowPublished: "workflow.published",
  workflowRunStarted: "workflow.run_started",
  workflowRunFinished: "workflow.run_finished",
  workflowKilled: "workflow.killed",
  agentRunStarted: "agent.run_started",
  agentRunFinished: "agent.run_finished",
  agentEscalated: "agent.escalated",
  approvalRequested: "approval.requested",
  approvalDecided: "approval.decided",
  costRecorded: "cost.recorded",
  budgetExceeded: "budget.exceeded",
  communicationSent: "communication.sent",
  communicationSuppressed: "communication.suppressed",
  consentCaptured: "consent.captured",
  suppressionAdded: "suppression.added",
  dataExported: "data.exported",
  experimentDecided: "experiment.decided",
  flagOverridden: "flag.overridden",
} as const;
