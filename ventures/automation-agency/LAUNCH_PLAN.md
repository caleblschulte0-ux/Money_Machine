# Launch plan

## Current state

Scaffolded. Manifest, two workflows, one agent, one prompt and a scoring model
exist and are exercised by the integration tests. **No customer, no revenue, no
landing page, no live provider.**

## Stage 1 — Prove someone will pay for an audit

*The only question that matters. Nothing else is worth building until it is
answered.*

- [ ] Build a list of 60 named companies in the target trades and metro
- [ ] Research each properly — the SDR agent drafts, a human sends
- [ ] Book 10 discovery conversations
- [ ] Sell 3 paid audits at $2,500

Success: 3 paid audits. Failure: fewer than 1 after 200 approaches — a kill
criterion.

**Deliberately not built yet:** a landing page. Outbound to a named list tests
demand faster and more cheaply than a page nobody visits, and the playbook is
explicit that this should not begin with landing pages.

## Stage 2 — Deliver them and measure the hours

- [ ] Deliver each audit through `agency.audit_delivery`
- [ ] Log delivery hours immediately, per audit, while the number is known
- [ ] Record what the analyst agent got wrong, and improve the prompt version
- [ ] Convert at least 1 audit to implementation

Success: hours per audit falling, and one implementation signed.

## Stage 3 — First recurring revenue

- [ ] Deliver the first implementation
- [ ] Build the monthly before/after report against the audit baseline
- [ ] Reach 3 implementation clients

Success: $30k+ MRR with gross margin above 50%.

## Stage 4 — Harvest

- [ ] Identify a problem that appeared in three separate clients
- [ ] Scope it as a micro-SaaS experiment with a paying customer attached
- [ ] Extract any reusable capability into the shared platform

## Enabling live operation

In order, each gated on the previous:

1. Write a model provider adapter
2. Add its pricing with a verified date (`MODEL_PRICES`)
3. Set a hard AI budget for the venture **before** enabling spend
4. Owner approval, recorded in the approval queue
5. `ALLOW_PAID_PROVIDERS=true`
6. Separately, for email: write the adapter, verify suppression and consent
   behaviour against a seed list we control, confirm the kill switch stops
   delivery, then `ALLOW_LIVE_COMMUNICATIONS=true`

## The launch gates

The venture cannot enter `build` until all five pass with real evidence. The
demand gate needs one genuine proof; the economic gate needs AI cost **measured
from a real run**; the operational gate needs the delivery workflow to exist in
the engine, which it does.
