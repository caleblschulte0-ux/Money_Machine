import { errors, money, newId, systemClock, type Clock, type JsonObject, type Money } from "@holdco/core";
import type { ExperimentRecord, Store } from "@holdco/database";
import { AUDIT_ACTIONS, AuditLog, type AuditActor } from "@holdco/audit";

/**
 * Experimentation system (playbook §28).
 *
 * The section's real requirement is the last line: *prevent experiments from
 * quietly turning into permanent expenses without review*. That is enforced
 * here by `reviewDue()` and by refusing to create an experiment without an
 * end date, a maximum loss and both a success and a failure metric.
 */
export interface CreateExperimentInput {
  organizationId: string;
  ventureId: string | null;
  key: string;
  hypothesis: string;
  customerDescription: string;
  problem: string;
  proposedSolution: string;
  acquisitionChannel: string;
  offer: string;
  price: Money;
  budget: Money;
  maxLoss: Money;
  startsAt: Date;
  endsAt: Date;
  successMetric: string;
  successThreshold: string;
  failureMetric: string;
  failureThreshold: string;
  ownerUserId?: string | null;
}

export type ExperimentDecision = NonNullable<ExperimentRecord["decision"]>;

export const EXPERIMENT_DECISIONS: readonly ExperimentDecision[] = [
  "scale", "continue", "modify", "pause", "shutdown", "sell", "merge",
];

export interface ExperimentStatusReport {
  readonly experiment: ExperimentRecord;
  readonly spend: Money;
  readonly budgetRemaining: Money;
  readonly lossHeadroom: Money;
  readonly daysRemaining: number;
  readonly reviewDue: boolean;
  readonly reasons: readonly string[];
}

export class ExperimentService {
  constructor(
    private readonly store: Store,
    private readonly audit: AuditLog,
    private readonly clock: Clock = systemClock,
  ) {}

  async create(input: CreateExperimentInput, actor: AuditActor): Promise<ExperimentRecord> {
    if (input.endsAt.getTime() <= input.startsAt.getTime()) {
      throw errors.validation("An experiment must end after it starts");
    }
    if (input.maxLoss.amountMinor <= 0) {
      throw errors.validation(
        "An experiment must declare a maximum loss. An experiment with no loss limit is a budget line, not an experiment.",
      );
    }
    if (!input.failureMetric.trim() || !input.failureThreshold.trim()) {
      throw errors.validation(
        "An experiment must declare how it will be judged to have failed, not only how it succeeds.",
      );
    }

    const duplicate = await this.store.experiments.findFirst({
      where: { organizationId: input.organizationId, key: input.key },
    });
    if (duplicate) throw errors.conflict(`Experiment "${input.key}" already exists`);

    const experiment = await this.store.experiments.create({
      id: newId("exp", this.clock.epochMillis()),
      organizationId: input.organizationId,
      ventureId: input.ventureId,
      key: input.key,
      hypothesis: input.hypothesis,
      customerDescription: input.customerDescription,
      problem: input.problem,
      proposedSolution: input.proposedSolution,
      acquisitionChannel: input.acquisitionChannel,
      offer: input.offer,
      priceMinor: input.price.amountMinor,
      budgetMinor: input.budget.amountMinor,
      maxLossMinor: input.maxLoss.amountMinor,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      successMetric: input.successMetric,
      successThreshold: input.successThreshold,
      failureMetric: input.failureMetric,
      failureThreshold: input.failureThreshold,
      ownerUserId: input.ownerUserId ?? null,
      status: "proposed",
      results: null,
      decision: null,
      decisionNotes: null,
      decidedAt: null,
      spendMinor: 0,
    });

    await this.audit.record({
      scope: { organizationId: input.organizationId },
      ventureId: input.ventureId,
      action: "experiment.created",
      entityType: "experiment",
      entityId: experiment.id,
      actor,
      summary: `Created experiment "${input.key}"`,
      after: {
        hypothesis: input.hypothesis,
        maxLossMinor: input.maxLoss.amountMinor,
        endsAt: input.endsAt.toISOString(),
      },
    });

    return experiment;
  }

