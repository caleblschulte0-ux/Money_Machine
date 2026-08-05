# Roadmap

Phases are gated on evidence, not on time. A phase begins when the previous one
has produced something specific.

## Phase 1 — Shared platform ✅ complete

Monorepo, auth, organizations, permissions, database, CRM, audit, venture
registry, workflow engine, agent framework, approval centre, cost tracking,
analytics, mock providers, documentation. 133 tests.

## Phase 2 — AI Automation Agency 🔨 scaffolded

*Why first:* fastest path to revenue, least capital, and customers reveal which
problems are actually worth automating.

Built: manifest, lead intake workflow, audit delivery workflow, audit analyst
agent, lead scoring model, full documentation.

Still needed:
- [ ] A real intake form and landing page
- [ ] Document generation for the proposal (currently simulated)
- [ ] A real model provider, with verified pricing and a budget
- [ ] The first paid audit sold

**Gate to Phase 3:** three paid audits delivered, and human delivery hours per
audit trending down.

## Phase 3 — AI Visibility 📋 documented

*Why second:* reuses the agency's research agents, reporting, CRM and billing,
and adds recurring revenue the agency lacks.

Blocked on:
- [ ] A documented terms review for each answer engine before any automated
      probing (`feature.ai_visibility_live_probing` stays off until then)
- [ ] Evidence that repeated observations are stable enough that
      month-over-month comparison is meaningful rather than noise

**Gate to Phase 4:** ten monitoring subscribers past month three.

## Phase 4 — Lead generation and call centre 📋 documented

One vertical, one metro. Roofing in a single market.

Blocked on:
- [ ] Cost per qualified lead measured against what buyers actually pay
- [ ] Three buyers willing to commit to exclusive territory
- [ ] Jurisdiction-specific call-recording consent handling

**Gate:** unit economics positive on 100 delivered leads.

## Phase 5 — Media network 📋 not started

Use content to lower acquisition cost across the portfolio. Requires a content
pipeline with fact-checking, rights tracking and policy review — none built.

## Phase 6 — Construction product 📋 not started

Choose the single most valuable workflow from agency client experience.
Requires Phase 2 to have surfaced the same problem in at least three clients.

## Phase 7 — Data and intelligence 📋 not started

Turn accumulated operating data into reports, alerts and subscriptions.
Requires enough operating history to be worth selling, plus documented source
legality and licensing.

## Phase 8 — Micro-SaaS portfolio 📋 not started

Extract reusable tools from successful client projects. Requires the same tool
to have been built for three paying clients.

## Phase 9 — Marketplaces and directories 📋 not started

Launch only once the company already controls relevant supply, demand, traffic
or data. A marketplace with neither side is an expensive way to learn that.

## Phase 10 — Land platform 📋 research mode only

Stays in research and mock mode. **No live outreach, offers, contracts,
property marketing or closings until the applicable legal and professional
approvals exist and are documented.**

---

## Platform work that cuts across phases

Ordered by how much risk it removes:

1. **Authentication in the Command Center** — blocks any deployment
2. **Exercise the Prisma adapter against a real database** — the largest
   untested surface
3. **A real MFA second factor** — currently enforced but impossible to satisfy
4. **Write actions in the UI** — approving from the dashboard
5. **A real job scheduler** for the worker
6. **Safe automatic workflow retry** with per-step idempotency
7. **Automatic metric snapshots** derived from transaction history
8. **Dependency scanning and a restore test**
