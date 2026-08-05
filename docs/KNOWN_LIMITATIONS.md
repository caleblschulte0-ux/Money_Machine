# Known limitations

Written so nobody discovers these by being surprised in production.

## Never executed against a real dependency

**The Prisma adapter has never run against a live PostgreSQL instance.** It is
written and typechecked, and the filter grammar was designed to be a subset of
Prisma's `where` syntax, but the first `pnpm db:push` in a real environment
should be treated as unverified. The in-memory store is what the 133 tests
exercise.

**No paid provider adapter exists.** Model, SMS, telephony and payment adapters
for real vendors throw a clear error naming what is missing. They do not
half-work and they never fabricate success.

## Simulated actions

These workflow actions are registered and runnable, but record what they *would*
have done and return `simulated: true`:

`sms.send`, `call.start`, `document.generate`, `invoice.create`,
`followup.schedule`, `content.publish`, `file.export`, `webhook.trigger`,
`campaign.pause`, `case.escalate`

A workflow using them completes, and its output is explicitly marked so no
report can mistake it for a real effect.

## The Command Center is read-only

Every page renders real data, but **no page performs a write**. You cannot
approve an approval, publish a workflow, allocate capital or edit a venture from
the UI. Those paths exist in the services and are covered by tests; the UI does
not call them.

There is also **no authentication in the UI**. The app assumes a single trusted
operator on a trusted network. This must be fixed before any deployment.

## Automatic workflow retry is not implemented

A failed step with `onFailure: "queue"` writes a scheduled job. The worker
escalates that job to a human rather than replaying it, because replaying a
half-completed run without knowing which side effects landed can double-charge
or double-send. Safe automatic replay needs per-step idempotency, which is
designed but not built.

## The worker runs once and exits

There is no scheduler, no lease, no concurrency control. `pnpm worker` runs each
job once. Production needs a real scheduler, and `ScheduledJob.lockedUntil`
exists in the schema for the lease but nothing uses it.

## MFA is enforced but not implemented

`user.mfaEnrolled` and `session.mfaSatisfied` are checked at authentication, so
a session that has not satisfied MFA is rejected. **There is no second factor**
— nothing can set `mfaSatisfied` to true except session creation for a user who
is not enrolled. Enrolling a user today locks them out.

## Knowledge search is lexical

Term-overlap scoring with title and tag weighting. No embeddings, no semantic
matching, no chunking of long documents. It is honest about being lexical and
sits behind an interface that a vector store can replace. For a few hundred
short documents it works; it will not scale to a large corpus.

## Health scoring depends on entered data

Six of fifteen health dimensions (concentration, legal risk, market size,
competitive pressure, data advantage, synergy, engineering hours) have no
automatic source. Nothing writes them today, so a real venture will show
roughly 60% coverage until someone enters them. The score reports this rather
than hiding it, but the number is weaker than it looks.

## Metric snapshots are manual

`recordSnapshot()` exists and the seed uses it, but nothing computes a snapshot
from underlying records automatically. Revenue, customer count and churn on the
dashboard come from whatever was recorded, not from the transaction history.

## Cost attribution has a gap

Costs are attributed when a workflow or agent records them. **Human time is not
tracked at all** — `humanHours` is entered on the snapshot. Since founder
dependence is a kill criterion, that number matters and currently depends on
someone being honest with themselves.

## Billing gaps

No dunning, proration, tax, revenue recognition, refund workflow, or
customer-facing invoice. Invoices are internal records with no PDF and no
delivery.

## Compliance gaps

No jurisdiction-specific rule engine. State-level differences — call-recording
consent in particular — are documented in venture legal notes but not encoded.
Retention is reported, never executed.

## Testing gaps

- `security` has no direct unit tests; it is exercised through `auth`
- No end-to-end browser tests (Playwright is not configured)
- No load or concurrency testing anywhere
- The Prisma adapter is untested by definition, since no database is available
  in the build environment

## Scale assumptions

The in-memory store holds everything in `Map`s and clones on read. Duplicate
detection scans up to 500 recent leads per capture in memory. Both are fine for
development and wrong for production volume — which is what the Prisma adapter
is for, once it has been exercised.
