import { AppError } from "./errors.ts";

/**
 * Two independent isolation axes:
 *
 *  - `organizationId` — the customer tenant. Customer A must never read
 *    customer B's rows.
 *  - `ventureId` — which business inside the holding company owns the record.
 *    A venture can be paused, sold or shut down; its data must be separable.
 *
 * Holding-company staff act with a `ventureScope` that lists the ventures they
 * may touch, or `"all"` for portfolio-level roles.
 */
export interface TenantScope {
  readonly organizationId: string;
  readonly ventureScope: "all" | readonly string[];
  /** Present when the actor is a human. */
  readonly userId?: string;
  /** Present when the actor is an agent run. */
  readonly agentRunId?: string;
  readonly correlationId?: string;
}

export interface VentureScoped {
  readonly organizationId: string;
  readonly ventureId: string;
}

export function canAccessVenture(scope: TenantScope, ventureId: string): boolean {
  if (scope.ventureScope === "all") return true;
  return scope.ventureScope.includes(ventureId);
}

export function assertVentureAccess(scope: TenantScope, ventureId: string): void {
  if (!canAccessVenture(scope, ventureId)) {
    throw new AppError("forbidden", "Actor is not scoped to this venture", {
      ventureId,
      organizationId: scope.organizationId,
    });
  }
}

export function assertSameOrganization(scope: TenantScope, record: { organizationId: string }): void {
  if (scope.organizationId !== record.organizationId) {
    throw new AppError("forbidden", "Cross-organization access denied", {
      expected: scope.organizationId,
      actual: record.organizationId,
    });
  }
}

/** Narrow a scope to a single venture, e.g. when entering a venture module. */
export function narrowToVenture(scope: TenantScope, ventureId: string): TenantScope {
  assertVentureAccess(scope, ventureId);
  return { ...scope, ventureScope: [ventureId] };
}

/**
 * The scope used by background jobs that legitimately operate across the whole
 * holding company (rollups, retention sweeps). Never derive this from user
 * input.
 */
export function systemScope(organizationId: string, correlationId?: string): TenantScope {
  return { organizationId, ventureScope: "all", correlationId };
}
