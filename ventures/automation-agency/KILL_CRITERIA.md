# Kill criteria

Agreed in advance so that stopping is a decision, not a debate. Work already
invested is not an input — `evaluateKillCriteria()` does not weigh it and its
summary says so.

## Venture-specific

| Criterion | Threshold | Measured by |
| --- | --- | --- |
| No paid audit sold | 0 paid audits after 200 qualified conversations | `audits_sold` vs outreach count in CRM |
| Delivery time does not fall | `delivery_hours_per_audit` not down 30% by the tenth audit | Logged hours per audit |
| Gross margin below target | Under 50% for two consecutive months | Cost ledger vs revenue |
| Audits do not convert | Under 20% audit → implementation across ten audits | `audit_to_implementation_rate` |

## Platform-wide (defaults)

| Criterion | Threshold |
| --- | --- |
| CAC exceeds LTV | ratio > 1 |
| Refund rate | > 10% of revenue |
| Churn | > 10% monthly |
| Support burden | > 2 cases per customer |
| Founder dependence | > 60 human hours/month |
| AI cost | > 25% of revenue |
| Stop-loss | cumulative loss ≥ $15,000 |

## What each would mean

**No paid demand.** The problem is real but not painful enough to pay to
diagnose. Consider whether the audit price is the barrier, or whether the buyer
is wrong. One repricing attempt, then stop.

**Delivery time flat.** The most likely failure, and the most important to
catch. It means the work is genuinely bespoke and this is a consultancy. That
is a viable business — but not the one being funded, and it should be
recognised rather than drifted into.

**Margin below target.** Usually contractor cost or scope creep. Fix the scope
document before concluding the price is wrong.

**Audits do not convert.** The audit is being bought as cheap consulting.
Either the implementation offer is unconvincing, or the audit is too complete
and the client can act alone.

## Decision rules

- **One criterion triggered** → `review`. Decide deliberately at the next
  monthly review, with a written reason either way.
- **Two or more** → `shutdown_recommended`. Default to pause; the burden of
  proof is on continuing.
- **Stop-loss breached** → `shutdown_recommended` on its own. The number was
  set in advance for exactly this moment.

## If it is stopped

Follow `docs/VENTURE_SHUTDOWN_CHECKLIST.md`. Specifically for this venture:

- Client system credentials must be revoked and revocation confirmed in writing
- Automations running in client systems must be handed over or cleanly removed —
  leaving orphaned automation in a client's business is a liability
- The workflows, agent and prompts stay in the platform; another venture may
  reuse them
- Write the postmortem, and record which criterion fired first and whether its
  threshold was right
