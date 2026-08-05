import {
  monthKey,
  money,
  systemClock,
  type Clock,
  type Money,
} from "@holdco/core";
import type { Store, Venture, VentureStage } from "@holdco/database";
import { CostLedger } from "@holdco/cost-accounting";
import { BillingService } from "@holdco/billing";
import { computeVentureHealth, evaluateKillCriteria, type VentureHealth } from "@holdco/ventures";

/**
 * Portfolio analytics for the command center (playbook §5).
 *
 * Every figure here is derived from recorded events — cost entries,
 * subscriptions, snapshots — never estimated. Where a figure cannot be
 * derived, the field is `null` and the UI says "not measured" rather than
 * showing a zero that reads like a fact.
 */
export interface VenturePortfolioRow {
  readonly ventureId: string;
  readonly ventureKey: string;
  readonly name: string;
  readonly brandName: string;
  readonly stage: VentureStage;
  readonly revenue: Money | null;
  readonly grossProfit: Money | null;
  readonly netContribution: Money | null;
  readonly spend: Money;
  readonly aiSpend: Money;
  readonly marketingSpend: Money;
  readonly contractorSpend: Money;
  readonly mrr: Money;
  readonly customerCount: number | null;
  readonly activeSubscriptions: number;
  readonly churnedCustomers: number | null;
  readonly refunds: Money | null;
  readonly receivables: Money | null;
  readonly humanHours: number | null;
  readonly automationPercent: number | null;
  readonly health: VentureHealth | null;
  readonly killRecommendation: "continue" | "review" | "shutdown_recommended" | null;
  readonly warnings: readonly string[];
}

export interface PortfolioSummary {
  readonly periodKey: string;
  readonly ventures: readonly VenturePortfolioRow[];
  readonly counts: Record<VentureStage, number>;
  readonly totalRevenue: Money;
  readonly totalGrossProfit: Money;
  readonly totalNetContribution: Money;
  readonly totalSpend: Money;
  readonly totalAiSpend: Money;
  readonly cashBurn: Money;
  readonly pendingApprovals: number;
  readonly openSupportCases: number;
  readonly measurementGaps: readonly string[];
  readonly disclaimer: string;
}

const DISCLAIMER =
  "Internal management figures derived from recorded platform events. " +
  "Not audited financial statements and not a substitute for bookkeeping.";

export class AnalyticsService {
  constructor(
    private readonly store: Store,
    private readonly costs: CostLedger,
    private readonly billing: BillingService,
    private readonly clock: Clock = systemClock,
  ) {}

  async portfolio(organizationId: string, periodKey?: string): Promise<PortfolioSummary> {
    const period = periodKey ?? monthKey(this.clock.now());
    const ventures = await this.store.ventures.all({
      where: { organizationId },
      orderBy: { field: "key", direction: "asc" },
    });

    const rows: VenturePortfolioRow[] = [];
    const measurementGaps: string[] = [];

    for (const venture of ventures) {
      rows.push(await this.ventureRow(venture, period, measurementGaps));
    }

    const counts = {} as Record<VentureStage, number>;
    for (const venture of ventures) {
      counts[venture.stage] = (counts[venture.stage] ?? 0) + 1;
    }

    const sum = (pick: (r: VenturePortfolioRow) => Money | null): Money =>
      money(rows.reduce((total, row) => total + (pick(row)?.amountMinor ?? 0), 0));

    const totalRevenue = sum((r) => r.revenue);
    const totalSpend = sum((r) => r.spend);
    const holdcoSpend = await this.costs.total({ organizationId, ventureId: null, periodKey: period });

    const pendingApprovals = await this.store.approvals.count({ organizationId, status: "pending" });
    const openSupportCases = await this.store.supportCases.count({
      organizationId,
      status: { in: ["new", "triaged", "waiting_customer", "escalated"] },
    } as never);

    return {
      periodKey: period,
      ventures: rows,
      counts,
      totalRevenue,
      totalGrossProfit: sum((r) => r.grossProfit),
      totalNetContribution: sum((r) => r.netContribution),
      totalSpend: money(totalSpend.amountMinor + holdcoSpend.amountMinor),
      totalAiSpend: sum((r) => r.aiSpend),
      cashBurn: money(totalSpend.amountMinor + holdcoSpend.amountMinor - totalRevenue.amountMinor),
      pendingApprovals,
      openSupportCases,
      measurementGaps,
      disclaimer: DISCLAIMER,
    };
  }

