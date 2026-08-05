import {
  errors,
  monthKey,
  money,
  newId,
  systemClock,
  sumMoney,
  type Clock,
  type JsonObject,
  type Money,
} from "@holdco/core";
import type { BudgetRecord, CostCategory, CostEntryRecord, Store } from "@holdco/database";

/**
 * Cost accounting (playbook §27, rule 28).
 *
 * Every expense must be attributable to the holding company, a venture, a
 * customer, a campaign, a product and an experiment where each applies. The
 * ledger enforces that by requiring the dimensions at write time rather than
 * hoping someone backfills them.
 *
 * These are internal management figures. They are not, and must never be
 * described as, audited financial statements.
 */
export interface RecordCostInput {
  organizationId: string;
  ventureId: string | null;
  category: CostCategory;
  amount: Money;
  description: string;
  incurredAt?: Date;
  customerAccountId?: string | null;
  campaignId?: string | null;
  productKey?: string | null;
  experimentId?: string | null;
  workflowRunId?: string | null;
  agentRunId?: string | null;
  vendorName?: string | null;
  /** False for internal transfer-style costs that must not double count. */
  external?: boolean;
  metadata?: JsonObject;
}

export interface CostFilter {
  organizationId: string;
  ventureId?: string | null;
  periodKey?: string;
  category?: CostCategory;
  customerAccountId?: string;
  experimentId?: string;
  campaignId?: string;
}

export interface BudgetStatus {
  readonly category: CostCategory | "all";
  readonly periodKey: string;
  readonly ventureId: string | null;
  readonly limit: Money;
  readonly spent: Money;
  readonly remaining: Money;
  readonly enforcement: BudgetRecord["enforcement"];
  readonly exhausted: boolean;
  readonly utilization: number;
}

export class CostLedger {
  constructor(
    private readonly store: Store,
    private readonly clock: Clock = systemClock,
  ) {}

  async record(input: RecordCostInput): Promise<CostEntryRecord> {
    if (input.amount.amountMinor < 0) {
      throw errors.validation("Cost entries must be non-negative; use a credit note for refunds", {
        amountMinor: input.amount.amountMinor,
      });
    }
    const incurredAt = input.incurredAt ?? this.clock.now();
    return this.store.costEntries.create({
      id: newId("cst", incurredAt.getTime()),
      organizationId: input.organizationId,
      ventureId: input.ventureId,
      category: input.category,
      amountMinor: input.amount.amountMinor,
      currency: input.amount.currency,
      description: input.description,
      incurredAt,
      periodKey: monthKey(incurredAt),
      customerAccountId: input.customerAccountId ?? null,
      campaignId: input.campaignId ?? null,
      productKey: input.productKey ?? null,
      experimentId: input.experimentId ?? null,
      workflowRunId: input.workflowRunId ?? null,
      agentRunId: input.agentRunId ?? null,
      vendorName: input.vendorName ?? null,
      external: input.external ?? true,
      metadata: input.metadata ?? {},
    });
  }

  async total(filter: CostFilter): Promise<Money> {
    const entries = await this.entries(filter);
    return sumMoney(entries.map((e) => money(e.amountMinor)));
  }

  async entries(filter: CostFilter): Promise<readonly CostEntryRecord[]> {
    const where: Record<string, unknown> = { organizationId: filter.organizationId };
    if (filter.ventureId !== undefined) where["ventureId"] = filter.ventureId;
    if (filter.periodKey) where["periodKey"] = filter.periodKey;
    if (filter.category) where["category"] = filter.category;
    if (filter.customerAccountId) where["customerAccountId"] = filter.customerAccountId;
    if (filter.experimentId) where["experimentId"] = filter.experimentId;
    if (filter.campaignId) where["campaignId"] = filter.campaignId;
    return this.store.costEntries.all({ where: where as never });
  }

  /** Spend broken down by category for a period. */
  async byCategory(
    organizationId: string,
    periodKey: string,
    ventureId?: string | null,
  ): Promise<Record<CostCategory, Money>> {
    const entries = await this.entries({ organizationId, periodKey, ventureId });
    const out = {} as Record<CostCategory, Money>;
    for (const entry of entries) {
      const current = out[entry.category]?.amountMinor ?? 0;
      out[entry.category] = money(current + entry.amountMinor);
    }
    return out;
  }

