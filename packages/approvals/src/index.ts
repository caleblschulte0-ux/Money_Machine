import {
  decideAutonomy,
  errors,
  money,
  newId,
  riskClassFor,
  systemClock,
  type AutonomyLevel,
  type Clock,
  type JsonObject,
  type Money,
} from "@holdco/core";
import type { ApprovalRecord, ApprovalStatus, Store } from "@holdco/database";
import { AUDIT_ACTIONS, AuditLog, type AuditActor } from "@holdco/audit";

/**
 * The single human approval queue (playbook §32).
 *
 * Everything that needs a human decision lands here — contracts, payments,
 * refunds, campaign launches, expensive AI jobs, new vendors, data exports,
 * venture activation, capital allocation. One queue rather than per-feature
 * prompts, so an owner has exactly one place to look.
 *
 * The approval carries the *payload* of the action so that approving replays
 * the original request verbatim. Nothing is re-derived at approval time, which
 * is what stops an approval from silently applying to a changed action.
 */
export interface RequestApprovalInput {
  organizationId: string;
  ventureId: string | null;
  actionKind: string;
  title: string;
  /** One sentence a busy human can decide from. */
  summary: string;
  /** Why the system is asking rather than acting. */
  reason: string;
  /** Everything relevant to the decision: numbers, records, prior context. */
  evidence?: JsonObject;
  financialImpact?: Money;
  reversible?: boolean;
  requestedBy: string;
  requestedByType: ApprovalRecord["requestedByType"];
  agentRunId?: string | null;
  workflowRunId?: string | null;
  deadlineAt?: Date | null;
  /** Replayed verbatim on approval. */
  payload: JsonObject;
}

export interface DecideApprovalInput {
  approvalId: string;
  decidedByUserId: string;
  decision: "approved" | "denied";
  notes?: string;
}

export interface ApprovalGateInput {
  organizationId: string;
  ventureId: string | null;
  actionKind: string;
  grantedLevel: AutonomyLevel;
  financialImpact?: Money;
  approvalThreshold?: Money;
  reversible?: boolean;
}

export type ApprovalGateResult =
  | { outcome: "execute" }
  | { outcome: "needs_approval"; reason: string; riskClass: string }
  | { outcome: "denied"; reason: string; riskClass: string };

export class ApprovalService {
  constructor(
    private readonly store: Store,
    private readonly audit: AuditLog,
    private readonly clock: Clock = systemClock,
    private readonly defaultThreshold: Money = money(10_000),
  ) {}

  /**
   * Decide whether an action may run unattended. This is the function every
   * executor calls before doing anything with an effect.
   */
  gate(input: ApprovalGateInput): ApprovalGateResult {
    const decision = decideAutonomy({
      actionKind: input.actionKind,
      grantedLevel: input.grantedLevel,
      financialImpact: input.financialImpact,
      approvalThreshold: input.approvalThreshold ?? this.defaultThreshold,
      reversible: input.reversible,
    });

    switch (decision.outcome) {
      case "execute":
        return { outcome: "execute" };
      case "require_approval":
        return { outcome: "needs_approval", reason: decision.reason, riskClass: decision.risk };
      case "deny":
        return { outcome: "denied", reason: decision.reason, riskClass: decision.risk };
    }
  }

  async request(input: RequestApprovalInput, actor: AuditActor): Promise<ApprovalRecord> {
    if (!input.reason.trim() || !input.summary.trim()) {
      throw errors.validation("An approval request must state a summary and a reason");
    }
    const riskClass = riskClassFor(input.actionKind);
    if (riskClass === "prohibited") {
      throw errors.policyViolation(
        `Action "${input.actionKind}" is prohibited from automated execution and cannot be queued for approval. ` +
          `A human must perform it directly, outside the automation.`,
        { actionKind: input.actionKind },
      );
    }

    const now = this.clock.now();
    const approval = await this.store.approvals.create({
      id: newId("apr", now.getTime()),
      organizationId: input.organizationId,
      ventureId: input.ventureId,
      actionKind: input.actionKind,
      title: input.title,
      summary: input.summary,
      reason: input.reason,
      evidence: input.evidence ?? {},
      financialImpactMinor: input.financialImpact?.amountMinor ?? 0,
      riskClass,
      reversible: input.reversible ?? true,
      status: "pending",
      requestedBy: input.requestedBy,
      requestedByType: input.requestedByType,
      agentRunId: input.agentRunId ?? null,
      workflowRunId: input.workflowRunId ?? null,
      deadlineAt: input.deadlineAt ?? null,
      decidedByUserId: null,
      decidedAt: null,
      decisionNotes: null,
      payload: input.payload,
    });

    await this.audit.record({
      scope: { organizationId: input.organizationId },
      ventureId: input.ventureId,
      action: AUDIT_ACTIONS.approvalRequested,
      entityType: "approval",
      entityId: approval.id,
      actor,
      summary: `Approval requested: ${input.title}`,
      after: {
        actionKind: input.actionKind,
        riskClass,
        financialImpactMinor: approval.financialImpactMinor,
        reversible: approval.reversible,
      },
    });

    return approval;
  }

