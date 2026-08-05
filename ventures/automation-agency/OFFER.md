# Offer

## 1. Automation Audit — $2,500, one-time

**Deliverable:** A two-week review of up to eight named processes, delivered as
a written findings document containing:

- Each process with the hours-per-month baseline **the client supplied**
- What can be automated, and what must stay human, with the reason
- Residual hours after automation, with a confidence rating
- A prioritised implementation list
- A fixed-price implementation quote

**Outcome claimed:** A prioritised list of automation opportunities with the
client's own baseline hours attached to each.

**Explicitly not claimed:**
- Any specific number of hours saved before the baseline is measured
- That any employee or role can be eliminated
- Implementation work (that is the second offer)

## 2. Department Automation — $12,000/month + $2,500 setup

**Deliverable:** Implementation of the agreed automations for one department:
integration setup, monitored failure handling, and a monthly report showing
hours before and after against the audit baseline.

**Outcome claimed:** The automations in the signed scope run in production with
monitored failure handling and a monthly before/after report.

**Explicitly not claimed:**
- A revenue increase
- Headcount reduction
- Coverage of changes the client's vendors make to their own APIs without notice

## The claim boundary, and why it is enforced in code

Every venture manifest must declare `nonClaims` for each offer —
`validateManifest()` rejects an offer without them. The audit prompt instructs
the analyst to output "hours not supplied" rather than estimate a figure the
client never gave, and to flag any process touching payments, contracts,
hiring, termination, medical or legal decisions as `REQUIRES_HUMAN_APPROVAL`.

The reasoning is commercial as much as ethical. A savings number we invented
becomes the number we are measured against, and we will lose. A savings number
the client gave us is one we can defend in month six.

## What is measured and reported

- Hours reduced against the client's own baseline
- Errors reduced (rework, re-entry, corrections)
- Response time improved
- Reporting time reduced

Never: headcount, and never a revenue claim.

## Delivery

Audit: intake call → process mapping → analyst agent draft → QC review →
**human review** → proposal. The proposal step stops at the approval queue
because a proposal is a commercial commitment.

Implementation: scoped build → staged rollout → monitoring → monthly report.