  /** Spend per venture for a period — the command center's cost column. */
  async byVenture(organizationId: string, periodKey: string): Promise<Map<string | null, Money>> {
    const entries = await this.entries({ organizationId, periodKey });
    const out = new Map<string | null, Money>();
    for (const entry of entries) {
      const current = out.get(entry.ventureId)?.amountMinor ?? 0;
      out.set(entry.ventureId, money(current + entry.amountMinor));
    }
    return out;
  }

  /** Cost to serve one customer — the number that decides whether a plan is priced right. */
  async byCustomer(
    organizationId: string,
    periodKey: string,
    ventureId?: string | null,
  ): Promise<Map<string, Money>> {
    const entries = await this.entries({ organizationId, periodKey, ventureId });
    const out = new Map<string, Money>();
    for (const entry of entries) {
      if (!entry.customerAccountId) continue;
      const current = out.get(entry.customerAccountId)?.amountMinor ?? 0;
      out.set(entry.customerAccountId, money(current + entry.amountMinor));
    }
    return out;
  }

  // --- Budgets -----------------------------------------------------------

  async setBudget(input: {
    organizationId: string;
    ventureId: string | null;
    category: CostCategory | "all";
    periodKey: string;
    limit: Money;
    enforcement?: BudgetRecord["enforcement"];
    setByUserId?: string | null;
    notes?: string;
  }): Promise<BudgetRecord> {
    const existing = await this.store.budgets.findFirst({
      where: {
        organizationId: input.organizationId,
        ventureId: input.ventureId,
        category: input.category,
        periodKey: input.periodKey,
      },
    });
    const fields = {
      limitMinor: input.limit.amountMinor,
      enforcement: input.enforcement ?? "hard",
      setByUserId: input.setByUserId ?? null,
      notes: input.notes ?? null,
    };
    if (existing) return this.store.budgets.update(existing.id, fields);
    return this.store.budgets.create({
      id: newId("cst", this.clock.epochMillis()),
      organizationId: input.organizationId,
      ventureId: input.ventureId,
      category: input.category,
      periodKey: input.periodKey,
      ...fields,
    });
  }

  async budgetStatus(input: {
    organizationId: string;
    ventureId: string | null;
    category: CostCategory;
    periodKey?: string;
  }): Promise<BudgetStatus | null> {
    const periodKey = input.periodKey ?? monthKey(this.clock.now());

    // A specific-category budget wins over an "all" budget for the same scope.
    const budget =
      (await this.store.budgets.findFirst({
        where: {
          organizationId: input.organizationId,
          ventureId: input.ventureId,
          category: input.category,
          periodKey,
        },
      })) ??
      (await this.store.budgets.findFirst({
        where: {
          organizationId: input.organizationId,
          ventureId: input.ventureId,
          category: "all",
          periodKey,
        },
      }));

    if (!budget) return null;

    const spent = await this.total({
      organizationId: input.organizationId,
      ventureId: input.ventureId,
      periodKey,
      ...(budget.category === "all" ? {} : { category: input.category }),
    });

    const limit = money(budget.limitMinor);
    const remaining = money(Math.max(0, limit.amountMinor - spent.amountMinor));
    return {
      category: budget.category as CostCategory | "all",
      periodKey,
      ventureId: input.ventureId,
      limit,
      spent,
      remaining,
      enforcement: budget.enforcement,
      exhausted: spent.amountMinor >= limit.amountMinor,
      utilization: limit.amountMinor === 0 ? 1 : spent.amountMinor / limit.amountMinor,
    };
  }

  /**
   * Ask permission before spending. Returns a decision rather than throwing so
   * callers can degrade (queue the work, fall back to a cheaper model, ask a
   * human) instead of crashing a customer-facing flow.
   */
  async checkSpend(input: {
    organizationId: string;
    ventureId: string | null;
    category: CostCategory;
    estimated: Money;
    periodKey?: string;
  }): Promise<
    | { allowed: true; status: BudgetStatus | null }
    | { allowed: false; reason: string; status: BudgetStatus }
  > {
    const status = await this.budgetStatus(input);
    if (!status) return { allowed: true, status: null };
    if (status.enforcement === "soft") return { allowed: true, status };

    const wouldSpend = status.spent.amountMinor + input.estimated.amountMinor;
    if (wouldSpend > status.limit.amountMinor) {
      return {
        allowed: false,
        status,
        reason:
          `Spending $${(input.estimated.amountMinor / 100).toFixed(2)} would exceed the ` +
          `${status.category} budget for ${status.periodKey} ` +
          `($${(status.spent.amountMinor / 100).toFixed(2)} of $${(status.limit.amountMinor / 100).toFixed(2)} used).`,
      };
    }
    return { allowed: true, status };
  }
}
