# Security policy

## Reporting a vulnerability

Report privately to the repository owner. Do not open a public issue. Include
what you did, what happened, and what you expected. Expect an acknowledgement
within 3 business days.

Do not test against systems you do not own, and do not access data that is not
yours.

## Scope

In scope: this repository's code, its dependencies, and any deployed instance
owned by the holding company.

Out of scope: third-party vendor infrastructure, denial of service, social
engineering, and findings that require a compromised developer machine.

## Current posture

This platform has **not been deployed**. There is no production instance, no
customer data, and no live provider credentials anywhere in this repository.

Known gaps are documented in `docs/KNOWN_LIMITATIONS.md`. The significant ones:

- No authentication in the Command Center UI
- MFA is enforced at authentication but has no implemented second factor
- No dependency scanning in CI
- Restore procedures are documented but never exercised

See `docs/SECURITY.md` for the architecture, `THREAT_MODEL.md` for what is being
defended against, and `INCIDENT_RESPONSE.md` for what happens when something
goes wrong.
