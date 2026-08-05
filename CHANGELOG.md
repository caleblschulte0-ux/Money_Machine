# Changelog

Notable changes to the platform. Format loosely follows Keep a Changelog.

## [0.1.0] — 2026-08-05

Phase 1: the shared operating platform. Nothing in this release can spend
money or send a message — every external dependency is behind a port whose
default adapter is a mock.

### Added — foundation

- `@holdco/core` — prefixed sortable ids, `Result`, error taxonomy,
  integer-cent `Money`, injected `Clock`, tenancy scoping, and the autonomy
  policy (levels 0–5, four risk classes, unknown actions treated as high risk)
- `@holdco/config` — Zod-validated environment with cross-checks that refuse a
  paid provider without explicit approval and reject paid providers entirely
  under `NODE_ENV=test`; feature flags and kill switches
- `@holdco/security` — scrypt passwords, digest-only tokens, AES-256-GCM field
  encryption with blind indexing, token-bucket rate limiting, webhook signature
  verification with a replay window
- `@holdco/observability` — redacting structured logger, metrics registry,
  alerting that refuses to raise a critical alert without a runbook

### Added — persistence

- `@holdco/database` — 41-collection Prisma schema; a narrow store port whose
  filter grammar is the honest intersection of what memory and SQL can both
  express; in-memory adapter with transaction rollback; Prisma adapter

### Added — platform services

- `@holdco/audit` — every consequential action with its actor, redacted
- `@holdco/auth` — sessions, RBAC, rate-limited login without user enumeration,
  and a startup assertion that the `agent` role can never approve, charge,
  export or publish
- `@holdco/ventures` — registry with an enforced lifecycle graph, the five
  launch gates, health scoring that reports evidence coverage instead of
  inventing numbers, and mechanical kill-criteria evaluation
- `@holdco/crm` — accounts, contacts, leads, opportunities, tasks, cases;
  data-driven lead scoring, spam detection, service-scoped deduplication
- `@holdco/workflows` — versioned definitions, declarative conditions, dry-run
  mode, idempotency, retries, failure queue, compensation, per-step approval
  gating, hard run-cost ceilings
- `@holdco/agents` — definitions with mandatory budgets and escalation rules,
  a deterministic mock provider, tool allow-lists enforced at call time,
  knowledge grounding with citations
- `@holdco/prompts` — immutable versioned registry with inherited guardrails
- `@holdco/knowledge` — approved-only retrieval; drafts are invisible to agents
- `@holdco/approvals` — one queue, autonomy gating, expiry, verbatim payload
  replay
- `@holdco/cost-accounting` — ledger with mandatory attribution, budgets that
  refuse work when exhausted, advisory capital allocation
- `@holdco/compliance` — consent, suppression that outranks consent, privacy
  requests, retention reporting
- `@holdco/communications`, `@holdco/billing`, `@holdco/experiments`,
  `@holdco/analytics`, `@holdco/design-system`, `@holdco/platform`,
  `@holdco/demo-data`, `@holdco/testing`

### Added — apps and ventures

- Command Center: portfolio, venture detail, approvals, automation, costs and
  capital allocation, experiments, audit trail
- Worker: approval expiry, knowledge expiry, experiment review flagging,
  session pruning, automation health alerting, failure-queue escalation
- `@venture/automation-agency` — scaffolded: 2 workflows, 1 agent, 1 prompt,
  scoring model, 10 documents
- `@venture/ai-visibility` — docs only: manifest, draft workflow, agent,
  observation model with reliability thresholds
- `@venture/lead-generation` — docs only: manifest, draft workflow, buyer
  routing, dispute handling, scoring model
- 15 placeholder venture folders recording intent and constraints without
  fabricating business documents

### Fixed — defects surfaced by tests during the build

- The workflow engine ignored action handlers' own `compensate()`
  implementations, so a failed run left completed steps un-undone whenever the
  step did not declare an explicit compensating action. It now falls back to
  the handler, and reports `NOT COMPENSATED` when neither exists rather than
  implying the world was restored.
- The agent runner verified model pricing against the *definition's* declared
  provider rather than the injected one, so a mismatched provider could have
  been billed against the wrong rate card. It now refuses to run on a provider
  the agent was not priced for.
- Fuzzy lead deduplication ignored service type, so a customer requesting two
  different services would have had the second request rejected as a duplicate
  — a lost sale. Fuzzy matching is now scoped to the same service type.

### Verification

133 tests passing across 14 files, stable over three consecutive runs.
Typecheck clean. Command Center builds and all six pages render real data.
Seed and worker both run. $0.00 moved; 0 live messages sent.
