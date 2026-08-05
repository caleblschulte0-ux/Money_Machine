# Implementation status

Last updated: 2026-08-05. Phase 1 complete.

This file is the honest inventory. If something says **Built**, it works and has
tests. If it says **Scaffolded**, the structure exists but a real dependency is
missing. If it says **Simulated**, calling it records what it *would* have done
and marks the output `simulated: true`. If it says **Not started**, no code
exists.

Nothing below is described as working because it was designed to work.

---

## Verification at time of writing

| Check | Result |
| --- | --- |
| `pnpm test` | 133 passing, 14 files, 3 consecutive clean runs |
| `pnpm typecheck` | Clean across all packages, ventures and apps |
| `pnpm build` (command-center) | Succeeds; 8 routes |
| `pnpm seed` | Runs; creates 3 ventures, 3 leads, 3 tasks, 1 approval |
| `pnpm worker` | Runs all 6 jobs |
| Command Center pages | All 6 return HTTP 200 with real data under `pnpm dev` |
| Money moved | $0.00 — every provider is a mock |
| Live messages sent | 0 |

---

## Platform packages

| Package | Status | Notes |
| --- | --- | --- |
| `core` | **Built** | ids, Result, errors, Money, Clock, tenancy, autonomy policy. Tested. |
| `config` | **Built** | Env validation with safety cross-checks; flags and kill switches. Tested. |
| `security` | **Built** | scrypt, token digests, AES-256-GCM, rate limiting, webhook verification. Not independently unit-tested; exercised through `auth`. |
| `observability` | **Built** | Redacting logger, metrics, alerts with runbook enforcement. |
| `database` | **Built** | 41-collection Prisma schema; memory adapter tested including transaction rollback. |
| `database` (Prisma adapter) | **Scaffolded** | Code complete and typechecked, but **never executed against a live Postgres in this environment**. Treat the first `pnpm db:push` as unverified. |
| `audit` | **Built** | Every service writes through it; payloads redacted. |
| `auth` | **Built** | Sessions, RBAC, rate-limited login, no user enumeration. MFA is a flag on the session, not an implemented second factor. |
| `ventures` | **Built** | Registry, lifecycle graph, launch gates, health scoring, kill criteria. Heavily tested. |
| `crm` | **Built** | Accounts, contacts, leads, opportunities, tasks, cases. Scoring, dedupe and spam detection tested. |
| `workflows` | **Built** | Engine with dry-run, idempotency, retries, compensation, approval gating, cost ceiling. 19 tests. |
| `agents` | **Built** | Registry, runner, tool allow-lists, budgets, escalation, knowledge grounding. 15 tests. |
| `prompts` | **Built** | Immutable versioned registry; 5 platform prompts. |
| `knowledge` | **Built** | Approved-only retrieval with citations. Lexical search, not embeddings — by design, see limitations. |
| `approvals` | **Built** | Single queue, autonomy gate, expiry, payload replay. 9 tests. |
| `cost-accounting` | **Built** | Ledger with full attribution, budgets, capital-allocation advice. |
| `compliance` | **Built** | Consent, suppression, privacy requests, retention candidates. |
| `communications` | **Built** (email) | Compliance-gated sending. Email works via mock; SMS transport is not implemented. |
| `billing` | **Built** | Plans, subscriptions, invoices, MRR. Charging is double-gated and only a mock provider exists. |
| `experiments` | **Built** | Creation refuses to accept an experiment with no end date, loss cap or failure metric. |
| `analytics` | **Built** | Portfolio rollups that report measurement gaps rather than zeros. |
| `design-system` | **Built** | Primitives including a `Metric` that renders "not measured" for null. |
| `platform` | **Built** | Composition root. |
| `demo-data` | **Built** | Fictional seed shared by CLI and dashboard. |
| `testing` | **Built** | Fixtures, fixed clock, `.invalid` domains and 555 numbers throughout. |

---

## Provider adapters

