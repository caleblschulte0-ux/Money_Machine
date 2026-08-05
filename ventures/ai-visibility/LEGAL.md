# Legal

**Not legal advice. Nothing here has been reviewed by an attorney.**

## Constraints in the manifest

1. No offer, proposal or marketing asset may promise placement, ranking or
   recommendation in any AI system.
2. Querying third-party answer engines requires a documented review of that
   provider's terms before any automated probing;
   `feature.ai_visibility_live_probing` stays off until then.
3. Reports must date-stamp every observation and state that answer engines
   change without notice.
4. Do not represent observed answers as the provider's official position.

## The terms-of-service question

This is the venture's largest legal exposure and the reason it is gated.

Automated querying of an AI assistant may violate that provider's terms.
Building a monitoring product on a terms violation means the product can be
switched off by someone else's decision, and it exposes both us and our clients.

Required before enabling collection, per engine:

- [ ] Written review of that provider's current terms
- [ ] A documented compliant access path — official API, licensed data, or
      permitted manual collection
- [ ] Rate and volume limits recorded and respected
- [ ] The client informed which engines are covered and how they are accessed

If no compliant path exists for an engine, it is not offered. That is a scope
decision, not a technical one.

## Claims

The exposure is a client believing they bought improved placement.

Mitigations:
- Non-claims in every offer, enforced by manifest validation
- Prompt guardrails preventing the analyst from predicting placement
- Automatic caveats in every summary
- Reliability warnings on small samples
- A human reviewing every report before it goes out

## Statements about competitors

Reports name competitors that appeared in answers. That is factual reporting of
an observation, retained with its excerpt as evidence. Two rules:

- Report what was observed, never characterise the competitor
- Retain the excerpt — an unevidenced claim about a competitor is the risk

## Client data

Brand facts and question sets are client-confidential. Question sets in
particular reveal commercial strategy and must not be used to inform another
client's work in the same vertical. The platform's venture and account scoping
supports this; the policy needs stating in the contract.

## Before the first client

- [ ] Terms review per engine, documented
- [ ] Customer agreement reviewed, with the non-claims in the agreement itself
- [ ] Report template reviewed for claim language
- [ ] Confidentiality terms covering question sets
