# Compliance

**Nothing in this repository is legal advice, and no file may be labelled
attorney-approved without a real, documented review.** The `legal/` tree
contains templates and internal policy, not vetted instruments.

## The ordering rule

`canContact()` is the single check every outbound message passes:

```
1. Suppression   → an unsubscribe outranks any later consent record
2. Consent       → marketing and all SMS/calls require it
3. Frequency cap → per recipient, per channel
```

Suppression beating consent is deliberate. Someone who unsubscribed and later
appears on a purchased list with a "consent" record must stay suppressed.

Every decision returns the reason, so a blocked send can be explained to a
customer or a regulator without reconstructing state.

## Consent

Records carry: identifier, channel, status, **lawful basis**, capture method,
evidence, expiry. Recording consent without a basis is rejected.

Withdrawing or denying consent **automatically creates a suppression** in the
same call, so the two can never drift apart.

Transactional email to an existing customer does not require marketing consent.
SMS and calls always do.

## Suppression

Scopes: `venture`, `organization` (default) and `global`. Organization and
global suppressions apply across every venture in the portfolio — a person who
opted out of one brand should not be contacted by a sibling brand they have
never heard of.

Reasons: unsubscribe, complaint, bounce, legal, manual, do-not-contact.

## Privacy requests

`openDataSubjectRequest()` records the request with a statutory due date
(default 30 days). An `opt_out` request suppresses **immediately, globally**;
the paperwork follows. `overdueRequests()` surfaces anything past its deadline.

## Retention

`retentionCandidates()` **reports** what is due for deletion; it does not
delete. Deletion is irreversible, so it runs through the approval queue as an
`account.delete` action.

## Disclosures

Held as data in `REQUIRED_DISCLOSURES` so the content pipeline and the QC agent
check against the same list: affiliate, AI-generated, sponsored, call
recording, review requests.

## Prohibited, portfolio-wide

Encoded in the autonomy policy as `prohibited` action kinds, so they cannot be
automated at any level and cannot even be queued for approval:

- Legal or medical advice
- Hiring or termination decisions
- Regulator communication
- Property transactions
- Fabricated reviews
- Impersonating a person

## Venture-specific constraints

Each manifest declares `legalNotes`, surfaced on the venture page. Examples:

- **Automation agency**: savings claims must cite client-supplied baselines;
  marketing must never imply staff elimination.
- **AI visibility**: no offer may promise placement or ranking; probing external
  answer engines is gated behind a flag pending a terms review.
- **Lead generation**: call recording needs jurisdiction-specific consent per
  territory; forms must disclose that the enquiry is shared; regulated verticals
  need separate review.

## Open items

- No jurisdiction-specific rule engine. State-level differences (call recording
  consent in particular) are documented, not encoded.
- No automated retention execution.
- Consent expiry is supported but no venture sets one.
