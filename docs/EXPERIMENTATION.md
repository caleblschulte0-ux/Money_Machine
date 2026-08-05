# Experimentation

Every new initiative starts as an experiment. The point of this module is one
sentence from the brief: *prevent experiments from quietly turning into
permanent expenses without review.*

## Creation is deliberately strict

`ExperimentService.create()` refuses:

- an end date at or before the start date
- `maxLoss` of zero — "an experiment with no loss limit is a budget line, not
  an experiment"
- a missing failure metric or failure threshold — an initiative that declares
  only how it succeeds will always be judged to have succeeded

Required fields: venture, hypothesis, customer, problem, proposed solution,
acquisition channel, offer, price, budget, maximum loss, start, end, success
metric and threshold, failure metric and threshold, owner.

## Forced review

`reviewDue()` returns every running experiment that has hit **any** of:

- its end date
- its budget
- its declared maximum loss

and flips its status to `review_due`. The worker runs this daily and raises a
`warning` alert per experiment. The Command Center shows them at the top of the
experiments page.

Spend is not self-reported — it comes from the cost ledger, filtered by
`experimentId`.

## Decisions

`decide()` requires:

- a **human** actor — agents cannot decide experiments
- written reasoning — a blank note is rejected

Available decisions: `scale`, `continue`, `modify`, `pause`, `shutdown`,
`sell`, `merge`.

The decision, its reasoning and the final spend are recorded on the experiment
and in the audit log.

## Writing a good experiment

**Weak:** "Test whether AI visibility is a viable product."
Unfalsifiable, no end, no loss cap.

**Better:** "At least 5 of 60 contacted local firms will pre-pay $1,500 for a
one-time AI visibility audit by 15 April. Budget $400, maximum loss $600.
Failure: fewer than 2 pre-pay."

The second can end. That is the whole difference.
