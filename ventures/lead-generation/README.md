# Lead Generation Network

**Brand:** Trade Route Leads · **Phase:** 4 · **Status:** docs only
**Autonomy ceiling:** level 3

Generates and sells qualified enquiries to local service contractors. **One
vertical, one metro** — roofing in a single market — until the economics are
known.

## The discipline

The playbook is emphatic: build one vertical first, and do not launch dozens of
websites before proving the lead economics. This module therefore ships the
*mechanics* — scoring, duplicate handling, buyer routing, capacity, exclusivity,
dispute resolution — configured for a single vertical, and nothing that assumes
scale.

The economics of a lead business are knowable with a hundred leads. Spreading
across verticals first converts a cheap experiment into an expensive one.

## What buyers actually judge

Not volume. Exclusivity, speed, and how disputes are handled. A supplier who
credits a bad lead without argument keeps the account; one who argues loses it
regardless of quality.

## Status

Docs only. `feature.venture.lead_generation` ships off. The routing workflow is
`draft`.

## Contents

`BUSINESS_MODEL.md`, `CUSTOMER.md`, `OFFER.md`, `PRICING.md`, `WORKFLOWS.md`,
`METRICS.md`, `LEGAL.md`, `LAUNCH_PLAN.md`, `KILL_CRITERIA.md`

## Code

`src/index.ts` — manifest, routing workflow, flags
`src/routing.ts` — buyer matching, capacity, exclusivity, rotation, disputes
`src/scoring.ts` — roofing lead scoring model
