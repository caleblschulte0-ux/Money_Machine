# Venture model

## Lifecycle

```
idea → validation → build → launched → scaling
          ↓           ↓        ↓          ↓
        paused ←──────┴────────┴──────────┘
          ↓
   shutting_down → closed | sold
```

Transitions are enforced by `VentureRegistry.transition()`:

- **Illegal jumps are refused.** `idea → launched` throws.
- **Every transition requires a reason.** Blank reasons are rejected.
- **`closed` and `sold` are terminal.** Reopening means creating a new venture,
  which keeps the history honest.
- **`build`, `launched` and `scaling` require every launch gate to pass.**
  An owner may `force: true` past the gates; the stage reason is prefixed
  `[OVERRIDE]` and the audit event records `forced: true`.

## The five launch gates

Defined in `packages/ventures/src/launch-gate.ts`. Each requirement is a
question answered with **evidence**, not a checkbox — evidence under 10
characters does not count and is reported as "too thin".

| Gate | Asks |
| --- | --- |
| **Problem** | What is the specific problem, in the customer's words? Who exactly has it? What do they spend on it today? Why are existing solutions inadequate? |
| **Offer** | What exactly does the customer receive? At what price? What outcome is promised, and how is it measured? How is it delivered? |
| **Demand** | Any one of: paid pilot, signed LOI, deposits, qualified waitlist, strong outbound response, existing customer request. |
| **Economic** | CAC, gross margin, delivery cost, support burden, **AI cost measured from a real run**, payback period, churn risk. |
| **Operational** | The delivery workflow **as a definition in the engine**, quality controls, legal restrictions, data requirements, support plan, failure recovery. |

Two details matter. The demand gate is `anyOf` — one real proof beats five
weak ones. The operational gate requires the workflow to exist in the engine,
not merely to be described.

## Health scoring

Fifteen weighted dimensions. The design rule: **a dimension with no evidence
scores `null`, not zero and not fifty.**

The overall score is the weighted average of evidenced dimensions only,
reported alongside `coverage` — the share of total weight that had evidence. A
venture with 20% coverage and a score of 80 is unmeasured, not healthy, and the
command center says so.

| Dimension | Weight | Source |
| --- | --- | --- |
| Revenue growth | 3 | Month-over-month snapshots |
| Gross margin | 3 | Revenue minus COGS, AI and contractor cost |
| Retention | 3 | Churned vs starting customers |
| Customer concentration | 2 | Entered |
| Acquisition cost | 2 | Marketing spend per new customer |
| Payback period | 2 | CAC vs gross profit per customer |
| Legal risk | 2 | Entered |
| Automation level | 2 | Automated vs manual actions |
| Founder dependence | 2 | Human hours |
| Support burden | 1 | Cases per customer |
| Engineering burden | 1 | Entered |
| Market size | 1 | Entered |
| Competitive pressure | 1 | Entered |
| Data advantage | 1 | Entered |
| Cross-venture synergy | 1 | Entered |

## Kill criteria

Evaluated mechanically by `evaluateKillCriteria()` and reported without
softening. Defaults:

| Criterion | Default threshold |
| --- | --- |
| No paid demand | 200+ outreach attempts, zero revenue |
| CAC exceeds LTV | ratio > 1 |
| Gross margin below target | < 50% |
| Refund rate | > 10% of revenue |
| Retention | > 10% monthly churn |
| Support burden | > 2 cases per customer |
| Founder dependence | > 60 human hours/month |
| AI cost | > 25% of revenue |
| Stop-loss | cumulative loss ≥ the venture's stop-loss |

Recommendations: `continue` (nothing triggered), `review` (one triggered),
`shutdown_recommended` (two or more, or the stop-loss breached alone).

Criteria that cannot be evaluated are listed separately as `unevaluable`, so
missing data never reads as a pass.

The summary never mentions work already invested. There is a test asserting the
output contains no sunk-cost language.

## Venture isolation

A venture module is declarative: a manifest plus workflows, agents, prompts and
flags. Rules:

- Modules never import each other.
- The platform never imports a module.
- Disabling a venture means not calling `installVentureModule()`. Nothing else
  changes.
- Every record carries `ventureId`, so a venture's data is separable when it is
  sold or closed.

`validateManifest()` rejects a manifest with no kill criteria, and rejects any
offer that states no non-claims — an offer with nothing it refuses to promise
is how "AI replaces your staff" gets shipped.