  /**
   * Record a human decision. Deliberately requires a user id — an agent or a
   * workflow can never decide an approval, and the RBAC layer refuses to grant
   * `approval:decide` to the agent role.
   */
  async decide(input: DecideApprovalInput, actor: AuditActor): Promise<ApprovalRecord> {
    if (actor.type !== "human") {
      throw errors.forbidden("Only a human actor may decide an approval", { actorType: actor.type });
    }
    const approval = await this.store.approvals.require(input.approvalId);
    if (approval.status !== "pending") {
      throw errors.conflict(`Approval is already ${approval.status}`, {
        approvalId: approval.id,
        status: approval.status,
      });
    }
    if (approval.deadlineAt && approval.deadlineAt.getTime() < this.clock.epochMillis()) {
      await this.store.approvals.update(approval.id, { status: "expired" });
      throw errors.conflict("Approval deadline has passed; the request expired", {
        approvalId: approval.id,
      });
    }

    const updated = await this.store.approvals.update(approval.id, {
      status: input.decision,
      decidedByUserId: input.decidedByUserId,
      decidedAt: this.clock.now(),
      decisionNotes: input.notes ?? null,
    });

    await this.audit.record({
      scope: { organizationId: approval.organizationId },
      ventureId: approval.ventureId,
      action: AUDIT_ACTIONS.approvalDecided,
      entityType: "approval",
      entityId: approval.id,
      actor,
      summary: `Approval ${input.decision}: ${approval.title}`,
      before: { status: approval.status },
      after: { status: input.decision, notes: input.notes ?? null },
    });

    return updated;
  }

  async cancel(approvalId: string, reason: string, actor: AuditActor): Promise<ApprovalRecord> {
    const approval = await this.store.approvals.require(approvalId);
    if (approval.status !== "pending") {
      throw errors.conflict(`Approval is already ${approval.status}`);
    }
    const updated = await this.store.approvals.update(approvalId, {
      status: "cancelled",
      decisionNotes: reason,
      decidedAt: this.clock.now(),
    });
    await this.audit.record({
      scope: { organizationId: approval.organizationId },
      ventureId: approval.ventureId,
      action: AUDIT_ACTIONS.approvalDecided,
      entityType: "approval",
      entityId: approvalId,
      actor,
      summary: `Approval cancelled: ${reason}`,
      after: { status: "cancelled" },
    });
    return updated;
  }

  async get(approvalId: string): Promise<ApprovalRecord | null> {
    return this.store.approvals.get(approvalId);
  }

  async pending(
    organizationId: string,
    filter: { ventureId?: string | null; limit?: number } = {},
  ): Promise<readonly ApprovalRecord[]> {
    const where: Record<string, unknown> = { organizationId, status: "pending" };
    if (filter.ventureId !== undefined) where["ventureId"] = filter.ventureId;
    const page = await this.store.approvals.list({
      where: where as never,
      orderBy: { field: "createdAt", direction: "asc" },
      page: { limit: filter.limit ?? 50 },
    });
    return page.items;
  }

  async byStatus(
    organizationId: string,
    status: ApprovalStatus,
    limit = 50,
  ): Promise<readonly ApprovalRecord[]> {
    const page = await this.store.approvals.list({
      where: { organizationId, status },
      orderBy: { field: "createdAt", direction: "desc" },
      page: { limit },
    });
    return page.items;
  }

  /**
   * Expire overdue requests. Run by the worker; an approval that sits past its
   * deadline must not stay actionable, because the context it was decided
   * against is stale.
   */
  async expireOverdue(organizationId: string): Promise<number> {
    const now = this.clock.now();
    const overdue = await this.store.approvals.all({
      where: {
        organizationId,
        status: "pending",
        deadlineAt: { lt: now, not: null },
      } as never,
    });
    for (const approval of overdue) {
      await this.store.approvals.update(approval.id, { status: "expired" });
      await this.audit.record({
        scope: { organizationId },
        ventureId: approval.ventureId,
        action: AUDIT_ACTIONS.approvalDecided,
        entityType: "approval",
        entityId: approval.id,
        actor: { type: "system" },
        summary: `Approval expired without a decision: ${approval.title}`,
        after: { status: "expired" },
      });
    }
    return overdue.length;
  }

  /** Queue statistics for the command center header. */
  async summary(organizationId: string): Promise<{
    pending: number;
    oldestPendingAgeMs: number | null;
    pendingFinancialImpact: Money;
    overdue: number;
  }> {
    const pending = await this.store.approvals.all({
      where: { organizationId, status: "pending" },
      orderBy: { field: "createdAt", direction: "asc" },
    });
    const now = this.clock.epochMillis();
    return {
      pending: pending.length,
      oldestPendingAgeMs: pending[0] ? now - pending[0].createdAt.getTime() : null,
      pendingFinancialImpact: money(
        pending.reduce((sum, a) => sum + a.financialImpactMinor, 0),
      ),
      overdue: pending.filter((a) => a.deadlineAt && a.deadlineAt.getTime() < now).length,
    };
  }
}
