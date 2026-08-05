# Offer

## 1. One-Time AI Visibility Audit — $1,500

**Deliverable:** A snapshot report over an agreed set of customer questions:

- Whether the brand appeared, per question and per engine
- Which competitors appeared instead
- Which sources the answers cited
- Any factually inaccurate statement observed about the brand
- A ranked content plan addressing the largest gaps

**Outcome claimed:** A documented, reproducible measurement of how the brand was
described across the tracked questions **on the dates measured**.

**Explicitly not claimed:**
- That the brand will appear in any AI answer
- Any recommendation, ranking or placement
- Any control or influence over the internal workings of any AI system
- That observations persist — answer engines change without notice

## 2. Monthly Monitoring — $900/month

**Deliverable:** Ongoing tracking of the agreed question set, with a monthly
report showing changes in appearance, competitor presence, cited sources and
AI-referred traffic where the client's analytics can identify it.

**Outcome claimed:** A monthly, comparable record of how the brand's presence in
tracked answers changes over time.

**Explicitly not claimed:**
- Improvement in appearance rate
- Traffic or conversions from AI referrals
- Coverage beyond the engines and questions named in the agreement

## The dashboard answers

- Where is the brand mentioned, and for which customer questions?
- How accurately is it described?
- Which competitors appear instead?
- Which sources influence those answers?
- What content is missing?
- Is AI-referred traffic increasing, and is it converting?

## Honesty built into the product

`summarizeObservations()` attaches caveats to every summary automatically:

- Observations are point-in-time; engines change without notice
- Appearance rate describes what was observed, not what will happen
- The share collected manually, when the sample is hand-limited
- The share of tracked questions actually observed this period

`comparePeriods()` marks a comparison **unreliable** below 20 observations per
period and says so in the report. The failure mode of this product is a client
acting confidently on noise, and the product is built to refuse that.
