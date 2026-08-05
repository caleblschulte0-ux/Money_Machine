# Metrics

## North star

**Audits sold.** Every other number is downstream of whether someone will pay
to find out what is possible.

## Tracked

| Metric | Unit | Why it matters |
| --- | --- | --- |
| `audits_sold` | count | The north star |
| `audit_to_implementation_rate` | ratio | Whether the audit qualifies or just consumes time |
| `delivery_hours_per_audit` | hours | **The number that decides whether this scales** |
| `gross_margin` | ratio | Revenue minus delivery labour, contractor and AI cost |
| `monthly_retainer_mrr` | currency | The recurring base |

## Delivery hours per audit

The single most important number in this venture.

The bet is that it falls sharply across the first ten audits as workflows,
prompts and templates mature. If audit ten takes as long as audit three, this
is a consultancy that scales with headcount — a fine business, but not one that
funds a portfolio.

Target trajectory:

| Audit | Target hours |
| --- | --- |
| 1–3 | 40+ (expected; learning) |
| 4–6 | 30 |
| 7–10 | 20 |
| 11+ | under 15 |

Not falling 30% by the tenth audit is a kill criterion.

## Portfolio-level metrics

The venture also feeds the standard health dimensions: revenue growth, gross
margin, retention, concentration, CAC, payback, support burden, automation
level, founder dependence.

**Customer concentration matters more here than elsewhere.** With five clients
at $12,000/month, one leaving is a 20% revenue cut. That dimension has weight 2
in the health score and currently has no automatic source — it must be entered.

## Where the numbers come from

| Source | Provides |
| --- | --- |
| CRM | Leads, scores, opportunities, conversion |
| Billing | Subscriptions, invoices, MRR |
| Cost ledger | AI, contractor and software cost, attributed per customer |
| Metric snapshots | Monthly revenue, customers, churn, human hours |

Human hours are **entered, not measured** — nothing tracks a person's time.
Since founder dependence is a kill criterion, that number depends on someone
being honest with themselves.

## Reviewed

Weekly: leads, scores, conversion, pipeline.
Monthly: snapshot, health score, kill criteria, cost per customer.
Per audit: delivery hours, logged immediately while the number is known.
