# Business model

## Revenue

**Paid audit ($2,500, one-time).** A two-week review of up to eight named
processes. Sold as a real product, not a free consultation — a prospect
unwilling to pay $2,500 to find out what is possible will not pay $12,000/month
to do it. The audit is the qualification.

**Implementation and management ($12,000/month + $2,500 setup).** The recurring
revenue. Implementation of the agreed automations for one department, with
monitoring and a monthly before/after report against the audit baseline.

**Usage fees.** Passed-through AI inference above an included allowance, at
cost plus margin. Tracked per customer through the cost ledger, so this is
measured, not estimated.

## Cost structure

| Cost | Nature | Notes |
| --- | --- | --- |
| Delivery labour | Variable | The number that decides whether this scales |
| Contractor implementation | Variable | Early on, most of delivery |
| AI inference | Variable | Attributed per customer via `costEntries` |
| Software the client does not have | Pass-through | Never absorbed |
| Sales time | Variable | Falls as case studies accumulate |

Target gross margin: 50%+. Below that for two consecutive months is a kill
criterion.

## The economic bet

That **human delivery hours per audit fall sharply across the first ten
audits** as the workflows, prompts and templates mature. If they do not, this
is a consultancy that scales linearly with headcount — a real business, but not
one that funds a portfolio, and the kill criteria say to stop.

`delivery_hours_per_audit` is tracked precisely for this reason.

## Where it feeds the portfolio

- Reveals the same problem across multiple clients → micro-SaaS candidates with
  a paying customer already attached
- Produces reusable platform modules paid for by client work
- Generates operating data for market intelligence
- Produces case studies that lower acquisition cost for every other venture

## Unit economics to validate before scaling

| Figure | Needs to be |
| --- | --- |
| CAC | Under one month of implementation revenue |
| Audit → implementation conversion | Above 20% |
| Delivery hours per audit | Falling, and under 20 by the tenth |
| Gross margin | Above 50% |
| Payback period | Under 3 months |

None of these are known yet. That is what Phase 2 is for.
