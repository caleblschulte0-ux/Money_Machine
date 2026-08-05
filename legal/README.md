# Legal

**Nothing in this directory is legal advice, and nothing here has been reviewed
by an attorney.**

These are internal templates and policy drafts. They exist so the platform has
something concrete to point at, and so that a real review has a starting point.

## The rule about `attorney-approved/`

A document may be placed in `attorney-approved/` **only** when all of these are
true:

1. A named, licensed attorney reviewed that exact version
2. The review is documented with the date, the attorney and the jurisdictions
3. The document header records all of the above

The directory currently contains only its own README. Moving a file into it
without a real documented review would be fabricating legal approval, which the
build rules of this project forbid outright.

## Structure

| Directory | Contents |
| --- | --- |
| `holding-company/` | Entity structure, intercompany arrangements, ownership |
| `privacy/` | Privacy policy, data processing, retention schedules |
| `communications/` | Email/SMS/call consent, disclosures, recording notices |
| `contracts/` | Customer agreements, statements of work, vendor terms |
| `employment/` | Contractor agreements, IP assignment, classification |
| `venture-specific/` | Constraints that apply to one venture only |
| `attorney-approved/` | **Empty.** See the rule above. |

## Constraints the platform enforces in code

Some legal constraints are enforced rather than documented, which is stronger:

- Prohibited action kinds (legal advice, medical advice, hiring, termination,
  regulator communication, property transactions, fabricated reviews,
  impersonation) cannot be automated at any autonomy level and cannot be queued
  for approval.
- Marketing email requires a consent record with a stated lawful basis.
- Suppression outranks consent, permanently and portfolio-wide.
- Venture manifests must declare non-claims for every offer.
- Prompt guardrails forbid claiming a legal review or certification exists.

## Before any venture takes a real customer

- [ ] Entity formation and the operating agreement reviewed
- [ ] Customer agreement reviewed for that venture's jurisdiction
- [ ] Privacy policy reviewed against the data actually collected
- [ ] Communication consent practice reviewed per channel and state
- [ ] Insurance appropriate to the service reviewed
- [ ] Any regulated-vertical restrictions confirmed in writing
