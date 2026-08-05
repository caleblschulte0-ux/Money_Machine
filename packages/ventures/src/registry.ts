import {
  errors,
  monthKey,
  newId,
  systemClock,
  type AutonomyLevel,
  type Clock,
  type JsonObject,
} from "@holdco/core";
import type {
  Store,
  Venture,
  VentureGateResult,
  VentureMetricSnapshot,
  VentureStage,
} from "@holdco/database";
import { AUDIT_ACTIONS, AuditLog, type AuditActor } from "@holdco/audit";
import { evaluateGate, evaluateLaunchReadiness, gateEvidenceToJson, type GateEvidence, type GateKey } from "./launch-gate.ts";

/**
 * Allowed venture stage transitions.
 *
 * The graph is deliberately restrictive: a venture cannot jump from `idea` to
 * `launched`, and `closed`/`sold` are terminal. Reopening a closed venture
 * means creating a new one, which keeps its history honest.
 */
const TRANSITIONS: Record<VentureStage, readonly VentureStage[]> = {
  idea: ["validation", "closed"],
  validation: ["build", "paused", "closed"],
  build: ["launched", "paused", "shutting_down"],
  launched: ["scaling", "paused", "shutting_down", "sold"],
  scaling: ["launched", "paused", "shutting_down", "sold"],
  paused: ["validation", "build", "launched", "shutting_down", "sold", "closed"],
  shutting_down: ["closed", "sold"],
  closed: [],
  sold: [],
};

/** Stages that require every launch gate to have passed. */
const GATED_STAGES: readonly VentureStage[] = ["build", "launched", "scaling"];

export interface CreateVentureInput {
  organizationId: string;
  key: string;
  name: string;
  brandName: string;
  thesis: string;
  ownerUserId?: string | null;
  domains?: string[];
  maxAutonomyLevel?: AutonomyLevel;
  monthlyBudgetMinor?: number;
  stopLossMinor?: number;
  metadata?: JsonObject;
}

export class VentureRegistry {
  constructor(
    private readonly store: Store,
    private readonly audit: AuditLog,
    private readonly clock: Clock = systemClock,
  ) {}

  async create(input: CreateVentureInput, actor: AuditActor): Promise<Venture> {
    if (!/^[a-z][a-z0-9-]{2,40}$/.test(input.key)) {
      throw errors.validation(
        "Venture key must be lowercase, start with a letter, and use only letters, digits and hyphens",
        { key: input.key },
      );
    }
    const existing = await this.store.ventures.findFirst({
      where: { organizationId: input.organizationId, key: input.key },
    });
    if (existing) throw errors.conflict(`Venture "${input.key}" already exists`);

    const venture = await this.store.ventures.create({
      id: newId("vnt", this.clock.epochMillis()),
      organizationId: input.organizationId,
      key: input.key,
      name: input.name,
      brandName: input.brandName,
      stage: "idea",
      thesis: input.thesis,
      ownerUserId: input.ownerUserId ?? null,
      domains: input.domains ?? [],
      maxAutonomyLevel: input.maxAutonomyLevel ?? 2,
      monthlyBudgetMinor: input.monthlyBudgetMinor ?? 0,
      stopLossMinor: input.stopLossMinor ?? 0,
      launchedAt: null,
      closedAt: null,
      stageReason: "Created",
      metadata: input.metadata ?? {},
    });

    await this.audit.record({
      scope: { organizationId: input.organizationId },
      ventureId: venture.id,
      action: AUDIT_ACTIONS.ventureCreated,
      entityType: "venture",
      entityId: venture.id,
      actor,
      summary: `Created venture "${venture.name}" (${venture.key})`,
      after: { key: venture.key, stage: venture.stage, thesis: venture.thesis },
    });

    return venture;
  }

  async get(organizationId: string, key: string): Promise<Venture | null> {
    return this.store.ventures.findFirst({ where: { organizationId, key } });
  }

  async require(organizationId: string, key: string): Promise<Venture> {
    const venture = await this.get(organizationId, key);
    if (!venture) throw errors.notFound("venture", key);
    return venture;
  }

