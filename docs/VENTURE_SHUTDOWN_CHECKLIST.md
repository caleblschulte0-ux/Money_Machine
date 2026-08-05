# Venture shutdown checklist

Closing a venture well is a competence. Doing it badly damages the brands that
remain and can create liabilities that outlive the business.

The decision itself: `evaluateKillCriteria()` reports what triggered. Sunk cost
is not an input, and the summary says so.

## 1. Decide and record

- [ ] Transition to `shutting_down` with a written reason
- [ ] Record the decision on the experiment if one is open
- [ ] Write a postmortem into the knowledge base: what was believed, what
      happened, what would be done differently

## 2. Stop the machinery

- [ ] Pull the venture's kill switch — immediate, no deploy
- [ ] Set every workflow to `paused`
- [ ] Set every agent to `paused`
- [ ] Pause campaigns and stop ad spend
- [ ] Set the venture's monthly budget to zero

## 3. Customers first

- [ ] Notify every active customer with real notice, not the minimum
- [ ] Honour commitments through the notice period or refund them
- [ ] Provide data export for anything the customer gave you
- [ ] Cancel subscriptions; do not let one bill after the service ends
- [ ] Point them somewhere useful, including a competitor

## 4. Money

- [ ] Collect outstanding receivables
- [ ] Settle vendor and contractor obligations
- [ ] Cancel venture-specific subscriptions
- [ ] Record final costs so the P&L closes honestly
- [ ] Record total lifetime spend against the original stop-loss

## 5. Data and compliance

- [ ] Apply retention policy to customer data
- [ ] Preserve suppression lists **permanently** — a shutdown must never
      resurrect someone's inbox under a sibling brand
- [ ] Complete outstanding privacy requests
- [ ] Preserve the audit trail; do not delete it with the venture
- [ ] Preserve consent records for the retention period

## 6. Brand and technical

- [ ] Decide the domain's fate: redirect, park, or let it lapse deliberately
- [ ] Update or remove public pages
- [ ] Remove the venture module registration (`installVentureModule` call)
- [ ] Archive the code rather than deleting it — it may be sellable
- [ ] Revoke venture-scoped API keys and credentials

## 7. Harvest

The point of a portfolio is that a closed venture still pays something forward:

- [ ] Which platform capabilities were built that other ventures now inherit?
- [ ] What did the market teach that changes another venture's thesis?
- [ ] Is the code, the customer list, the domain or the data worth selling?
- [ ] Which kill criterion fired first, and should its threshold change?

## 8. Close

- [ ] Transition to `closed` or `sold` with a reason
- [ ] Confirm the venture no longer appears in active rollups
- [ ] Confirm no scheduled job still references it
