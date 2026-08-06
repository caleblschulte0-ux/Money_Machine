# AI Holding Company

A reusable operating platform for launching, running, measuring and shutting
down many AI-heavy businesses — not a single business.

The bet is that most of what a small services or software company does is the
same work in different clothes: capture a lead, qualify it, deliver something,
bill for it, support it, and know whether it made money. Build that once,
properly, and each new venture becomes a configuration problem rather than a
rebuild.

**Human involvement is deliberately concentrated** around capital allocation,
legal approvals, banking, signing authority, major client relationships,
high-risk exceptions, hiring and firing, and strategy. Everything else is
automated, standardised, or at minimum made measurable.

---

## Quick start

```bash
pnpm install
pnpm dev         # Command Center at http://localhost:3000
pnpm test        # 133 tests
```

No database, no API keys and no accounts are required. The default store is
in-memory and every external provider is a mock.

**The dashboard opens empty, and that is correct.** No venture is operating, so
there is no revenue, no customer and no activity to show. To see how it behaves
with data in it:

```bash
DEMO_DATA=true pnpm dev    # fictional companies, invented figures
```

Demo data is opt-in rather than the default because a dashboard that greets you
with invented revenue trains you to trust numbers that are not real.

To use PostgreSQL:

```bash
cp .env.example .env      # then set STORE_DRIVER=prisma
docker compose up -d postgres
pnpm db:generate && pnpm db:push
pnpm seed
```

---

## Safety posture

Two environment switches govern everything that could cost money or reach a
real person. Both default to `false`, and the config layer refuses to start if
they are inconsistent with the selected providers:

| Switch | Default | What it gates |
| --- | --- | --- |
| `ALLOW_PAID_PROVIDERS` | `false` | Any model, SMS, telephony or payment vendor that bills |
| `ALLOW_LIVE_COMMUNICATIONS` | `false` | Any adapter that actually delivers a message |

Under `NODE_ENV=test` both are rejected outright — a test run cannot spend
money or email a person, even by mistake. In production the config layer also
refuses the in-memory store and default secrets.

Beyond configuration there are three runtime brakes:

- **Kill switches** — `killswitch.all_automation`, `killswitch.agent_spend`,
  `killswitch.outbound_communications`, plus per-venture switches. Pulling one
  stops work immediately without editing any definition.
- **Budgets** — hard monthly caps per venture and category. An agent that would
  exceed its budget refuses to run and files an approval instead of overspending.
- **The approval queue** — every high-risk action lands in one place for a
  human, carrying its evidence and its exact replay payload.

---

## Repository layout

```
apps/
  command-center/     Internal dashboard: portfolio, approvals, automation, costs
  worker/             Maintenance jobs (expiries, alerts, failure queue)

packages/             The shared platform — one implementation, every venture
  core                ids, Result, errors, Money, Clock, tenancy, autonomy policy
  config              env validation, feature flags, kill switches
  security            passwords, tokens, field encryption, rate limits
  database            Prisma schema + store port + memory/Prisma adapters
  audit               who did what, redacted and queryable
  auth                users, sessions, organizations, RBAC
  ventures            registry, lifecycle, health scoring, launch gates, kill criteria
  crm                 accounts, contacts, leads, scoring, dedupe, spam detection
  workflows           trigger/condition/action engine
  agents              agent definitions, tools, runner, model provider port
  prompts             versioned prompt registry
  knowledge           approved-only knowledge base for agent grounding
  approvals           the single human approval queue
  cost-accounting     cost ledger, budgets, capital-allocation advice
  compliance          consent, suppression, privacy requests, retention
  communications      outbound email/SMS behind compliance checks
  billing             plans, subscriptions, invoices, payments
  experiments         experiment registry with forced review
  analytics           portfolio rollups for the command center
  design-system       shared UI primitives, per-venture branding
  platform            composition root — wires everything, once
  demo-data           fictional seed data shared by the CLI and the dashboard
  testing             fixtures and fake clocks

ventures/             Individual businesses built on the platform
  automation-agency   Phase 2 — scaffolded, the first revenue venture
  ai-visibility       Phase 3 — docs only
  lead-generation     Phase 4 — docs only

docs/                 Architecture, strategy, and honest status
legal/                Templates and policies (nothing is attorney-approved)
```

---

## How a venture plugs in

A venture module is **declarative**. It contributes a manifest, workflows,
agents, prompts and flags; the platform executes them. Modules never import
each other, and disabling a venture is simply not registering it:

```ts
import { createPlatform, installVentureModule } from "@holdco/platform";
import { MODULE as AGENCY } from "@venture/automation-agency";

const platform = await createPlatform();
installVentureModule(platform, AGENCY);   // omit this line to disable it
```