  async list(organizationId: string, stages?: readonly VentureStage[]): Promise<readonly Venture[]> {
    return this.store.ventures.all({
      where: stages ? { organizationId, stage: { in: stages } } : { organizationId },
      orderBy: { field: "key", direction: "asc" },
    });
  }

  /** Ventures that are actively operating and should appear in rollups. */
  async active(organizationId: string): Promise<readonly Venture[]> {
    return this.list(organizationId, ["launched", "scaling"]);
  }

  async recordGate(input: {
    organizationId: string;
    ventureId: string;
    gate: GateKey;
    evidence: GateEvidence;
    reviewedByUserId?: string | null;
    notes?: string;
  }, actor: AuditActor): Promise<VentureGateResult> {
    const evaluation = evaluateGate(input.gate, input.evidence);
    const now = this.clock.now();

    const result = await this.store.ventureGateResults.create({
      id: newId("evt", now.getTime()),
      organizationId: input.organizationId,
      ventureId: input.ventureId,
      gate: input.gate,
      passed: evaluation.passed,
      evidence: gateEvidenceToJson(input.evidence),
      reviewedByUserId: input.reviewedByUserId ?? null,
      reviewedAt: input.reviewedByUserId ? now : null,
      notes: [input.notes, ...evaluation.notes].filter(Boolean).join(" ") || null,
    });

    await this.audit.record({
      scope: { organizationId: input.organizationId },
      ventureId: input.ventureId,
      action: AUDIT_ACTIONS.ventureGateRecorded,
      entityType: "venture_gate",
      entityId: result.id,
      actor,
      summary: `Gate "${input.gate}" ${evaluation.passed ? "passed" : "failed"}`,
      after: {
        passed: evaluation.passed,
        missing: [...evaluation.missing],
        satisfied: [...evaluation.satisfied],
      },
    });

    return result;
  }

  /** Latest result per gate. */
  async gateResults(ventureId: string): Promise<Record<GateKey, VentureGateResult | undefined>> {
    const all = await this.store.ventureGateResults.all({
      where: { ventureId },
      orderBy: { field: "createdAt", direction: "asc" },
    });
    const latest: Partial<Record<GateKey, VentureGateResult>> = {};
    for (const result of all) latest[result.gate] = result;
    return latest as Record<GateKey, VentureGateResult | undefined>;
  }

  async launchReadiness(ventureId: string): Promise<ReturnType<typeof evaluateLaunchReadiness>> {
    const results = await this.gateResults(ventureId);
    const evidenceByGate: Partial<Record<GateKey, GateEvidence>> = {};
    for (const [gate, result] of Object.entries(results)) {
      if (result) evidenceByGate[gate as GateKey] = result.evidence as GateEvidence;
    }
    return evaluateLaunchReadiness(evidenceByGate);
  }

