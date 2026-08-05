# Access control

## Model

Permissions are `resource:action`. Roles are bundles of permissions. **Nothing
in the codebase branches on a role name** — always `can(scope, permission)`, so
the mapping lives in exactly one file (`packages/auth/src/rbac.ts`).

## Roles

| Role | Intended holder | Notable powers |
| --- | --- | --- |
| `owner` | The principal | Everything, including `capital:allocate`, `venture:activate`, `billing:charge` |
| `operator` | Trusted staff | Run the business day to day; cannot allocate capital, charge, or activate a venture |
| `venture_lead` | Runs one venture | Scoped to their ventures; can author and kill workflows |
| `analyst` | Read-only | Every read permission, no writes |
| `finance` | Bookkeeping and money | `budget:manage`, `billing:*`, and `approval:decide` |
| `support` | Customer support | CRM read/write, cases, can run agents |
| `customer_admin` | A customer's admin | Their own organization only |
| `customer_user` | A customer's user | Read plus support cases |
| `agent` | **Every agent run** | Deliberately narrow — see below |

## The agent role

An agent run always carries the `agent` role pinned to a single venture. It may
read and write CRM data, run workflows, read knowledge, and handle support
cases. It may **not**:

`approval:decide`, `billing:charge`, `billing:refund`, `capital:allocate`,
`venture:activate`, `venture:shutdown`, `crm:export`, `crm:delete`,
`compliance:manage`, `flag:manage`, `user:manage`, `org:manage`,
`workflow:publish`, `budget:manage`, `knowledge:approve`

This is enforced by a module-level assertion that throws at startup if any of
those permissions is ever added to the role. The check runs before the process
can serve a request, so the mistake cannot ship quietly.

Agents propose. Humans decide.

## Two isolation axes

- **`organizationId`** — customer isolation. `assertSameOrganization()`.
- **`ventureScope`** — `"all"` or an explicit list. `assertVentureAccess()`.

`narrowToVenture()` produces a scope restricted to one venture when entering a
venture module. `systemScope()` produces a cross-venture scope for background
jobs and must never be derived from user input.

## Sessions and keys

- Sessions: 256-bit tokens, only the SHA-256 digest stored, 12-hour expiry,
  revocable, pruned by the worker.
- API keys: same digest-only storage, scoped to an organization and optionally a
  venture, with a per-key rate limit. **No API surface consumes them yet.**

## Granting and revoking

Every membership change is audited with the actor, role and venture scope.
Revocation sets `status: "revoked"` rather than deleting, so history survives.

## Gaps

- No authentication in the Command Center UI
- No MFA second factor (enforcement exists; the factor does not)
- No permission delegation or temporary elevation
- No session binding to IP or device
