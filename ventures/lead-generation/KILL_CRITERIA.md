# Kill criteria

## Venture-specific

| Criterion | Threshold | Measured by |
| --- | --- | --- |
| Acquisition cost exceeds price | `cost_per_qualified_lead` above the per-lead price for two consecutive months | Marketing cost ledger vs qualified lead count |
| Buyers dispute too many leads | `dispute_rate` above 15% across 100 delivered leads | Lead acceptance records |
| Buyers do not stay | `buyer_retention` under 40% at 90 days | Purchase history |
| The vertical cannot absorb the volume | Fewer than 3 active buyers willing to take exclusive territory | CRM buyer pipeline |

## What each would mean

**Cost above price.** The cleanest kill. No amount of volume fixes negative unit
economics — volume scales the loss. Try one repositioning (different service
type, different metro), then stop.

**Dispute rate above 15%.** Either the scoring threshold is too loose or the
traffic source is wrong. Raise the threshold first; that is cheap. If cost per
qualified lead then rises above the price, the two criteria have combined and
the answer is the same one.

**Retention below 40%.** Buyers worked the leads and decided they were not worth
it. This is the most damning signal, because they have the ground truth we do
not: whether the leads closed.

**Fewer than 3 territory buyers.** The market is too small or too well served.
Note that this is discovered in Stage 1, **before** any ad spend — which is why
demand comes before supply in the launch plan.

## Platform-wide

CAC above LTV, gross margin under 50%, refunds above 10%, churn above 10%
monthly, founder dependence above 60 hours, AI cost above 25% of revenue, and
the $5,000 stop-loss.

The stop-loss is deliberately low. This venture's main risk is ad spend, and ad
spend can lose money quickly and quietly.

## Decision rules

One criterion → `review`. Two or more, or the stop-loss → `shutdown_recommended`.

## What is not a reason to continue

- "We just need more volume." Volume scales whatever the unit economics are.
- "The next vertical will be better." Untested, and it is how one loss becomes
  five.
- "We already built the routing logic." The routing logic stays in the platform
  and can be reused. It is not a reason to keep buying traffic.

## If it is stopped

Follow `docs/VENTURE_SHUTDOWN_CHECKLIST.md`. Specifically:

- Stop ad spend first — before anything else, because it is the only cost still
  accruing by the minute
- Honour every lead already delivered, including the full dispute window
- Settle outstanding credits rather than letting them lapse
- **Preserve suppression lists permanently**
- Decide the domain's fate deliberately — it may have residual traffic value
- The routing, capacity and dispute logic stays in the platform for any future
  marketplace venture
