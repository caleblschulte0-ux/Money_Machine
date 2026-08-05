# Launch plan

## Current state

Docs only. Manifest, one draft workflow, one agent and the observation model
exist. Both feature flags ship off.

## Stage 0 — Answer the two blocking questions

Neither is a build task, and neither can be skipped.

**1. Is there a compliant way to collect observations?**
- [ ] Review each target engine's terms, in writing
- [ ] Identify an official API, licensed source, or permitted manual method
- [ ] Record volume and rate limits
- [ ] If no engine has a compliant path, **stop here** — that is a kill criterion

**2. Are observations stable enough to sell?**
- [ ] Pick 30 questions for a brand we control
- [ ] Observe each repeatedly over two weeks
- [ ] Measure run-to-run variance
- [ ] If the same question yields materially different answers day to day,
      month-over-month comparison is noise and there is no product

Answer both before writing collection code.

## Stage 1 — Dogfood on the portfolio

- [ ] Track our own venture brands
- [ ] Produce a full audit report for one of them
- [ ] Have someone outside the project read it and say whether it is actionable

If our own report is not actionable for us, it will not be for a client.

## Stage 2 — Presale

The seeded experiment `visibility.paid-audit-presale` states this precisely:
at least 5 of 60 contacted firms pre-pay $1,500 by 15 April, budget $400,
maximum loss $600, failure at fewer than 2.

- [ ] Contact 60 firms, weighted toward existing agency clients
- [ ] Sell 5 pre-paid audits
- [ ] Deliver them and measure real collection and analysis cost

## Stage 3 — Convert to monitoring

- [ ] Convert 3 audit clients to monthly monitoring
- [ ] Run two full monthly cycles
- [ ] Confirm `monitoring_cost_per_client` is under 30% of price
- [ ] Confirm month-over-month comparison passes the reliability threshold

**Gate to scale:** ten monitoring subscribers past month three.

## Enabling the flags

`feature.venture.ai_visibility` turns on after Stage 0 passes and the venture
clears its launch gates.

`feature.ai_visibility_live_probing` turns on only per-engine, only after that
engine's terms review is documented, and only with rate limits configured.
