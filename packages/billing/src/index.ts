import {
  errors,
  money,
  newId,
  systemClock,
  type Clock,
  type JsonValue,
  type Money,
} from "@holdco/core";
import type {
  InvoiceRecord,
  PaymentRecord,
  PlanRecord,
  Store,
  SubscriptionRecord,
} from "@holdco/database";
import type { FlagRegistry } from "@holdco/config";
import { AuditLog, type AuditActor } from "@holdco/audit";

/**
 * Billing primitives (playbook §27).
 *
 * The platform can price, invoice and record payments. It does **not** move
 * money: charging requires both `feature.billing_charges` and a payment
 * adapter, and the only adapter that ships is a mock that records intent
 * without contacting a processor.
 */
export interface PaymentIntent {
  readonly amount: Money;
  readonly accountId: string;
  readonly invoiceId: string | null;
  readonly description: string;
}

export interface PaymentProvider {
  readonly name: string;
  /** True when the adapter can actually move money. */
  readonly movesMoney: boolean;
  charge(intent: PaymentIntent): Promise<{ providerPaymentId: string; status: "succeeded" | "failed"; failureReason?: string }>;
  refund(providerPaymentId: string, amount: Money): Promise<{ refundedMinor: number }>;
}

export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";
  readonly movesMoney = false;
  readonly charges: PaymentIntent[] = [];
  readonly refunds: Array<{ providerPaymentId: string; amount: Money }> = [];

  async charge(intent: PaymentIntent) {
    this.charges.push(intent);
    return { providerPaymentId: `mock-pay-${this.charges.length}`, status: "succeeded" as const };
  }

  async refund(providerPaymentId: string, amount: Money) {
    this.refunds.push({ providerPaymentId, amount });
    return { refundedMinor: amount.amountMinor };
  }
}

export class UnimplementedPaymentProvider implements PaymentProvider {
  readonly movesMoney = true;
  constructor(readonly name: string) {}
  async charge(): Promise<never> {
    throw errors.providerDisabled(
      `The "${this.name}" payment adapter is not implemented. Do not enable live billing ` +
        `until it exists, is tested against the vendor's test mode, and the owner has approved it.`,
    );
  }
  async refund(): Promise<never> {
    throw errors.providerDisabled(`The "${this.name}" payment adapter is not implemented.`);
  }
}

export interface BillingDeps {
  store: Store;
  audit: AuditLog;
  flags: FlagRegistry;
  payments: PaymentProvider;
  clock?: Clock;
}

export interface InvoiceLine {
  readonly description: string;
  readonly quantity: number;
  readonly unitPriceMinor: number;
  readonly amountMinor: number;
}

export class BillingService {
  private readonly clock: Clock;

  constructor(private readonly deps: BillingDeps) {
    this.clock = deps.clock ?? systemClock;
  }

  async createPlan(input: Omit<PlanRecord, "id" | "createdAt" | "updatedAt">): Promise<PlanRecord> {
    const existing = await this.deps.store.plans.findFirst({
      where: { organizationId: input.organizationId, key: input.key },
    });
    if (existing) throw errors.conflict(`Plan "${input.key}" already exists`);
    return this.deps.store.plans.create({
      ...input,
      id: newId("sub", this.clock.epochMillis()),
    });
  }

  async subscribe(input: {
    organizationId: string;
    ventureId: string | null;
    accountId: string;
    planKey: string;
    quantity?: number;
    trialDays?: number;
  }): Promise<SubscriptionRecord> {
    const plan = await this.deps.store.plans.findFirst({
      where: { organizationId: input.organizationId, key: input.planKey },
    });
    if (!plan) throw errors.notFound("plan", input.planKey);
    if (plan.status !== "active") {
      throw errors.conflict(`Plan "${plan.key}" is ${plan.status} and cannot be subscribed to`);
    }

    const now = this.clock.now();
    const periodEnd = this.nextPeriodEnd(now, plan.billingInterval);

    return this.deps.store.subscriptions.create({
      id: newId("sub", now.getTime()),
      organizationId: input.organizationId,
      ventureId: input.ventureId,
      accountId: input.accountId,
      planKey: plan.key,
      status: input.trialDays && input.trialDays > 0 ? "trialing" : "active",
      quantity: input.quantity ?? 1,
      startedAt: now,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAt: null,
      cancelledAt: null,
      cancelReason: null,
      providerSubscriptionId: null,
      metadata: {},
    });
  }

