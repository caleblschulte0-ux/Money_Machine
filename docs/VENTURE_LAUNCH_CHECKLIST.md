# Venture launch checklist

A venture cannot enter `build`, `launched` or `scaling` until every launch gate
passes. `VentureRegistry.transition()` enforces this; an owner may override with
`force: true`, which is recorded as `[OVERRIDE]` and audited as `forced: true`.

## Gate 1 — Problem

- [ ] The specific problem, in the customer's words, from at least three
      conversations with dates and roles
- [ ] A named segment with a countable population and a way to reach them
- [ ] What they spend on it today: current tool, staff time, or vendor invoices
      with amounts
- [ ] Specific failure modes of the incumbents — adjectives do not count

## Gate 2 — Offer

- [ ] A scope document a stranger could deliver against
- [ ] A price and the reasoning behind it
- [ ] A measurable outcome we can defend, and how it is measured
- [ ] The delivery workflow, who runs it, and expected cycle time
- [ ] **Non-claims written down** — the manifest will not validate without them

## Gate 3 — Demand (any one is sufficient)

- [ ] A paid pilot (invoice or payment record)
- [ ] A countersigned letter of intent
- [ ] Deposits taken
- [ ] A qualified waitlist of named contacts who confirmed budget and timing
- [ ] Outbound results: volume sent, reply rate, meetings booked
- [ ] An existing customer's written request

## Gate 4 — Economics

- [ ] Estimated CAC with the channel and assumptions
- [ ] Expected gross margin after delivery, AI and labour cost
- [ ] Itemised cost to deliver one unit, including human minutes
- [ ] Expected support burden and who handles it
- [ ] **AI cost measured from a real run**, not estimated from a price list
- [ ] Payback period in months
- [ ] Why customers would leave, and what retains them

## Gate 5 — Operations

- [ ] The delivery workflow **exists in the engine** — a description does not
      count
- [ ] Quality controls: the QC step, its criteria, who reviews failures
- [ ] A written legal review naming jurisdictions and constraints
- [ ] Data sources, licences and retention decisions
- [ ] Named humans supporting customers, with hours and escalation path
- [ ] Failure modes and a recovery procedure for each

## Beyond the gates

**Platform**
- [ ] Venture registered with a budget, stop-loss and autonomy ceiling
- [ ] Feature flag defined, and a kill switch for anything customer-facing
- [ ] Manifest validates: offers with non-claims, metrics, kill criteria
- [ ] Workflows dry-run cleanly before going active
- [ ] Agents have test suites if autonomy is 3+
- [ ] Budgets set **before** any paid provider is enabled

**Commercial**
- [ ] Brand, domain and email templates distinct from the holding company
- [ ] Plans created in billing
- [ ] Onboarding and support path documented in approved knowledge

**Governance**
- [ ] Kill criteria agreed with thresholds *before* launch
- [ ] The first review date scheduled
- [ ] The owner has explicitly approved activation
