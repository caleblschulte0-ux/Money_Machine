# AI Visibility and Answer-Engine Optimization

**Brand:** Answerline · **Phase:** 3 · **Status:** docs only
**Autonomy ceiling:** level 2

Helps companies measure and improve how they are described when buyers ask AI
assistants for recommendations.

## The constraint that shapes everything

**We cannot promise placement in an AI answer, and we do not control the
systems that produce them.**

Every offer, every report and every marketing asset is built around that. What
can be sold honestly is measurement, comparison over time, and the content work
that gives an answer engine something accurate to draw on. What cannot be sold
is a ranking.

Any competitor promising guaranteed placement is either misinformed or lying,
and saying so plainly is a differentiator with sophisticated buyers.

## Status

Docs only. The manifest, one draft workflow, one agent and the observation data
model exist. `feature.venture.ai_visibility` ships **off**, and
`feature.ai_visibility_live_probing` is separately off pending a documented
terms review for each answer engine.

## Contents

`BUSINESS_MODEL.md`, `CUSTOMER.md`, `OFFER.md`, `PRICING.md`, `WORKFLOWS.md`,
`METRICS.md`, `LEGAL.md`, `LAUNCH_PLAN.md`, `KILL_CRITERIA.md`

## Code

`src/index.ts` — manifest, workflow, agent, prompt, flags
`src/tracking.ts` — observation model, summarisation, period comparison