  /**
   * Move a venture along its lifecycle.
   *
   * Refuses illegal transitions and refuses to enter a gated stage while any
   * launch gate is unmet. `force` exists for the owner to override with a
   * recorded reason — it is audited as an override, not as a normal move.
   */
  async transition(input: {
    organizationId: string;
    ventureId: string;
    to: VentureStage;
    reason: string;
    force?: boolean;
  }, actor: AuditActor): Promise<Venture> {
    const venture = await this.store.ventures.require(input.ventureId);
    if (venture.organizationId !== input.organizationId) {
      throw errors.forbidden("Venture belongs to a different organization");
    }
    if (!input.reason.trim()) {
      throw errors.validation("A stage change requires a reason");
    }
    if (venture.stage === input.to) return venture;

    const allowed = TRANSITIONS[venture.stage];
    if (!allowed.includes(input.to)) {
      throw errors.conflict(
        `Cannot move venture from "${venture.stage}" to "${input.to}". Allowed: ${allowed.join(", ") || "(terminal stage)"}`,
        { from: venture.stage, to: input.to },
      );
    }

    if (GATED_STAGES.includes(input.to)) {
      const readiness = await this.launchReadiness(input.ventureId);
      if (!readiness.ready && !input.force) {
        throw errors.policyViolation(
          `Venture cannot enter "${input.to}" until every launch gate passes. ` +
            `Blocking gates: ${readiness.blockingGates.join(", ")}.`,
          { blockingGates: [...readiness.blockingGates] },
        );
      }
    }

    const now = this.clock.now();
    const patch: Partial<Venture> = {
      stage: input.to,
      stageReason: input.force ? `[OVERRIDE] ${input.reason}` : input.reason,
    };
    if (input.to === "launched" && !venture.launchedAt) patch.launchedAt = now;
    if (input.to === "closed" || input.to === "sold") patch.closedAt = now;

    const updated = await this.store.ventures.update(venture.id, patch);

    await this.audit.record({
      scope: { organizationId: input.organizationId },
      ventureId: venture.id,
      action: AUDIT_ACTIONS.ventureStageChanged,
      entityType: "venture",
      entityId: venture.id,
      actor,
      summary: `Venture "${venture.key}" moved ${venture.stage} → ${input.to}${input.force ? " (gate override)" : ""}`,
      before: { stage: venture.stage },
      after: { stage: input.to, reason: input.reason, forced: input.force ?? false },
    });

    return updated;
  }

  async setBudget(input: {
    organizationId: string;
    ventureId: string;
    monthlyBudgetMinor: number;
    stopLossMinor?: number;
    maxAutonomyLevel?: AutonomyLevel;
  }, actor: AuditActor): Promise<Venture> {
    const venture = await this.store.ventures.require(input.ventureId);
    const patch: Partial<Venture> = { monthlyBudgetMinor: input.monthlyBudgetMinor };
    if (input.stopLossMinor !== undefined) patch.stopLossMinor = input.stopLossMinor;
    if (input.maxAutonomyLevel !== undefined) patch.maxAutonomyLevel = input.maxAutonomyLevel;

    const updated = await this.store.ventures.update(venture.id, patch);
    await this.audit.record({
      scope: { organizationId: input.organizationId },
      ventureId: venture.id,
      action: "venture.budget_set",
      entityType: "venture",
      entityId: venture.id,
      actor,
      summary: `Budget set for "${venture.key}"`,
      before: {
        monthlyBudgetMinor: venture.monthlyBudgetMinor,
        stopLossMinor: venture.stopLossMinor,
        maxAutonomyLevel: venture.maxAutonomyLevel,
      },
      after: {
        monthlyBudgetMinor: updated.monthlyBudgetMinor,
        stopLossMinor: updated.stopLossMinor,
        maxAutonomyLevel: updated.maxAutonomyLevel,
      },
    });
    return updated;
  }

  async recordSnapshot(
    input: Omit<VentureMetricSnapshot, "id" | "createdAt" | "updatedAt" | "periodKey" | "capturedAt"> & {
      periodKey?: string;
      capturedAt?: Date;
    },
  ): Promise<VentureMetricSnapshot> {
    const capturedAt = input.capturedAt ?? this.clock.now();
    const periodKey = input.periodKey ?? monthKey(capturedAt);
    const existing = await this.store.ventureMetricSnapshots.findFirst({
      where: { ventureId: input.ventureId, periodKey },
    });
    if (existing) {
      return this.store.ventureMetricSnapshots.update(existing.id, { ...input, capturedAt });
    }
    return this.store.ventureMetricSnapshots.create({
      ...input,
      id: newId("evt", capturedAt.getTime()),
      periodKey,
      capturedAt,
    });
  }

  async snapshot(ventureId: string, periodKey: string): Promise<VentureMetricSnapshot | null> {
    return this.store.ventureMetricSnapshots.findFirst({ where: { ventureId, periodKey } });
  }

  async snapshots(ventureId: string, limit = 12): Promise<readonly VentureMetricSnapshot[]> {
    const page = await this.store.ventureMetricSnapshots.list({
      where: { ventureId },
      orderBy: { field: "periodKey", direction: "desc" },
      page: { limit },
    });
    return page.items;
  }
}
