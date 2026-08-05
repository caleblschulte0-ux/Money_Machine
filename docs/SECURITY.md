# Security

See also `SECURITY.md`, `THREAT_MODEL.md`, `INCIDENT_RESPONSE.md`,
`BACKUP_RESTORE.md`, `DATA_RETENTION.md` and `ACCESS_CONTROL.md` at the
repository root.

## Boundaries

**Organization isolation.** Every record carries `organizationId`. Services
take a `TenantScope` and `assertSameOrganization()` refuses cross-tenant access.

**Venture isolation.** Every record carries `ventureId`. An actor's
`ventureScope` is `"all"` or an explicit list; `assertVentureAccess()` enforces
it. This axis exists so a venture's data is separable when it is sold or closed.

**Agent isolation.** An agent run's scope is always the narrow `agent` role
pinned to a single venture, carrying the run id. Every write an agent makes is
attributable to a specific run.

## Authentication

- **Passwords**: scrypt (N=2^15, r=8, p=1) via the Node standard library — no
  native dependency, no vendor. Minimum 12 characters, common-password list.
- **Sessions**: 256-bit random tokens. Only the SHA-256 digest is stored, so a
  database leak yields no live sessions. 12-hour expiry.
- **Login**: rate limited to 5 attempts per 15 minutes per account. Identical
  failure for "no such user" and "wrong password" — no enumeration. Every
  failure is audited with a reason.
- **MFA**: `user.mfaEnrolled` and `session.mfaSatisfied` exist and are enforced
  at `authenticate()`. **The second factor itself is not implemented** — see
  `docs/KNOWN_LIMITATIONS.md`.

## Authorization

Permissions are `resource:action` strings; roles are bundles. Nothing branches
on a role name directly — always `can(scope, permission)`.

The `agent` role is deliberately narrow, and a startup assertion fails the
process if it ever gains `approval:decide`, `billing:charge`, `billing:refund`,
`capital:allocate`, `venture:activate`, `venture:shutdown`, `crm:export`,
`crm:delete`, `compliance:manage`, `flag:manage`, `user:manage`, `org:manage`,
`workflow:publish`, `budget:manage` or `knowledge:approve`.

Agents propose; humans decide.

## Secrets

- Never committed. `.env` is gitignored; only `.env.example` with placeholders
  is tracked.
- `SESSION_SECRET` and `FIELD_ENCRYPTION_KEY` must be real values in
  production — the config layer refuses to boot with the dev defaults.
- Sensitive fields encrypt with AES-256-GCM, random 96-bit IV per value.
  `blindIndex()` provides deterministic equality lookup without decrypting.

## Redaction

`redact()` strips values at known-sensitive keys (password, secret, token,
api_key, authorization, ssn, tax_id, card_number, cvv, account_number,
routing_number, private_key) before anything is logged or written to the audit
trail. Both the logger and `AuditLog` apply it automatically.

Email addresses are masked in audit summaries (`da***@example.invalid`).

## Input and webhooks

- Zod validates every boundary: environment, agent I/O, venture manifests,
  workflow definitions.
- Workflow conditions are a fixed declarative grammar — no `eval`, no template
  language, no arbitrary predicates.
- `verifyWebhook()` uses constant-time comparison plus a 5-minute timestamp
  window so a captured payload cannot be replayed indefinitely.

## Rate limiting

Token bucket, in-memory by default and swappable for Redis. Defaults: login
5/15min, password reset 3/hour, API 120 burst at 2/s, agent runs 20/hour per
customer, outbound email 3/day per contact.

## Not yet implemented

- The MFA second factor
- Dependency scanning in CI
- Restore testing (documented, never exercised)
- Session binding to IP or device
- Field encryption applied to specific columns by default (the primitives exist;
  no column currently uses them)
