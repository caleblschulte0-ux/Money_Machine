# Metrics

## North star

**Cost per qualified lead.** The number the entire venture lives on. Everything
else is secondary until this is below the price with margin.

## Tracked

| Metric | Unit | Why |
| --- | --- | --- |
| `cost_per_qualified_lead` | currency | The north star |
| `lead_acceptance_rate` | ratio | Share accepted rather than disputed |
| `dispute_rate` | ratio | Above 10% signals a quality problem |
| `duplicate_rate` | ratio | Caught before delivery — a working filter, not a fault |
| `buyer_retention` | ratio | Buyers still purchasing after 90 days |

## Reading them together

- **Low cost per lead with a high dispute rate** is not a good result. It means
  the scoring threshold is too loose and the cost is being deferred into
  credits and lost buyers.
- **A high duplicate rate is good news about the filter**, not bad news about
  the traffic — provided duplicates are caught before delivery. Duplicates that
  reach a buyer are the expensive kind.
- **Acceptance rate is the honest quality measure**, because the buyer pays for
  their answer.

## Buyer retention is the real test

Anyone can sell a contractor one batch of leads. Buyers still purchasing after
90 days have decided the leads are worth the money, having worked them. Below
40% at 90 days is a kill criterion.

## Per-buyer numbers

Tracked individually, because averages hide the failure:

- Leads delivered, accepted, disputed
- Dispute rate (drives the 40% escalation rule)
- Capacity utilisation
- Revenue and days since last purchase

A buyer at 100% capacity daily needs more territory. A buyer at 20% is about to
churn.

## Where the numbers come from

CRM for leads, scores and routing; cost ledger for ad spend attributed by
campaign; billing for revenue; monthly snapshots for the health dimensions.

Ad spend must be recorded with `campaignId` set, otherwise cost per qualified
lead cannot be computed per channel and the venture cannot tell which traffic
source works.