  async start(experimentId: string, actor: AuditActor): Promise<ExperimentRecord> {
    const experiment = await this.store.experiments.require(experimentId);
    if (experiment.status !== "proposed" && experiment.status !== "approved") {
      throw errors.conflict(`Experiment is ${experiment.status} and cannot be started`);
    }
    const updated = await this.store.experiments.update(experimentId, { status: "running" });
    await this.audit.record({
      scope: { organizationId: experiment.organizationId },
      ventureId: experiment.ventureId,
      action: "experiment.started",
      entityType: "experiment",
      entityId: experimentId,
      actor,
      summary: `Started experiment "${experiment.key}"`,
    });
    return updated;
  }

  /** Spend recorded against an experiment, taken from the cost ledger. */
  async spend(experiment: ExperimentRecord): Promise<Money> {
    const entries = await this.store.costEntries.all({
      where: { organizationId: experiment.organizationId, experimentId: experiment.id },
    });
    return money(entries.reduce((sum, e) => sum + e.amountMinor, 0));
  }

  async status(experimentId: string): Promise<ExperimentStatusReport> {
    const experiment = await this.store.experiments.require(experimentId);
    const spend = await this.spend(experiment);
    const now = this.clock.now();
    const daysRemaining = Math.ceil((experiment.endsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    const reasons: string[] = [];

    if (experiment.status === "running" && now.getTime() > experiment.endsAt.getTime()) {
      reasons.push("The experiment has passed its end date without a decision.");
    }
    if (spend.amountMinor >= experiment.maxLossMinor) {
      reasons.push(
        `Spend $${(spend.amountMinor / 100).toFixed(2)} has reached the declared maximum loss of $${(experiment.maxLossMinor / 100).toFixed(2)}.`,
      );
    }
    if (experiment.budgetMinor > 0 && spend.amountMinor >= experiment.budgetMinor) {
      reasons.push("The experiment budget is exhausted.");
    }

    return {
      experiment,
      spend,
      budgetRemaining: money(Math.max(0, experiment.budgetMinor - spend.amountMinor)),
      lossHeadroom: money(Math.max(0, experiment.maxLossMinor - spend.amountMinor)),
      daysRemaining,
      reviewDue: reasons.length > 0,
      reasons,
    };
  }

  /**
   * Every running experiment that has hit its end date, budget or loss limit.
   * The command center surfaces these; the worker flags them daily.
   */
  async reviewDue(organizationId: string): Promise<readonly ExperimentStatusReport[]> {
    const running = await this.store.experiments.all({
      where: { organizationId, status: { in: ["running", "review_due"] } } as never,
    });
    const reports: ExperimentStatusReport[] = [];
    for (const experiment of running) {
      const report = await this.status(experiment.id);
      if (report.reviewDue) {
        if (experiment.status !== "review_due") {
          await this.store.experiments.update(experiment.id, { status: "review_due" });
        }
        reports.push(report);
      }
    }
    return reports;
  }

  async decide(input: {
    experimentId: string;
    decision: ExperimentDecision;
    notes: string;
    results?: JsonObject;
  }, actor: AuditActor): Promise<ExperimentRecord> {
    if (actor.type !== "human") {
      throw errors.forbidden("Experiment decisions are made by humans, not by agents");
    }
    if (!input.notes.trim()) {
      throw errors.validation("An experiment decision must record its reasoning");
    }
    const experiment = await this.store.experiments.require(input.experimentId);
    const spend = await this.spend(experiment);

    const updated = await this.store.experiments.update(input.experimentId, {
      status: "decided",
      decision: input.decision,
      decisionNotes: input.notes,
      decidedAt: this.clock.now(),
      results: input.results ?? experiment.results,
      spendMinor: spend.amountMinor,
    });

    await this.audit.record({
      scope: { organizationId: experiment.organizationId },
      ventureId: experiment.ventureId,
      action: AUDIT_ACTIONS.experimentDecided,
      entityType: "experiment",
      entityId: input.experimentId,
      actor,
      summary: `Experiment "${experiment.key}" decided: ${input.decision}`,
      before: { status: experiment.status },
      after: { decision: input.decision, notes: input.notes, spendMinor: spend.amountMinor },
    });

    return updated;
  }

  async list(
    organizationId: string,
    filter: { ventureId?: string | null; status?: ExperimentRecord["status"] } = {},
  ): Promise<readonly ExperimentRecord[]> {
    const where: Record<string, unknown> = { organizationId };
    if (filter.ventureId !== undefined) where["ventureId"] = filter.ventureId;
    if (filter.status) where["status"] = filter.status;
    return this.store.experiments.all({
      where: where as never,
      orderBy: { field: "startsAt", direction: "desc" },
    });
  }
}
