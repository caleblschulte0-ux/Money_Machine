# CRM

One multi-tenant CRM for every venture. Every write goes through `CrmService`
rather than the store directly, so provenance, audit and venture ownership
cannot be forgotten.

## Entities

`Account` collapses what would otherwise be five tables — customers, vendors,
partners, affiliates, contractors and investors are one entity with a `type`.
That is ordinary CRM design and removes a great deal of duplicate code.

| Entity | Purpose |
| --- | --- |
| `Account` | Any organization: prospect, customer, vendor, partner, affiliate, contractor, investor |
| `Contact` | A person, optionally attached to an account |
| `Lead` | An inbound enquiry, before it becomes an opportunity |
| `Opportunity` | A deal in progress |
| `Task`, `Note` | Work and commentary, attachable to anything |
| `Communication` | Every email, SMS, call, meeting — inbound and outbound |
| `SupportCase` | Customer issues |
| `Campaign`, `Project`, `DocumentRecord` | Marketing, delivery, artefacts |

Every CRM record carries: venture ownership, source, status, assigned human,
assigned agent, tags, custom fields (`metadata`), timestamps, **data
confidence**, **consent status**, retention policy, and full audit history.

## Lead capture

`captureLead()` runs three checks in a deliberate order:

**1. Spam detection first.** A spam submission should never consume a scoring
model or reach a buyer. Signals: honeypot field, sub-2-second submission,
disposable email domain, repeated-digit phone, solicitation phrases, 3+ links,
machine-looking names. A filled honeypot is conclusive; otherwise two
independent signals are the bar.

**2. Duplicate detection second.** Two layers:

- A deterministic fingerprint over venture + normalised email + normalised
  phone + company + postal code + **service type**
- A fuzzy pass over recent leads: exact email/phone match after normalisation
  scores 1.0; company-name similarity alone stays below the 0.8 acceptance
  threshold, because rejecting a real lead costs a sale

Normalisation treats Gmail dots and `+tags` as the same mailbox and strips a
leading US country code.

Both layers are **scoped to the same service type**. The same person requesting
a roof quote and a plumbing quote is two legitimate leads.

**3. Scoring last.** Rules are data, not code, so a venture tunes its own model
without a deploy and every score carries its reasons — which matters when a
lead buyer disputes quality.

```ts
{ key: "stated_hours", field: "monthlyHoursOnProcess", operator: "gte",
  value: 20, points: 25, reason: "prospect can state 20+ hours/month" }
```

Operators: `equals`, `not_equals`, `contains`, `in`, `gt`, `gte`, `lt`, `lte`,
`exists`, `missing`, `matches`. A rule may set `disqualifies: true`.

A score with no reasons is a bug: when nothing matches, the reason list says
"No scoring rules matched this lead."

## Lead routing

`routeLead()` refuses to route anything not `qualified`, and refuses to route
the same lead twice. Both are how a lead-gen business loses buyer trust.

The lead-generation venture adds capacity, territory, exclusivity and rotation
logic in `ventures/lead-generation/src/routing.ts`, which returns every
rejected buyer with a reason — so "why didn't I get that one?" has an answer.