  private async ventureRow(
    venture: Venture,
    periodKey: string,
    measurementGaps: string[],
  ): Promise<VenturePortfolioRow> {
    const byCategory = await this.costs.byCategory(venture.organizationId, periodKey, venture.id);
    const spend = money(
      Object.values(byCategory).reduce((sum, value) => sum + value.amountMinor, 0),
    );
    const mrr = await this.billing.monthlyRecurringRevenue(venture.organizationId, venture.id);
    const activeSubscriptions = await this.store.subscriptions.count({
      organizationId: venture.organizationId,
      ventureId: venture.id,
      status: { in: ["active", "trialing"] },
    } as never);

    const snapshot = await this.store.ventureMetricSnapshots.findFirst({
      where: { ventureId: venture.id, periodKey },
    });

    if (!snapshot) {
      measurementGaps.push(
        `${venture.key}: no metric snapshot for ${periodKey}; revenue, retention and automation are unmeasured.`,
      );
      return {
        ventureId: venture.id,
        ventureKey: venture.key,
        name: venture.name,
        brandName: venture.brandName,
        stage: venture.stage,
        revenue: null,
        grossProfit: null,
        netContribution: null,
        spend,
        aiSpend: byCategory.ai_inference ?? money(0),
        marketingSpend: byCategory.marketing ?? money(0),
        contractorSpend: byCategory.contractor ?? money(0),
        mrr,
        customerCount: null,
        activeSubscriptions,
        churnedCustomers: null,
        refunds: null,
        receivables: null,
        humanHours: null,
        automationPercent: null,
        health: null,
        killRecommendation: null,
        warnings: [`No metric snapshot recorded for ${periodKey}.`],
      };
    }

    const previousKey = this.previousPeriod(periodKey);
    const previous = await this.store.ventureMetricSnapshots.findFirst({
      where: { ventureId: venture.id, periodKey: previousKey },
    });

    const health = computeVentureHealth({
      ventureId: venture.id,
      current: snapshot,
      previous,
    });

    const kill = evaluateKillCriteria({
      snapshot,
      previous,
      stopLossMinor: venture.stopLossMinor || undefined,
    });

    const totalActions = snapshot.automatedActions + snapshot.manualActions;

    return {
      ventureId: venture.id,
      ventureKey: venture.key,
      name: venture.name,
      brandName: venture.brandName,
      stage: venture.stage,
      revenue: money(snapshot.revenueMinor),
      grossProfit: health.grossProfit,
      netContribution: health.netContribution,
      spend,
      aiSpend: byCategory.ai_inference ?? money(snapshot.aiSpendMinor),
      marketingSpend: byCategory.marketing ?? money(snapshot.marketingSpendMinor),
      contractorSpend: byCategory.contractor ?? money(snapshot.contractorSpendMinor),
      mrr,
      customerCount: snapshot.customerCount,
      activeSubscriptions,
      churnedCustomers: snapshot.churnedCustomers,
      refunds: money(snapshot.refundsMinor),
      receivables: money(snapshot.receivablesMinor),
      humanHours: snapshot.humanHours,
      automationPercent: totalActions > 0 ? snapshot.automatedActions / totalActions : null,
      health,
      killRecommendation: kill.recommendation,
      warnings: [...health.warnings, ...kill.triggered.map((t) => `${t.label}: ${t.detail}`)],
    };
  }

  private previousPeriod(periodKey: string): string {
    const [year, month] = periodKey.split("-").map(Number);
    const date = new Date(Date.UTC(year!, month! - 1, 1));
    date.setUTCMonth(date.getUTCMonth() - 1);
    return monthKey(date);
  }

  /** Workflow and agent reliability, for the operations panel. */
  async automationHealth(organizationId: string, sinceDays = 7): Promise<{
    workflowRuns: number;
    workflowFailures: number;
    agentRuns: number;
    agentFailures: number;
    escalations: number;
    failureRate: number | null;
  }> {
    const since = new Date(this.clock.epochMillis() - sinceDays * 24 * 60 * 60 * 1000);
    const runs = await this.store.workflowRuns.all({
      where: { organizationId, createdAt: { gte: since } } as never,
    });
    const agentRuns = await this.store.agentRuns.all({
      where: { organizationId, createdAt: { gte: since } } as never,
    });

    const workflowFailures = runs.filter((r) => r.status === "failed").length;
    const agentFailures = agentRuns.filter((r) =>
      ["failed", "timeout", "budget_exceeded", "denied"].includes(r.status),
    ).length;
    const total = runs.length + agentRuns.length;

    return {
      workflowRuns: runs.length,
      workflowFailures,
      agentRuns: agentRuns.length,
      agentFailures,
      escalations: agentRuns.filter((r) => r.status === "escalated").length,
      failureRate: total === 0 ? null : (workflowFailures + agentFailures) / total,
    };
  }
}