| Adapter | Status | Notes |
| --- | --- | --- |
| Model — mock | **Built** | Deterministic. Its default reply says it is a mock and produced no facts. |
| Model — Anthropic/OpenAI | **Not started** | Throws a clear error naming what is missing. Refuses to run without verified pricing. |
| Email — mock | **Built** | Captures messages in memory. |
| Email — SMTP/Resend | **Not started** | Throws. Mailpit is in `docker-compose.yml` for a local sink when SMTP is written. |
| SMS — mock | **Built** | Captures messages. |
| SMS — Twilio | **Not started** | Throws. |
| Telephony | **Not started** | No call handling exists. |
| Payments — mock | **Built** | Records intent, moves nothing. |
| Payments — Stripe | **Not started** | Throws. |
| Storage | **Not started** | No object storage abstraction is wired. |

---

## Workflow actions

| Action | Status |
| --- | --- |
| `task.create`, `record.update`, `record.tag`, `human.notify`, `approval.request` | **Built** |
| `email.send` | **Built** (compliance-gated; mock transport) |
| `agent.run` | **Built** |
| `sms.send`, `call.start`, `document.generate`, `invoice.create`, `followup.schedule`, `content.publish`, `file.export`, `webhook.trigger`, `campaign.pause`, `case.escalate` | **Simulated** — registered, runnable, output marked `simulated: true` |

---

## Platform agents

| Agent | Status | Autonomy |
| --- | --- | --- |
| Research | **Built**, active | 1 — drafts only |
| Sales Development | **Built**, active | 1 — drafts, never sends |
| Support | **Built**, active | 2 — human approves |
| Quality Control | **Built**, active | 3 — reviews, cannot publish |
| Finance | **Built**, active | 2 — categorises, cannot move money |
| Operations | **Scaffolded**, draft | 1 — needs monitoring tools that do not exist |
| Engineering | **Scaffolded**, draft | 1 — has no repository or deploy tooling, by design |

---

## Ventures

| Venture | Status | Phase | What exists |
| --- | --- | --- | --- |
| Automation Agency | **Scaffolded** | 2 | Manifest, 2 workflows, 1 agent, 1 prompt, scoring model, full docs |
| AI Visibility | **Docs only** | 3 | Manifest, 1 draft workflow, 1 agent, observation model, full docs. Live probing gated off pending terms review. |
| Lead Generation | **Docs only** | 4 | Manifest, 1 draft workflow, routing and dispute logic, scoring model, full docs |
| All other ventures in the brief | **Not started** | 5–10 | Folder with a README stating status; no code |

---

## Command Center

| Page | Status |
| --- | --- |
| Portfolio overview | **Built** |
| Venture detail (health, gates, offers, kill criteria) | **Built** |
| Approval queue | **Built (read-only)** — deciding from the UI is not wired |
| Automation (workflows, agents, kill switches, runs) | **Built (read-only)** |
| Costs and capital allocation | **Built (read-only)** |
| Experiments | **Built (read-only)** |
| Audit trail | **Built** |
| Authentication in the UI | **Not started** — the app assumes a single trusted operator |

---

## Explicitly not built

These are named so nobody assumes otherwise:

- Customer portal, public marketing site, and any venture landing page
- Any UI that performs a write (approve, deny, publish, allocate)
- Real background job scheduling (the worker runs once and exits)
- Redis queue driver
- Document generation, e-signature, scheduling, telephony
- Data products, directories, marketplaces, media pipeline, land platform
- Deployment pipeline and production infrastructure

---

## Assumptions this build made

1. **A single holding organization operates the platform.** Multi-tenant
   customer access is modelled in the schema and RBAC but no customer-facing
   surface exists.
2. **The owner is the sole approver initially.** The approval queue supports
   multiple roles, but no notification or delegation exists.
3. **US-centric compliance defaults.** Consent, suppression and disclosure
   logic reflects common US practice; nothing is jurisdiction-verified.
4. **The first vertical for lead generation is roofing in one metro.** Scoring
   rules encode that choice and are wrong for any other vertical.
5. **Model pricing is unknown until a human enters it.** `MODEL_PRICES` ships
   with mock entries only, and the runner refuses to spend against an
   unverified rate.
