import type { RoleKey } from "@holdco/database";
import { errors, type TenantScope } from "@holdco/core";

/**
 * Permissions are verbs on resources: `resource:action`. Roles are bundles of
 * permissions. Nothing in the codebase should branch on a role name directly —
 * always ask `can(scope, permission)` so the mapping stays in one place.
 */
export const PERMISSIONS = [
  "org:read", "org:manage",
  "user:read", "user:invite", "user:manage",
  "venture:read", "venture:create", "venture:manage", "venture:activate", "venture:shutdown",
  "crm:read", "crm:write", "crm:delete", "crm:export",
  "workflow:read", "workflow:author", "workflow:publish", "workflow:run", "workflow:kill",
  "agent:read", "agent:author", "agent:run",
  "approval:read", "approval:decide",
  "cost:read", "budget:manage",
  "billing:read", "billing:manage", "billing:charge", "billing:refund",
  "experiment:read", "experiment:manage", "experiment:decide",
  "knowledge:read", "knowledge:write", "knowledge:approve",
  "compliance:read", "compliance:manage",
  "audit:read",
  "flag:read", "flag:manage",
  "support:read", "support:write",
  "capital:allocate",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Role definitions.
 *
 * `owner` is the only role that can allocate capital, approve money movement
 * and activate a venture — that concentration is intentional (playbook §1:
 * human involvement concentrates around capital, legal, banking, signing).
 */
export const ROLE_PERMISSIONS: Record<RoleKey, readonly Permission[]> = {
  owner: [...PERMISSIONS],

  operator: [
    "org:read", "user:read", "user:invite",
    "venture:read", "venture:create", "venture:manage",
    "crm:read", "crm:write", "crm:delete",
    "workflow:read", "workflow:author", "workflow:publish", "workflow:run", "workflow:kill",
    "agent:read", "agent:author", "agent:run",
    "approval:read",
    "cost:read",
    "billing:read",
    "experiment:read", "experiment:manage",
    "knowledge:read", "knowledge:write",
    "compliance:read",
    "audit:read",
    "flag:read",
    "support:read", "support:write",
  ],

  venture_lead: [
    "org:read", "user:read",
    "venture:read", "venture:manage",
    "crm:read", "crm:write",
    "workflow:read", "workflow:author", "workflow:run", "workflow:kill",
    "agent:read", "agent:run",
    "approval:read",
    "cost:read",
    "billing:read",
    "experiment:read", "experiment:manage",
    "knowledge:read", "knowledge:write",
    "audit:read",
    "support:read", "support:write",
  ],

  analyst: [
    "org:read", "venture:read", "crm:read", "workflow:read", "agent:read",
    "cost:read", "billing:read", "experiment:read", "knowledge:read",
    "audit:read", "support:read", "flag:read",
  ],

  finance: [
    "org:read", "venture:read", "crm:read",
    "cost:read", "budget:manage",
    "billing:read", "billing:manage", "billing:charge", "billing:refund",
    "approval:read", "approval:decide",
    "experiment:read",
    "audit:read",
  ],

  support: [
    "org:read", "venture:read",
    "crm:read", "crm:write",
    "support:read", "support:write",
    "knowledge:read",
    "workflow:read", "agent:read", "agent:run",
  ],

  customer_admin: [
    "org:read", "user:read", "user:invite",
    "crm:read", "crm:write",
    "billing:read",
    "support:read", "support:write",
    "knowledge:read",
  ],

  customer_user: ["org:read", "crm:read", "support:read", "support:write", "knowledge:read"],

  /**
   * The role assigned to agent runs. Deliberately narrow: an agent can read and
   * write CRM data and request approvals, but can never decide an approval,
   * move money, publish a workflow or manage compliance state.
   */
  agent: [
    "venture:read",
    "crm:read", "crm:write",
    "workflow:read", "workflow:run",
    "agent:read",
    "approval:read",
    "knowledge:read",
    "support:read", "support:write",
    "cost:read",
  ],
};

/** Permissions no agent may ever hold, checked defensively at grant time. */
const AGENT_FORBIDDEN: readonly Permission[] = [
  "approval:decide", "billing:charge", "billing:refund", "capital:allocate",
  "venture:activate", "venture:shutdown", "crm:export", "crm:delete",
  "compliance:manage", "flag:manage", "user:manage", "org:manage",
  "workflow:publish", "budget:manage", "knowledge:approve",
];

for (const forbidden of AGENT_FORBIDDEN) {
  if (ROLE_PERMISSIONS.agent.includes(forbidden)) {
    throw new Error(
      `Role "agent" must not hold permission "${forbidden}". ` +
        `Agents propose; humans decide.`,
    );
  }
}

export interface AuthorizedScope extends TenantScope {
  readonly roles: readonly RoleKey[];
  readonly permissions: ReadonlySet<Permission>;
}

export function permissionsForRoles(roles: readonly RoleKey[]): Set<Permission> {
  const out = new Set<Permission>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) out.add(permission);
  }
  return out;
}

export function can(scope: AuthorizedScope, permission: Permission): boolean {
  return scope.permissions.has(permission);
}

export function assertCan(scope: AuthorizedScope, permission: Permission): void {
  if (!can(scope, permission)) {
    throw errors.forbidden(`Missing permission "${permission}"`, {
      required: permission,
      roles: [...scope.roles],
    });
  }
}

/** Every permission a role holds, for the settings screen. */
export function describeRole(role: RoleKey): { role: RoleKey; permissions: readonly Permission[] } {
  return { role, permissions: ROLE_PERMISSIONS[role] ?? [] };
}