Every manifest must declare its offers *and what those offers do not promise*,
its metrics, and its kill criteria before it will validate. An offer with no
stated non-claims is a validation error, not a style problem.

---

## What is actually built

See [`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md) for the full
component-by-component status and
[`docs/KNOWN_LIMITATIONS.md`](./docs/KNOWN_LIMITATIONS.md) for what does not
work yet.

The short version: **Phase 1 (the shared platform) is built and tested.** The
automation agency is scaffolded with real workflows and a real agent. The other
two ventures are documented and gated off. No venture has a customer, no
provider is live, and no money has moved.

---

## Documentation

| Document | What it covers |
| --- | --- |
| [HOLDCO_STRATEGY.md](./docs/HOLDCO_STRATEGY.md) | Why a holding company, the flywheel, sequencing |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System design and the decisions behind it |
| [VENTURE_MODEL.md](./docs/VENTURE_MODEL.md) | Venture lifecycle, isolation, health scoring |
| [AUTONOMY_LEVELS.md](./docs/AUTONOMY_LEVELS.md) | The 0–5 model and what each level permits |
| [AGENT_FRAMEWORK.md](./docs/AGENT_FRAMEWORK.md) | Agent definitions, tools, budgets, escalation |
| [WORKFLOW_ENGINE.md](./docs/WORKFLOW_ENGINE.md) | Triggers, conditions, actions, guarantees |
| [CRM.md](./docs/CRM.md) | Entities, lead scoring, deduplication |
| [BILLING.md](./docs/BILLING.md) | Plans, invoicing, and why charging is double-gated |
| [EXPERIMENTATION.md](./docs/EXPERIMENTATION.md) | How initiatives start and how they end |
| [CAPITAL_ALLOCATION.md](./docs/CAPITAL_ALLOCATION.md) | Budgets, stop-losses, allocation advice |
| [SECURITY.md](./docs/SECURITY.md) | Boundaries, secrets, incident response |
| [COMPLIANCE.md](./docs/COMPLIANCE.md) | Consent, suppression, disclosures, retention |
| [DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Going to production, and the gates on the way |
| [LOCAL_DEVELOPMENT.md](./docs/LOCAL_DEVELOPMENT.md) | Running and extending the platform |
| [VENTURE_LAUNCH_CHECKLIST.md](./docs/VENTURE_LAUNCH_CHECKLIST.md) | What a venture must clear to launch |
| [VENTURE_SHUTDOWN_CHECKLIST.md](./docs/VENTURE_SHUTDOWN_CHECKLIST.md) | How to close one cleanly |
| [KNOWN_LIMITATIONS.md](./docs/KNOWN_LIMITATIONS.md) | What is missing, stubbed or simulated |
| [ROADMAP.md](./docs/ROADMAP.md) | Phases 1–10 and what triggers each |

---

## Commands

```bash
pnpm dev              # Command Center
pnpm test             # Vitest across all packages
pnpm typecheck        # tsc --noEmit everywhere
pnpm build            # production build
pnpm seed             # fictional demo data
pnpm worker           # run all maintenance jobs once
pnpm worker <jobName> # run one job
pnpm db:generate      # Prisma client
pnpm db:push          # push schema to Postgres
```

---

## Ground rules this codebase follows

1. Build shared infrastructure before duplicating functionality.
2. Keep the repository runnable with no credentials.
3. Mock providers by default; never enable paid services without approval.
4. Never fabricate integration success, legal approval, tests or metrics.
5. Measure AI cost at the workflow and customer level.
6. Put a kill switch on every automated workflow.
7. Build every system so a human can inspect what happened.
8. Sunk cost is not a reason to continue a venture.

---

## Throwing a lot of ideas at the wall

`pnpm shots` runs a separate small app for testing offers cheaply. One entry in
`apps/shots/src/shots.config.ts` gets you a live page at `/s/<slug>` with a
signup form; the scoreboard at `/` tells you which ideas got a response.

Two things it enforces, because they are what usually goes wrong:

- **It will not let you call an idea dead until at least 30 people have seen
  it.** No signups and no visitors means you learned nothing — you published,
  you did not test. That is a different situation from a real rejection, and
  the scoreboard says which one you are in.
- **Signups are weighted by what you asked for.** Forty email addresses rank
  below two booked calls, because they are worth less as evidence.

Every idea declares `successLooksLike` in numbers before launch and a
`killAfterDays` date, so a result cannot be reinterpreted as a success
afterwards and nothing lingers by default.

Signups become ordinary CRM leads tagged `shot:<slug>`, so an idea that works
arrives with its early interest already in the system.
