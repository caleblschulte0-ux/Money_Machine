# Threat model

## What is worth protecting

1. **Customer data** — contacts, communications, business details entrusted to
   us. The largest liability.
2. **Money movement** — payment credentials and anything that can charge or
   refund.
3. **Client system credentials** — the automation agency holds access to client
   systems. Compromise here is compromise of *their* business.
4. **The audit trail** — if it can be altered, nothing else can be trusted.
5. **Brand integrity** — an agent sending something false under a venture brand.

## Adversaries considered

| Adversary | Motivation | Primary defences |
| --- | --- | --- |
| Opportunistic attacker | Credentials, ransomware | scrypt passwords, digest-only tokens, rate limiting, no enumeration |
| Malicious customer | Access another tenant's data | `organizationId` on every record; scope assertions on every service call |
| Compromised agent / prompt injection | Make an agent take a harmful action | Tool allow-lists enforced at call time; the `agent` role cannot approve, charge, export or publish; write tools go through the autonomy gate |
| Insider error | Accidental mass send or charge | `ALLOW_LIVE_COMMUNICATIONS`, `ALLOW_PAID_PROVIDERS`, kill switches, budgets, approval queue |
| Runaway automation | Cost or reputational damage at machine speed | Hard budgets, per-run cost ceilings, idempotency, kill switches |
| Vendor compromise | Supply chain | Adapter isolation, pinned dependencies, no vendor lock-in |

## The prompt-injection case specifically

Content an agent reads — a customer email, a web page, a knowledge document —
is untrusted input, and an agent may be persuaded to attempt something harmful.
The defence is not that the model refuses; it is that the capability is absent:

- An agent can only call tools on its allow-list, checked at call time. A model
  asking for a tool it never had is logged, not honoured.
- Write tools go through the same autonomy policy as workflow steps.
- The `agent` role cannot decide approvals, charge, refund, export, delete,
  publish workflows or allocate capital. There is a startup assertion.
- The knowledge base only exposes **approved** documents, so injected content
  cannot become the agent's source of truth.
- Agents cannot approve knowledge. Only humans can.

An agent that is fully persuaded can still write CRM records and produce a bad
draft. That is the residual risk, and it is bounded by what a draft can do.

## Accepted risks

- **A single trusted operator.** The Command Center has no authentication.
  Acceptable only because it is not deployed; blocking for any deployment.
- **In-memory rate limiting.** Resets on restart and does not span instances.
- **Lexical knowledge search.** No semantic filtering of malicious content.
- **No runtime dependency scanning.**
- **The Prisma adapter is unexercised.** Its behaviour under real concurrency
  is unverified.

## Explicitly out of scope

Physical security, nation-state adversaries, denial of service, and securing
the client-side systems the agency integrates with.