  async cancelSubscription(
    subscriptionId: string,
    reason: string,
    actor: AuditActor,
  ): Promise<SubscriptionRecord> {
    const subscription = await this.deps.store.subscriptions.require(subscriptionId);
    const updated = await this.deps.store.subscriptions.update(subscriptionId, {
      status: "cancelled",
      cancelledAt: this.clock.now(),
      cancelReason: reason,
    });
    await this.deps.audit.record({
      scope: { organizationId: subscription.organizationId },
      ventureId: subscription.ventureId,
      action: "subscription.cancelled",
      entityType: "subscription",
      entityId: subscriptionId,
      actor,
      summary: `Subscription cancelled: ${reason}`,
      before: { status: subscription.status },
      after: { status: "cancelled", reason },
    });
    return updated;
  }

  async createInvoice(input: {
    organizationId: string;
    ventureId: string | null;
    accountId: string;
    lines: readonly InvoiceLine[];
    subscriptionId?: string | null;
    dueInDays?: number;
    notes?: string;
  }): Promise<InvoiceRecord> {
    if (input.lines.length === 0) throw errors.validation("An invoice needs at least one line");

    const subtotal = input.lines.reduce((sum, l) => sum + l.amountMinor, 0);
    const now = this.clock.now();
    const count = await this.deps.store.invoices.count({ organizationId: input.organizationId });

    return this.deps.store.invoices.create({
      id: newId("inv", now.getTime()),
      organizationId: input.organizationId,
      ventureId: input.ventureId,
      accountId: input.accountId,
      number: `INV-${now.getUTCFullYear()}-${String(count + 1).padStart(5, "0")}`,
      status: "draft",
      subtotalMinor: subtotal,
      totalMinor: subtotal,
      amountPaidMinor: 0,
      currency: "USD",
      issuedAt: null,
      dueAt: input.dueInDays
        ? new Date(now.getTime() + input.dueInDays * 24 * 60 * 60 * 1000)
        : null,
      paidAt: null,
      lines: input.lines as unknown as JsonValue[],
      subscriptionId: input.subscriptionId ?? null,
      providerInvoiceId: null,
      notes: input.notes ?? null,
    });
  }

  async issueInvoice(invoiceId: string, actor: AuditActor): Promise<InvoiceRecord> {
    const invoice = await this.deps.store.invoices.require(invoiceId);
    if (invoice.status !== "draft") throw errors.conflict(`Invoice is ${invoice.status}`);
    const updated = await this.deps.store.invoices.update(invoiceId, {
      status: "open",
      issuedAt: this.clock.now(),
    });
    await this.deps.audit.record({
      scope: { organizationId: invoice.organizationId },
      ventureId: invoice.ventureId,
      action: "invoice.issued",
      entityType: "invoice",
      entityId: invoiceId,
      actor,
      summary: `Issued invoice ${invoice.number} for $${(invoice.totalMinor / 100).toFixed(2)}`,
    });
    return updated;
  }

