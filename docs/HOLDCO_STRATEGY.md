# Holding company strategy

## The thesis

Most small businesses fail not because the idea was wrong but because the
operating overhead — invoicing, follow-up, reporting, support, bookkeeping —
consumes the founder before the idea gets a fair test. If that overhead is
carried once by a shared platform, a venture can be tested for the cost of
finding out whether customers pay, rather than the cost of building a company.

So the holding company is a **capital allocator with an operating system**, not
an idea generator. Its scarce resources are the owner's attention and cash, and
both are allocated on evidence.

---

## Operating principles

**1. A venture must earn continued investment.**
Every venture has a stage, a budget, a stop-loss and kill criteria agreed in
advance. The platform evaluates those criteria mechanically and reports the
result without softening it.

**2. Sunk cost is never an argument.**
`evaluateKillCriteria()` does not weigh how much code exists, and its summary
says so explicitly. Code already written is a reason to sell or reuse, never a
reason to keep funding.

**3. Measure before automating, automate before scaling.**
Automation of an unvalidated process is expensive theatre. The launch gates
require a delivery workflow to exist *in the engine* before a venture reaches
build — a description does not count.

**4. Concentrate human judgement where it is irreplaceable.**
Capital, legal, banking, signing, key relationships, hiring, firing, and
exceptions. Everything else is automated or made measurable. The approval queue
is the single place that judgement is exercised.

**5. Sell outcomes, not "AI".**
Customers interact with focused venture brands. The holding company is mostly
invisible. Every offer states a defensible outcome *and* what it does not
promise — the manifest will not validate without the non-claims.

---

## The flywheel

```
        Media and lead generation
                 ↓  brings customers at low cost
         Automation agency
                 ↓  reveals the same problem in several clients
          Micro-SaaS products
                 ↓  accumulate operating data
       Market intelligence products
                 ↓  become newsletter and media content
        Media and lead generation
```

Each venture proposal must explain which arrow it strengthens. A venture that
strengthens none is a separate company, not a portfolio addition, and should be
judged on its standalone merits or declined.

Concretely, the shared assets that compound:

| Asset | Reused by |
| --- | --- |
| CRM, billing, workflows, agents | Every venture, from day one |
| Agency client work | Reveals micro-SaaS opportunities with a paying customer attached |
| Operating data | Becomes market intelligence products |
| Audience from media | Lowers CAC for every other venture |
| AI visibility service | Applied to the portfolio's own brands first |

---

## Sequencing, and why this order

**Phase 1 — Shared platform.** Done. Everything else assumes it.

**Phase 2 — AI Automation Agency.** First, because it is the fastest path to
revenue with the least capital: services can be sold before software exists,
customers reveal which problems are actually worth automating, and each project
produces reusable platform modules and a case study. Agency revenue funds the
products.

**Phase 3 — AI Visibility.** Second, because it reuses nearly everything the
agency built (research agents, reporting, CRM, billing, the customer portal)
and adds recurring revenue, which the agency alone lacks. It is deliberately
constrained: no offer may promise placement in an AI answer, because nobody can
deliver that.

**Phase 4 — Lead generation and call centre.** One vertical, one metro. The
economics of a lead business are knowable with a hundred leads; spreading
across verticals before knowing them converts a cheap experiment into an
expensive one.

**Phases 5–10** — media, construction software, data products, micro-SaaS,
marketplaces, land. Each is gated on the previous phase producing either an
audience, a dataset, or a validated repeated problem. Marketplaces in
particular launch only once the company already controls relevant supply,
demand, traffic or data — a marketplace with neither side is a very expensive
way to learn that.

---

## What would falsify this strategy

Stated in advance, so it is not rationalised later:

- **The platform does not actually reduce venture launch cost.** If venture two
  takes as long as venture one, the shared-platform thesis is wrong and the
  right move is one focused business.
- **Agency work does not generalise.** If every client needs bespoke work that
  produces no reusable module, the agency is a consultancy — a fine business,
  but it does not feed the flywheel.
- **AI inference cost does not fall relative to the value delivered.** Several
  ventures assume it does. `ai_cost_destroys_economics` is a kill criterion for
  exactly this reason.
- **Owner attention remains the bottleneck despite automation.** Tracked
  directly as `humanHours` and scored as `founder_dependence`. A portfolio that
  needs more owner hours each month is not a portfolio; it is a job.

---

## What the holding company will not do

- Launch ventures faster than it can measure them.
- Enter regulated verticals (legal, medical, financial advice) without
  jurisdiction-specific review.
- Sell an outcome it cannot evidence.
- Automate contracts, money movement, hiring, firing, or regulatory
  communication.
- Describe internal management figures as audited financials.
- Claim a venture is autonomous. The platform tracks `automationPercent` and
  `humanHours` precisely so that claim is never necessary.
