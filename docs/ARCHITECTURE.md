# Architecture

## The shape of the problem

A holding company that launches many small businesses has a specific failure
mode: each venture accretes its own half-built CRM, its own billing, its own
"send an email" helper, and within a year there are six codebases nobody can
change safely. The architecture below exists to make that impossible.

There are exactly two kinds of code:

- **Platform packages** (`packages/`) — capabilities every venture reuses. They
  know nothing about any specific business.
- **Venture modules** (`ventures/`) — declarative descriptions of one business:
  its offers, workflows, agents, metrics and kill criteria. They contain almost
  no imperative code.

A venture module never imports another venture module. The platform never
imports a venture module. The only place they meet is the composition root.

---

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Language | TypeScript 5.9, ESM | One language across API, worker and UI |
| Monorepo | pnpm workspaces + Turborepo | Workspace protocol, content-addressed store |
| Build | **None for packages** | Packages export `./src/index.ts` directly; Next transpiles them, Vitest reads TS natively, the worker runs under tsx. No build step means no stale `dist/`. |
| Database | PostgreSQL + Prisma 6 | Relational data with real constraints |
| Validation | Zod 4 | Every boundary: env, agent I/O, manifests |
| UI | Next.js 15 + React 19 + Tailwind 4 | Server components; the dashboard is read-mostly |
| Tests | Vitest 3 | Fast, native TS |

---

## The port/adapter rule

Every external dependency sits behind an interface with at least two
implementations: a mock and a real one.

```
ModelProvider      → MockModelProvider     | UnimplementedModelProvider
EmailProvider      → MockEmailProvider     | UnimplementedEmailProvider
SmsProvider        → MockSmsProvider       | UnimplementedSmsProvider
PaymentProvider    → MockPaymentProvider   | UnimplementedPaymentProvider
Store              → createMemoryStore()   | createPrismaStore()
```

Three things follow from this:

1. **A fresh clone runs with no credentials.** The defaults are all mocks.
2. **Tests are honest.** They exercise the same code path production will, with
   a deterministic adapter rather than a stub inserted at the call site.
3. **Unfinished adapters fail loudly.** `UnimplementedModelProvider` throws with
   a message naming exactly what is missing. It never returns a plausible fake
   result, because a fabricated integration success is worse than an outage —
   an outage gets fixed.

### Why the mock model provider is deliberately unhelpful

Its default response is a structured acknowledgement that says it is a mock and
produced no facts. A mock that returned convincing prose would let a test pass
because the mock invented something plausible, and would let a demo look like a
working product. Scripted responses are opt-in per test.

---

## Persistence: one narrow port, two adapters

`packages/database/src/ports.ts` defines a small `Collection<T>` interface with
a declarative filter grammar (`equals`, `in`, `gt/gte/lt/lte`, `contains`,
`has`, `not`).

That grammar was chosen as **the intersection of what an in-memory store and a
relational store can express faithfully**. A predicate-function filter would
have been more convenient and would have quietly worked in memory while
table-scanning or failing in Postgres. Anything richer than the grammar belongs
in a driver-specific query, not smuggled through the port.

The grammar is also a subset of Prisma's own `where` syntax, so the Prisma
adapter forwards filters unchanged rather than translating them — one less
place for the two backends to diverge.

The 41 collections are built generically from one mapping table
(`entities.ts`), rather than 41 hand-written repositories. Field names in
`types.ts` match `schema.prisma` exactly, and that correspondence is
load-bearing.

---

## Tenancy: two independent axes

```ts
interface TenantScope {
  organizationId: string;              // the customer tenant
  ventureScope: "all" | string[];      // which businesses this actor may touch
  userId?: string;                     // present when a human acts
  agentRunId?: string;                 // present when an agent acts
}
```

`organizationId` is customer isolation. `ventureId` is *portfolio* isolation:
a venture can be paused, sold or shut down, and its data has to be separable
when that happens. Conflating the two would make selling a venture a data
migration project.

Every actor carries a scope. An agent's scope is always the narrow `agent` role
pinned to a single venture, and it records the run id, so every write an agent
makes is attributable to a specific run.

---

## The four control planes

Automation is governed by four independent mechanisms. Any one of them can stop
work, and they are checked in this order:

### 1. Kill switches (`packages/config`)

Boolean overrides checked before anything else. `killswitch.all_automation`
stops every workflow and agent immediately, without editing a definition or
deploying. Per-venture switches narrow the blast radius.

