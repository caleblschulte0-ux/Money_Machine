import { z } from "zod";
import type { AutonomyLevel } from "@holdco/core";

/**
 * The contract every venture module implements (playbook rule 15: venture
 * modules must stay isolated enough to disable).
 *
 * A venture module is *declarative*: it contributes definitions — offers,
 * workflows, agents, plans, flags, metrics — and the platform executes them.
 * Modules must not reach into other modules, and must not import each other.
 * Disabling a venture means not registering its manifest; nothing else in the
 * platform should change.
 */
export interface VentureOffer {
  readonly key: string;
  readonly name: string;
  /** What the customer actually receives. Vague scope is a failed offer gate. */
  readonly deliverable: string;
  readonly priceMinor: number;
  readonly billingInterval: "one_time" | "monthly" | "quarterly" | "annual";
  readonly setupFeeMinor?: number;
  /** The measurable outcome we are willing to defend in writing. */
  readonly outcomeClaim: string;
  /** Explicit statements of what this offer does NOT promise. */
  readonly nonClaims: readonly string[];
  readonly deliveryWorkflowKey: string;
}

export interface VentureMetricDefinition {
  readonly key: string;
  readonly label: string;
  readonly unit: "count" | "currency_minor" | "ratio" | "hours" | "days";
  readonly description: string;
  /** The number that tells us the venture is working. */
  readonly isNorthStar?: boolean;
}

export interface VentureKillCriterion {
  readonly description: string;
  readonly threshold: string;
  readonly measuredBy: string;
}

export interface VentureManifest {
  readonly key: string;
  readonly name: string;
  readonly brandName: string;
  readonly thesis: string;
  /** Which build phase this venture belongs to (playbook §39). */
  readonly phase: number;
  /** Ceiling for every workflow the module registers. */
  readonly maxAutonomyLevel: AutonomyLevel;
  readonly offers: readonly VentureOffer[];
  readonly workflowKeys: readonly string[];
  readonly agentKeys: readonly string[];
  readonly metrics: readonly VentureMetricDefinition[];
  readonly killCriteria: readonly VentureKillCriterion[];
  /** Feature flag that must be enabled for the module to do anything. */
  readonly featureFlagKey: string;
  /** Constraints a human must honour; surfaced in the command center. */
  readonly legalNotes: readonly string[];
  /** Honest status. `docs_only` means nothing executable exists yet. */
  readonly status: "docs_only" | "scaffolded" | "operational";
}

export const ventureManifestSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9-]{2,40}$/),
  name: z.string().min(1),
  brandName: z.string().min(1),
  thesis: z.string().min(20),
  phase: z.number().int().min(1).max(10),
  maxAutonomyLevel: z.number().int().min(0).max(5),
  offers: z.array(
    z.object({
      key: z.string().min(1),
      name: z.string().min(1),
      deliverable: z.string().min(20),
      priceMinor: z.number().int().min(0),
      billingInterval: z.enum(["one_time", "monthly", "quarterly", "annual"]),
      setupFeeMinor: z.number().int().min(0).optional(),
      outcomeClaim: z.string().min(10),
      nonClaims: z.array(z.string().min(5)).min(1),
      deliveryWorkflowKey: z.string().min(1),
    }),
  ),
  workflowKeys: z.array(z.string()),
  agentKeys: z.array(z.string()),
  metrics: z.array(
    z.object({
      key: z.string().min(1),
      label: z.string().min(1),
      unit: z.enum(["count", "currency_minor", "ratio", "hours", "days"]),
      description: z.string().min(5),
      isNorthStar: z.boolean().optional(),
    }),
  ),
  killCriteria: z
    .array(
      z.object({
        description: z.string().min(5),
        threshold: z.string().min(1),
        measuredBy: z.string().min(1),
      }),
    )
    .min(1, "Every venture must declare at least one kill criterion"),
  featureFlagKey: z.string().startsWith("feature."),
  legalNotes: z.array(z.string()),
  status: z.enum(["docs_only", "scaffolded", "operational"]),
});

export function validateManifest(manifest: VentureManifest): VentureManifest {
  const parsed = ventureManifestSchema.safeParse(manifest);
  if (!parsed.success) {
    throw new Error(
      `Invalid venture manifest for "${manifest.key}":\n` +
        parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n"),
    );
  }
  // Every offer must claim something measurable AND disclaim something. An
  // offer with no non-claims is how "AI replaces your staff" gets shipped.
  for (const offer of manifest.offers) {
    if (offer.nonClaims.length === 0) {
      throw new Error(`Offer "${offer.key}" must state what it does not promise.`);
    }
  }
  return manifest;
}

/** In-process registry of the venture modules this deployment has enabled. */
export class VentureModuleRegistry {
  private readonly manifests = new Map<string, VentureManifest>();

  register(manifest: VentureManifest): void {
    validateManifest(manifest);
    if (this.manifests.has(manifest.key)) {
      throw new Error(`Venture module "${manifest.key}" is already registered.`);
    }
    this.manifests.set(manifest.key, manifest);
  }

  get(key: string): VentureManifest | undefined {
    return this.manifests.get(key);
  }

  list(): readonly VentureManifest[] {
    return [...this.manifests.values()].sort((a, b) => a.phase - b.phase || a.key.localeCompare(b.key));
  }

  operational(): readonly VentureManifest[] {
    return this.list().filter((m) => m.status === "operational");
  }
}
