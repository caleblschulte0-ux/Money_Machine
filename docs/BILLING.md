# Billing

`packages/billing` can price, subscribe, invoice and record payments. It
**does not move money**, and that is enforced twice.

## The double gate on charging

```ts
await platform.billing.charge({ ... });
// throws unless BOTH:
//   1. feature.billing_charges is enabled (ships false), and
//   2. a payment adapter exists that can actually move money
```

The only adapter that ships is `MockPaymentProvider`, which records intent and
returns success without contacting a processor. Its payments carry
`metadata.movesMoney: false`, and the audit entry says
"(mock adapter — no money moved)". `UnimplementedPaymentProvider` throws with a
message naming what is missing.

A misconfigured environment therefore cannot take a customer's money by
accident: it would need a written adapter, `ALLOW_PAID_PROVIDERS`, *and* the
feature flag.

## Model

| Entity | Notes |
| --- | --- |
| `Plan` | Key, price, interval (`one_time`/`monthly`/`quarterly`/`annual`), setup fee, included units, overage rate |
| `Subscription` | Account + plan + quantity + period window + cancellation reason |
| `Invoice` | Sequential number (`INV-2026-00001`), lines, totals, amount paid |
| `Payment` | Amount, status, provider, refunds |

Money is integer minor units everywhere. There is no float in the billing path.

## MRR

`monthlyRecurringRevenue()` normalises intervals — quarterly ÷ 3, annual ÷ 12 —
and **excludes one-time revenue entirely**. An audit fee is not recurring
revenue, and counting it as MRR is the most common way a services business
convinces itself it has a subscription business.

## Revenue and cost together

Billing answers "what did they pay"; `@holdco/cost-accounting` answers "what did
it cost to serve them". Both key on `accountId`, so:

```ts
const revenue = await billing.monthlyRecurringRevenue(orgId, ventureId);
const costs   = await costs.byCustomer(orgId, "2026-03", ventureId);
```

gives per-customer gross margin, which is the number that decides whether a
plan is priced correctly.

## Not built

Dunning, proration, tax, revenue recognition schedules, refund workflows, and
customer-facing invoices. Invoices are internal records; there is no PDF and no
delivery. See `docs/KNOWN_LIMITATIONS.md`.

Internal figures are management reporting, never audited financial statements.
