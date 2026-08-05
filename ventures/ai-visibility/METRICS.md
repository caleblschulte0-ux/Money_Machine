# Metrics

## North star

**Brand appearance rate** — the share of tracked questions where the client's
brand appeared. It is what the client checks, and it is what the whole product
exists to measure.

Note carefully: it is a *measurement*, never a *promise*.

## Tracked

| Metric | Unit | Why |
| --- | --- | --- |
| `appearance_rate` | ratio | The north star |
| `tracked_questions` | count | Coverage across all clients |
| `monitoring_cost_per_client` | currency | Decides viability |
| `ai_referral_sessions` | count | Whether visibility produces traffic |
| `retention_months` | days | Whether the report stays useful |

## Reliability before insight

`comparePeriods()` requires **20 observations per period** before it will call a
comparison reliable, and attaches an explicit warning otherwise:

> Fewer than 20 observations in at least one period. Treat any change as noise
> until the sample is larger.

This matters more than any single metric. A client who reduces spend because an
appearance rate moved from 40% to 30% on eight observations has been badly
served, and it will be our fault.

## Caveats attached automatically

Every summary carries:

- Observations are point-in-time; engines change without notice
- Appearance rate describes what was observed, not what will happen
- The manual share of collection, when non-zero
- The share of tracked questions actually observed

## AI referral traffic

The weakest measurement, and it should be presented that way. Referrer data
from AI assistants is inconsistent, often absent, and varies by engine. Reported
only where the client's own analytics can identify it, and always labelled as a
partial count.

Never inferred from a traffic increase that happens to coincide with our work.

## Portfolio metrics

Standard health dimensions apply. Retention carries the most weight here: a
monitoring subscription that churns at month three is a one-time audit with
extra steps, and that is precisely the kill criterion.
