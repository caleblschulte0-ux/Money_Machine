# Launch plan

## Current state

Docs only. Manifest, routing logic, dispute logic and scoring model exist and
are unit-testable. `feature.venture.lead_generation` ships off; the workflow is
`draft`.

## Stage 1 — Secure demand before generating supply

*Backwards from the obvious order, deliberately. Leads with no buyer are worth
nothing, and buyers will tell you what "qualified" means in their market.*

- [ ] Identify 15 roofing contractors in the target metro
- [ ] Have real conversations: what they pay now, what they hate, capacity
- [ ] Get 3 to commit to buying at $85 with a 24-hour dispute window
- [ ] Write the buyer agreement, including the no-volume clause

Fewer than 3 committed buyers is a kill criterion. Do not proceed to spend.

## Stage 2 — Prove acquisition cost

- [ ] Build one landing page for one service in one metro
- [ ] Set up call and form tracking
- [ ] Spend up to $2,000 on paid acquisition
- [ ] Measure cost per qualified lead against the $85 price

This is the whole experiment. It costs about $2,000 to answer and is expensive
to assume.

Success: cost per qualified lead meaningfully under $85. Failure: at or above
it with no clear path down.

## Stage 3 — Deliver and measure quality

- [ ] Route 100 leads through `leadgen.route_inbound`
- [ ] Track acceptance and dispute rates per buyer
- [ ] Handle every dispute within the window
- [ ] Invoice after the acceptance window, never before

Success: dispute rate under 15%, acceptance above 80%.

## Stage 4 — Convert to territory

- [ ] Move the best-performing buyer to a monthly exclusive territory
- [ ] Confirm predictable revenue holds for two months
- [ ] Reach 3 territory buyers

**Gate to a second vertical or metro:** positive unit economics on 100
delivered leads, dispute rate under 15%, and buyer retention above 40% at 90
days.

## What must not happen

**Do not launch a second vertical or metro before Stage 4.** The playbook is
explicit, and the reason is arithmetic: an unprofitable lead model replicated
five times is five times the loss, discovered five times later.

## Before enabling anything

- [ ] The three legal items in `LEGAL.md` completed
- [ ] Ad spend budget set with `costs.setBudget()` as a **hard** budget
- [ ] `feature.venture.lead_generation` enabled by the owner
- [ ] The routing workflow moved from `draft` to `active` after a dry run