  /**
   * Record a payment. Charging is gated twice — by the feature flag and by the
   * adapter's own capability — so a misconfigured environment cannot take a
   * customer's money by accident.
   */
  async charge(input: {
    organizationId: string;
    ventureId: string | null;
    accountId: string;
    invoiceId?: string | null;
    amount: Money;
    description: string;
    actor: AuditActor;
  }): Promise<PaymentRecord> {
    const flagContext = {
      organizationId: input.organizationId,
      ventureId: input.ventureId ?? undefined,
    };
    if (!this.deps.flags.isEnabled("feature.billing_charges", flagContext)) {
      throw errors.providerDisabled(
        "Live billing is disabled (feature.billing_charges). Enabling it is an owner decision.",
      );
    }

    const result = await this.deps.payments.charge({
      amount: input.amount,
      accountId: input.accountId,
      invoiceId: input.invoiceId ?? null,
      description: input.description,
    });

    const payment = await this.deps.store.payments.create({
      id: newId("pay", this.clock.epochMillis()),
      organizationId: input.organizationId,
      ventureId: input.ventureId,
      accountId: input.accountId,
      invoiceId: input.invoiceId ?? null,
      amountMinor: input.amount.amountMinor,
      currency: input.amount.currency,
      status: result.status,
      method: "card",
      provider: this.deps.payments.name,
      providerPaymentId: result.providerPaymentId,
      failureReason: result.failureReason ?? null,
      refundedMinor: 0,
      processedAt: this.clock.now(),
      metadata: { movesMoney: this.deps.payments.movesMoney },
    });

    if (result.status === "succeeded" && input.invoiceId) {
      const invoice = await this.deps.store.invoices.require(input.invoiceId);
      const paid = invoice.amountPaidMinor + input.amount.amountMinor;
      await this.deps.store.invoices.update(input.invoiceId, {
        amountPaidMinor: paid,
        status: paid >= invoice.totalMinor ? "paid" : invoice.status,
        paidAt: paid >= invoice.totalMinor ? this.clock.now() : invoice.paidAt,
      });
    }

    await this.deps.audit.record({
      scope: { organizationId: input.organizationId },
      ventureId: input.ventureId,
      action: "payment.recorded",
      entityType: "payment",
      entityId: payment.id,
      actor: input.actor,
      summary:
        `Payment ${result.status} for $${(input.amount.amountMinor / 100).toFixed(2)} ` +
        `via ${this.deps.payments.name}` +
        (this.deps.payments.movesMoney ? "" : " (mock adapter — no money moved)"),
    });

    return payment;
  }

  /** Monthly recurring revenue from active subscriptions, by venture. */
  async monthlyRecurringRevenue(
    organizationId: string,
    ventureId?: string | null,
  ): Promise<Money> {
    const where: Record<string, unknown> = {
      organizationId,
      status: { in: ["active", "trialing"] },
    };
    if (ventureId !== undefined) where["ventureId"] = ventureId;

    const subscriptions = await this.deps.store.subscriptions.all({ where: where as never });
    const plans = await this.deps.store.plans.all({ where: { organizationId } });
    const planByKey = new Map(plans.map((p) => [p.key, p]));

    let total = 0;
    for (const subscription of subscriptions) {
      const plan = planByKey.get(subscription.planKey);
      if (!plan) continue;
      const monthly =
        plan.billingInterval === "monthly"
          ? plan.priceMinor
          : plan.billingInterval === "quarterly"
            ? Math.round(plan.priceMinor / 3)
            : plan.billingInterval === "annual"
              ? Math.round(plan.priceMinor / 12)
              : 0; // one-time revenue is not recurring
      total += monthly * subscription.quantity;
    }
    return money(total);
  }

  private nextPeriodEnd(from: Date, interval: PlanRecord["billingInterval"]): Date {
    const end = new Date(from);
    switch (interval) {
      case "monthly":
        end.setUTCMonth(end.getUTCMonth() + 1);
        break;
      case "quarterly":
        end.setUTCMonth(end.getUTCMonth() + 3);
        break;
      case "annual":
        end.setUTCFullYear(end.getUTCFullYear() + 1);
        break;
      case "one_time":
        break;
    }
    return end;
  }
}

export function createPaymentProvider(selection: {
  provider: "mock" | "stripe";
  allowPaidProviders: boolean;
}): PaymentProvider {
  if (selection.provider === "mock") return new MockPaymentProvider();
  if (!selection.allowPaidProviders) {
    throw errors.providerDisabled(
      `PAYMENT_PROVIDER=${selection.provider} requires ALLOW_PAID_PROVIDERS=true.`,
    );
  }
  return new UnimplementedPaymentProvider(selection.provider);
}
