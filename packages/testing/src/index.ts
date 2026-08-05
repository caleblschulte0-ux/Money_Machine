import { FixedClock, newId, type JsonObject } from "@holdco/core";
import { loadEnv, type Env } from "@holdco/config";
import { createMemoryStore, type Organization, type Store, type Venture } from "@holdco/database";
import { MemorySink, createLogger } from "@holdco/observability";

/**
 * Test fixtures.
 *
 * Every value here is fictional. Domains use `.invalid` (RFC 2606, guaranteed
 * never to resolve) and phone numbers use the 555 range, so a test that
 * accidentally reaches a real provider still cannot reach a real person.
 */
export const FIXED_START = new Date("2026-03-01T09:00:00.000Z");

export function testClock(start: Date = FIXED_START): FixedClock {
  return new FixedClock(start);
}

export function testEnv(overrides: Partial<Env> = {}): Env {
  return loadEnv({
    NODE_ENV: "test",
    LOG_LEVEL: "error",
    STORE_DRIVER: "memory",
    MODEL_PROVIDER: "mock",
    EMAIL_PROVIDER: "mock",
    SMS_PROVIDER: "mock",
    PAYMENT_PROVIDER: "mock",
    ALLOW_PAID_PROVIDERS: "false",
    ALLOW_LIVE_COMMUNICATIONS: "false",
    ...(overrides as Record<string, unknown>),
  });
}

export function testLogger() {
  const sink = new MemorySink();
  return { logger: createLogger({ level: "error", sink }), sink };
}

export function testStore(clock = testClock()): Store {
  return createMemoryStore(() => clock.now());
}

export async function seedOrganization(
  store: Store,
  overrides: Partial<Organization> = {},
): Promise<Organization> {
  return store.organizations.create({
    id: overrides.id ?? newId("org"),
    name: overrides.name ?? "Northbridge Holdings",
    slug: overrides.slug ?? "northbridge",
    kind: overrides.kind ?? "holding",
    status: overrides.status ?? "active",
    metadata: overrides.metadata ?? {},
  });
}

export async function seedVenture(
  store: Store,
  organizationId: string,
  overrides: Partial<Venture> = {},
): Promise<Venture> {
  return store.ventures.create({
    id: overrides.id ?? newId("vnt"),
    organizationId,
    key: overrides.key ?? "test-venture",
    name: overrides.name ?? "Test Venture",
    brandName: overrides.brandName ?? "Test Brand",
    stage: overrides.stage ?? "validation",
    thesis: overrides.thesis ?? "A fictional venture used only in tests.",
    ownerUserId: overrides.ownerUserId ?? null,
    domains: overrides.domains ?? ["example.invalid"],
    maxAutonomyLevel: overrides.maxAutonomyLevel ?? 3,
    monthlyBudgetMinor: overrides.monthlyBudgetMinor ?? 100_000,
    stopLossMinor: overrides.stopLossMinor ?? 500_000,
    launchedAt: overrides.launchedAt ?? null,
    closedAt: overrides.closedAt ?? null,
    stageReason: overrides.stageReason ?? "seeded for tests",
    metadata: overrides.metadata ?? {},
  });
}

export interface SnapshotOverrides {
  revenueMinor?: number;
  cogsMinor?: number;
  aiSpendMinor?: number;
  marketingSpendMinor?: number;
  contractorSpendMinor?: number;
  otherSpendMinor?: number;
  customerCount?: number;
  newCustomers?: number;
  churnedCustomers?: number;
  refundsMinor?: number;
  receivablesMinor?: number;
  supportCases?: number;
  humanHours?: number;
  automatedActions?: number;
  manualActions?: number;
  activeSubscriptions?: number;
}

export function snapshotFixture(
  organizationId: string,
  ventureId: string,
  periodKey: string,
  overrides: SnapshotOverrides = {},
) {
  return {
    id: newId("evt"),
    organizationId,
    ventureId,
    periodKey,
    revenueMinor: overrides.revenueMinor ?? 0,
    cogsMinor: overrides.cogsMinor ?? 0,
    marketingSpendMinor: overrides.marketingSpendMinor ?? 0,
    contractorSpendMinor: overrides.contractorSpendMinor ?? 0,
    aiSpendMinor: overrides.aiSpendMinor ?? 0,
    otherSpendMinor: overrides.otherSpendMinor ?? 0,
    customerCount: overrides.customerCount ?? 0,
    activeSubscriptions: overrides.activeSubscriptions ?? 0,
    newCustomers: overrides.newCustomers ?? 0,
    churnedCustomers: overrides.churnedCustomers ?? 0,
    refundsMinor: overrides.refundsMinor ?? 0,
    receivablesMinor: overrides.receivablesMinor ?? 0,
    supportCases: overrides.supportCases ?? 0,
    humanHours: overrides.humanHours ?? 0,
    automatedActions: overrides.automatedActions ?? 0,
    manualActions: overrides.manualActions ?? 0,
    capturedAt: FIXED_START,
    createdAt: FIXED_START,
    updatedAt: FIXED_START,
  };
}

/** Fictional people and companies used across tests and the seed script. */
export const FICTIONAL = {
  contacts: [
    { firstName: "Dana", lastName: "Whitmore", email: "dana.whitmore@harbor-mechanical.invalid", phone: "555-0142", title: "Operations Manager" },
    { firstName: "Ruben", lastName: "Castellanos", email: "ruben@castellanos-roofing.invalid", phone: "555-0187", title: "Owner" },
    { firstName: "Priya", lastName: "Raghunathan", email: "priya.r@meridian-doors.invalid", phone: "555-0163", title: "Controller" },
    { firstName: "Tom", lastName: "Aldergate", email: "t.aldergate@aldergate-excavating.invalid", phone: "555-0119", title: "President" },
  ],
  accounts: [
    { name: "Harbor Mechanical Services", industry: "HVAC", employeeCount: 64, city: "Sioux Falls", state: "SD" },
    { name: "Castellanos Roofing", industry: "Roofing", employeeCount: 22, city: "Sioux Falls", state: "SD" },
    { name: "Meridian Commercial Doors", industry: "Commercial doors", employeeCount: 41, city: "Brandon", state: "SD" },
    { name: "Aldergate Excavating", industry: "Excavation", employeeCount: 18, city: "Harrisburg", state: "SD" },
  ],
} as const;

export function jsonObject(value: unknown): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}
