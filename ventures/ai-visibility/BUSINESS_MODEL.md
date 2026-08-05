# Business model

## Revenue

| Offer | Price | Interval |
| --- | --- | --- |
| One-Time AI Visibility Audit | $1,500 | one-time |
| Monthly Monitoring | $900 | monthly |
| Visibility Growth Program | quoted | monthly (planned) |
| Enterprise Brand Monitoring | quoted | monthly (planned) |

The audit qualifies; monitoring is the business. A one-time audit is a report
someone reads once. A monitoring subscription is a number they check monthly,
and monthly checking is what makes it recurring.

## Cost structure

| Cost | Nature |
| --- | --- |
| Observation collection | Variable, per question per engine per period |
| Analysis inference | Variable, per report |
| Human review | Fixed per client per month |
| Content production | Variable, in the growth program |

`monitoring_cost_per_client` is the number that decides viability. Above 30% of
the monthly price is a kill criterion.

## The economic bet

That **observation collection is cheap and repeatable enough** to monitor 30–50
questions per client per month at a cost well under the price. If collection
must be substantially manual, the margin collapses and this is a consulting
service priced as a subscription.

There is a second bet: that **repeated observations are stable enough** that
month-over-month comparison is meaningful. If the same question yields
materially different answers run to run, there is no product — only noise sold
as insight. `comparePeriods()` refuses to call a comparison reliable below 20
observations per period for exactly this reason.

## Why it follows the agency

It reuses almost everything already built: research agents, reporting, CRM,
billing, the customer portal, knowledge. It adds the recurring revenue the
agency lacks, and the agency's existing clients are the first prospects.

It also gets applied to the portfolio's own brands first, which is both a real
test and a source of case studies.
