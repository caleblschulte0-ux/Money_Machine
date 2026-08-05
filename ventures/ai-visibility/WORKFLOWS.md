# Workflows

## `visibility.monthly_report` — draft, autonomy level 2

Trigger: `schedule`, `0 9 1 * *`, keyed on `periodKey`. Cost ceiling: $2.00.

| Step | Action | Notes |
| --- | --- | --- |
| `analyse_gaps` | `agent.run` → `visibility.gap_analyst` | Works only from recorded observations |
| `review_task` | `task.create` | Human review before anything reaches the client |

Level 2 means the report never reaches a client without a human reading it.
The review task instructs the reviewer to check every claimed observation
against the recorded data and to reject any sentence predicting placement.

## `visibility.gap_analyst` — the agent

Autonomy level 1 (drafts only), budget $0.60 per run.

Its prompt returns: questions where the brand is absent and a competitor
appears, which cited sources drive those answers, inaccurate statements
observed, and the content assets that would give an engine something accurate
to cite — ranked by how many tracked questions they address.

Guardrails: never predict a ranking or placement; never describe an observation
that is not in the supplied data. Escalates when there are no observations
rather than producing an analysis of nothing.

## The observation model

`src/tracking.ts`. An **observation** is what one engine said about one question
on one date. It is evidence, not a metric; metrics are derived from
observations, so every number in a client report traces back to rows.

```ts
interface AnswerObservation {
  questionId: string;
  engine: string;
  observedAt: Date;
  brandAppeared: boolean;
  brandSentiment: "positive" | "neutral" | "negative" | "not_mentioned";
  competitorsNamed: string[];
  sourcesCited: string[];
  inaccuracies: string[];
  answerExcerpt: string;              // the evidence behind the row
  collectionMethod: "manual" | "licensed_api" | "not_collected";
}
```

`collectionMethod` is deliberately explicit. A summary reports what share was
collected manually, because a hand-collected sample has different properties
from an automated one and the client is entitled to know which they bought.

## Collection is gated off

**Nothing in this module queries an external answer engine.**
`feature.ai_visibility_live_probing` ships `false` and stays off until each
provider's terms have been reviewed and a compliant access path exists.

This is not a technical gap. Automated probing of a third-party service may
violate its terms, and building a business on a terms violation is building on
someone else's decision.

## Not built

Question set management, competitor configuration, AI referral traffic
tracking, the client-facing dashboard, and content production for the growth
program.
