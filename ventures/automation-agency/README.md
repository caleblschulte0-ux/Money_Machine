# AI Automation Agency

**Brand:** Ridgeline Operations · **Phase:** 2 · **Status:** scaffolded
**Autonomy ceiling:** level 3

The first revenue venture. Sells measured reductions in operational hours to
small and midsize companies by automating the manual handoffs between tools
they already pay for.

## Why this venture is first

- Fastest path to revenue: services sell before software exists
- Lowest capital requirement
- Customers reveal which problems are actually worth turning into software
- Each project produces reusable platform modules and a case study
- Agency revenue funds the product ventures

## What it sells

| Offer | Price | Interval |
| --- | --- | --- |
| Automation Audit | $2,500 | one-time |
| Department Automation | $12,000 + $2,500 setup | monthly |

## What it does not sell

Headcount reduction. Every offer's non-claims say so explicitly, the scoring
model disqualifies prospects whose stated goal is eliminating staff, and the
audit prompt is instructed to report hours rather than positions.

This is a commercial position as much as an ethical one: "cut your payroll" is
a promise we cannot verify, invites a client to make an irreversible decision on
our estimate, and attracts buyers who churn when it does not happen.

## Contents

| File | Purpose |
| --- | --- |
| `BUSINESS_MODEL.md` | How money is made |
| `CUSTOMER.md` | Who buys and who does not |
| `OFFER.md` | Exact scope and claim boundaries |
| `PRICING.md` | Prices and the reasoning |
| `WORKFLOWS.md` | Delivery mechanics |
| `METRICS.md` | What is measured |
| `LEGAL.md` | Constraints |
| `LAUNCH_PLAN.md` | Path to the first customers |
| `KILL_CRITERIA.md` | When to stop |

## Code

`src/index.ts` — manifest, workflows, agent, prompts, flags
`src/scoring.ts` — lead scoring model
