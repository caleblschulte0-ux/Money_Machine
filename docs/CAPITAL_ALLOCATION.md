# Capital allocation

## The platform recommends. A human decides.

`buildAllocationPlan()` produces recommendations. It never moves money, never
changes a budget and never commits spend. Every recommendation carries
`requiresHumanApproval: true` and the plan carries a disclaimer stating this.

Only the `owner` role holds `capital:allocate`. The `agent` role provably does
not — there is a startup assertion.

## Controls the owner sets

| Control | Where | Effect |
| --- | --- | --- |
| Monthly venture budget | `venture.monthlyBudgetMinor` | Baseline for allocation advice |
| Stop-loss | `venture.stopLossMinor` | Breaching it alone triggers `shutdown_recommended` |
| Category budgets | `costs.setBudget()` | Hard caps that refuse work when exhausted |
| Approval threshold | `APPROVAL_THRESHOLD_USD` | Any action at or above escalates |
| Autonomy ceiling | `venture.maxAutonomyLevel` | Caps every workflow in the venture |

Hard budgets refuse work; soft budgets only alert.

## How a recommendation is formed

| Situation | Action | Multiplier |
| --- | --- | --- |
| ≥ 2 kill criteria triggered | `wind_down` | 0× |
| 1 kill criterion triggered | `freeze` | 1× |
| Launch gates unmet past validation | `freeze` | 1× |
| No health evidence | `hold` | 1× |
| Health ≥ 70 and gross profit positive | `increase` | 1.5× |
| Health ≥ 55 | `hold` | 1× |
| Health < 55 | `decrease` | 0.5× |

Two downgrades apply afterwards:

- **Thin evidence downgrades `increase` to `hold`.** Below 50% health coverage,
  the recommendation says so explicitly and refuses to recommend more capital.
- **Negative gross profit downgrades `increase` to `hold`.** Growth spend on a
  negative-margin venture scales a loss.

`confidence` is derived from health coverage, so a confident-looking
recommendation on unmeasured data is not possible.

## When recommendations exceed available capital

The plan scales every recommendation proportionally rather than silently
picking winners, and notes that choosing which venture to cut instead is an
owner decision. The system will not quietly make a strategic choice.

## Reading the output

- `action` — what is suggested
- `recommendedBudget` / `delta` — the numbers
- `rationale` — every reason, in plain language
- `confidence` — how much evidence stands behind it
- `notes` — scaling and wind-down warnings
- `disclaimer` — always present

If confidence is low, the correct response is usually to fix the measurement
gap, not to act on the recommendation.
