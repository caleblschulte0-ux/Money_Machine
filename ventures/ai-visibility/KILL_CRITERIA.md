# Kill criteria

## Venture-specific

| Criterion | Threshold | Measured by |
| --- | --- | --- |
| Clients will not renew | Under 60% renewal at month three across ten clients | Subscription cancellations |
| Monitoring cost destroys margin | `monitoring_cost_per_client` above 30% of monthly price | Cost ledger attributed by customer |
| Observations are not reproducible | Run-to-run variance makes month-over-month comparison meaningless on the same question set | Variance across repeated observations |
| No compliant access exists | No licensed or permitted path for the engines clients care about | Documented terms review |

## What each would mean

**Poor renewal.** The most likely failure. A monitoring report that does not
change a decision gets cancelled at month three regardless of how good the
measurement is. Before concluding the venture is dead, test whether the report
is un-actionable rather than the measurement worthless — but test once, with a
deadline.

**Cost above 30%.** Either reduce the question set (and say so in the contract)
or raise the price. If neither works at a price clients will pay, the unit
economics do not close.

**Irreproducible observations.** The cleanest kill. If the same question yields
materially different answers run to run, there is no product — only noise sold
as insight. Selling it anyway would be the single worst thing this venture
could do. **Test this before writing collection code**, not after.

**No compliant access.** Not a business problem to solve with effort. If no
engine offers a permitted path, the product cannot be built responsibly and the
venture stops. This is why the terms review is Stage 0.

## Platform-wide

Standard thresholds apply: CAC above LTV, gross margin under 50%, refunds above
10%, churn above 10% monthly, founder dependence above 60 hours, AI cost above
25% of revenue, and the $6,000 stop-loss.

## Decision rules

One criterion → `review`. Two or more, or the stop-loss → `shutdown_recommended`.

The reproducibility and compliant-access criteria are different from the
others: either one alone should stop the venture, because both mean the product
cannot be sold honestly rather than that it is performing poorly.

## If it is stopped

Follow `docs/VENTURE_SHUTDOWN_CHECKLIST.md`. Specifically:

- Return or delete client question sets — they reveal commercial strategy
- Preserve the observation data if it has research value, subject to the terms
  under which it was collected
- The gap analyst agent and the observation model may be reusable by the media
  or market-intelligence ventures
