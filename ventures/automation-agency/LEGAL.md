# Legal

**Not legal advice. Nothing here has been reviewed by an attorney.**

## Constraints in the manifest

Surfaced on the venture page in the Command Center:

1. Client credentials are handled under a written access agreement; never store
   a client credential outside the approved secret store.
2. Savings claims in proposals must cite the client's own supplied baseline
   figures.
3. Marketing must never state or imply that staff can be eliminated.
4. Implementations touching payment, payroll or HR data require a written scope
   addendum before work begins.

## Client system access — the largest exposure

The agency holds credentials to client systems. A compromise here is a
compromise of *their* business, and that is a materially different liability
from losing our own data.

Requirements before any credential is accepted:

- [ ] A written access agreement naming systems, scope and duration
- [ ] Least privilege — a dedicated integration account, never a person's login
- [ ] Credentials in a managed secret store, never in this repository, never in
      a ticket, never in email
- [ ] Documented revocation at project end
- [ ] Client-side audit logging enabled where the system supports it

**No client credential should be accepted until the secret store exists.** It
does not yet.

## Claims

The exposure is a client acting on a savings estimate and later disputing it.
Mitigations, in order of strength:

1. **Prompt-level** — the analyst is instructed to output "hours not supplied"
   rather than estimate
2. **Contractual** — the proposal states that projections derive from
   client-supplied baselines
3. **Reporting** — monthly before/after against the same baseline
4. **Never** claiming headcount reduction

## Data processing

Client data flows through this platform during delivery, which likely makes the
agency a data processor. Needed before real client data:

- [ ] A data processing agreement in the customer contract
- [ ] Documented sub-processors (any AI provider is one)
- [ ] Deletion procedure on termination
- [ ] Breach notification terms

Note that sending client data to a model provider makes that provider a
sub-processor. This must be disclosed, and it is a reason the platform defaults
to mock providers.

## Employment classification

Contractor implementation help must be genuinely contracted — scope of work,
control over method, own tools. Misclassification is a real liability in trade
services, and the platform does not manage it.

## Before the first real client

- [ ] Customer agreement reviewed by an attorney
- [ ] Data processing agreement reviewed
- [ ] Access agreement template reviewed
- [ ] Professional liability insurance appropriate to systems integration
- [ ] Secret store in place