Unknown flag keys evaluate to `false`, so a typo can never enable something.

### 2. The autonomy policy (`packages/core/autonomy.ts`)

Every action carries an `actionKind`. Every action kind has a risk class, and
each risk class has a hard ceiling:

| Risk | Max autonomy | Meaning |
| --- | --- | --- |
| low | 5 | Reversible, internal, no money, no outbound message |
| medium | 4 | Outbound but recoverable |
| high | 2 | Money, legal effect, or hard to reverse — always a human |
| prohibited | denied | Never automated at any level |

Two properties matter:

- **Unknown action kinds are `high`.** A new action does not get to be cheap by
  default.
- **The ceiling beats the grant.** Granting level 5 to a venture cannot make a
  refund unattended.

### 3. Budgets (`packages/cost-accounting`)

Hard monthly caps per venture and category. `checkSpend()` returns a decision
rather than throwing, so callers can degrade — queue the work, use a cheaper
model, ask a human — instead of crashing a customer-facing flow. An agent that
would exceed its budget files an approval so a human sees it.

### 4. The approval queue (`packages/approvals`)

One queue for everything a human must decide. Each request carries the evidence
and the **exact payload to replay**. Approving replays that payload verbatim;
nothing is re-derived from current state, which is what makes the approval
mean something specific rather than "yes, do whatever this is now."

Only `actorType: "human"` may decide, and the RBAC layer contains a startup
assertion that the `agent` role does not hold `approval:decide`.

---

## Cost attribution

Every cost entry carries: organization, venture, category, and where they
apply — customer, campaign, product, experiment, workflow run, agent run,
vendor. That set is required at write time rather than backfilled, because the
questions that matter ("what does it cost to serve this customer?", "did this
experiment lose money?") are unanswerable if attribution is optional.

Money is always integer minor units. `grossMarginRatio()` returns `null` rather
than `0` when there is no revenue — "0% margin" and "no revenue yet" are
different facts, and the dashboard must not show the second as the first.

---

## Measurement honesty

A recurring pattern: **the absence of evidence is represented explicitly.**

- `computeVentureHealth()` scores a dimension `null` when it has no evidence,
  and reports `coverage` — the share of weight that was evidenced. A venture
  with 20% coverage and a score of 80 is unmeasured, not healthy.
- `AnalyticsService.portfolio()` returns `measurementGaps` listing what it
  could not compute.
- `evaluateKillCriteria()` returns `unevaluable` alongside `triggered`.
- The `Metric` UI component takes `string | null` and renders "not measured".

This is a deliberate defence against the main risk of an automated dashboard:
that it looks authoritative while quietly reporting defaults.

---

## Data flow: an inbound lead

```
form POST
   ↓
CrmService.captureLead()
   ├─ detectSpam()          → reject before anything else consumes resources
   ├─ dedupeFingerprint()   → venture- and service-scoped
   ├─ findDuplicates()      → fuzzy, same service type only
   ├─ scoreLead()           → data-driven rules, every reason recorded
   └─ audit.record()
   ↓
WorkflowEngine.run(trigger: lead.created)
   ├─ kill switches
   ├─ trigger condition
   ├─ idempotency check     → replayed webhook does not double-run
   └─ per step:
        ├─ step condition
        ├─ approvals.gate() → execute | queue approval | deny
        ├─ cost ceiling
        ├─ execute with retries
        └─ record a step run a human can read
   ↓
compensation on failure, or an approval waiting in the queue
```

---

## Decisions worth restating

**Source-only packages, no build step.** Removes a whole class of "stale dist"
bugs and makes cross-package refactors immediate.

**Conditions are data, not code.** Workflow conditions are a small declarative
tree evaluated identically in dry-run and live mode. No `eval`, no template
language. A workflow definition should be reviewable by someone who does not
read TypeScript.

**Prompts are versioned artefacts.** Every agent run records the prompt key and
version that produced it, so a regression traces to a prompt change.

**Knowledge retrieval is approved-only.** Draft and expired documents are
invisible to agents. An unreviewed page cannot become a customer commitment.
Retrieval is lexical, not vector-based — honest about what it is, needs no
extra infrastructure, and sits behind an interface that embeddings can replace.

**The engineering agent has no deploy tool.** The brief says it must not deploy
without passing tests and approval. The most reliable way to enforce that is to
not give it the capability at all.
