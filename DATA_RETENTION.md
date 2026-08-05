# Data retention

## Principles

1. **Keep what the business needs and what the law requires. Nothing else.**
2. **Deletion is irreversible**, so the platform reports what is due and a human
   approves the deletion as an `account.delete` action.
3. **Suppression lists are permanent.** They are retained regardless of any
   other policy, and survive a venture's shutdown. Deleting a suppression to
   "clean up" would resurrect someone's inbox.
4. **The audit trail outlives the records it describes.** Otherwise a deletion
   cannot itself be audited.

## Intended schedule

| Data | Retention | Reason |
| --- | --- | --- |
| Suppression records | Permanent | Legal obligation not to contact |
| Consent records | 7 years after withdrawal | Proof of lawful basis |
| Audit events | 7 years | Investigation and accountability |
| Financial records (invoices, payments, cost entries) | 7 years | Tax and accounting |
| Customer contracts | 7 years after termination | Contractual claims |
| Active customer data | Duration of relationship + 2 years | Service and disputes |
| Unconverted leads | 24 months | Sales cycle |
| Spam and duplicate leads | 90 days | Only needed to keep detection working |
| Communications content | 3 years | Dispute resolution |
| Call recordings | 12 months | Where lawful and consented at all |
| Agent run inputs/outputs | 12 months | Debugging and quality review |
| Workflow run records | 24 months | Operational history |
| Application logs | 90 days | Debugging |

These are drafts, not legal advice, and are not jurisdiction-verified.

## Mechanism

```ts
const due = await platform.compliance.retentionCandidates(organizationId, {
  entity: "leads",
  retainDays: 730,
});
```

`retentionCandidates()` **reports only**. It never deletes. Executing deletion
is a high-risk action requiring approval.

Currently supported entities: `leads`, `communications`. Others need
implementing — see `docs/KNOWN_LIMITATIONS.md`.

## Privacy requests

A deletion request from a data subject overrides the schedule for that person's
data, except where a legal obligation requires retention (financial records,
suppression entries). `openDataSubjectRequest()` records the request with a
statutory deadline; an `opt_out` suppresses immediately and globally.

## Not implemented

- Automatic execution of any retention policy
- Retention for entities other than leads and communications
- Per-venture or per-jurisdiction schedules
- Anonymisation as an alternative to deletion
