import type { VentureManifest } from "@holdco/ventures";
import type { WorkflowDefinition } from "@holdco/workflows";
import type { FlagDefinition } from "@holdco/config";

export * from "./routing.ts";
export * from "./scoring.ts";

/**
 * Lead Generation Network — Phase 4 (playbook §11).
 *
 * The playbook is emphatic: build one vertical first, and do not launch dozens
 * of websites before the lead economics are proven. This module therefore
 * ships the *mechanics* — scoring, duplicate handling, buyer routing, refunds
 * — configured for a single vertical, and nothing that assumes scale.
 */
export const FLAGS: readonly FlagDefinition[] = [
  {
    key: "feature.venture.lead_generation",
    description: "Lead generation venture module.",
    defaultValue: false,
    status: "incomplete",
    owner: "venture_lead",
    ventures: ["lead-generation"],
  },
  {
    key: "killswitch.lead_routing",
    description: "Stop routing leads to buyers, e.g. during a quality dispute.",
    defaultValue: false,
    status: "stable",
    owner: "owner",
    ventures: ["lead-generation"],
  },
];

/**
 * Inbound lead routing.
 *
 * Autonomy level 3 with every step reversible. The lead is routed, the buyer
 * is notified and the lead is tagged — but billing the buyer is deliberately
 * not part of this workflow, because charging on a lead the buyer may dispute
 * is a `payment.charge` action and belongs behind an approval.
 */
export const LEAD_ROUTING_WORKFLOW: WorkflowDefinition = {
  key: "leadgen.route_inbound",
  version: 1,
  name: "Route an inbound lead to a buyer",
  description:
    "Routes a qualified, non-duplicate lead to the next eligible buyer by territory and capacity, then notifies them. Billing happens separately after the acceptance window.",
  ventureKey: "lead-generation",
  trigger: {
    type: "lead.created",
    when: {
      op: "all",
      conditions: [
        { op: "equals", path: "ventureKey", value: "lead-generation" },
        { op: "equals", path: "status", value: "qualified" },
      ],
    },
    idempotencyPath: "leadId",
  },
  autonomyLevel: 3,
  maxRunCostMinor: 50,
  killSwitchKey: "killswitch.lead_routing",
  status: "draft",
  steps: [
    {
      id: "tag_service",
      name: "Tag lead with its service type",
      action: "record.tag",
      actionKind: "record.tag",
      input: { entity: "leads", id: "{{trigger.leadId}}", tag: "{{trigger.serviceType}}" },
      reversible: true,
    },
    {
      id: "notify_buyer",
      name: "Notify the assigned buyer",
      action: "email.send",
      actionKind: "email.send_transactional",
      input: {
        to: "{{trigger.buyerEmail}}",
        from: "leads@example.invalid",
        subject: "New {{trigger.serviceType}} lead in {{trigger.postalCode}}",
        body:
          "A new lead is waiting in your dashboard.\n\n" +
          "Service: {{trigger.serviceType}}\nArea: {{trigger.postalCode}}\n\n" +
          "You have 24 hours to accept or dispute this lead.",
        purpose: "transactional",
        accountId: "{{trigger.buyerAccountId}}",
      },
      maxRetries: 2,
      onFailure: "queue",
      reversible: true,
    },
    {
      id: "acceptance_task",
      name: "Track the acceptance window",
      action: "task.create",
      actionKind: "task.create",
      input: {
        title: "Confirm lead acceptance: {{trigger.leadId}}",
        description:
          "Check whether the buyer accepted or disputed within 24 hours. Do not invoice a disputed lead.",
        priority: "normal",
        relatedType: "lead",
        relatedId: "{{trigger.leadId}}",
      },
      reversible: true,
    },
  ],
};

export const MANIFEST: VentureManifest = {
  key: "lead-generation",
  name: "Lead Generation Network",
  brandName: "Trade Route Leads",
  thesis:
    "Local service contractors buy leads continuously and judge suppliers on exclusivity, speed and dispute handling rather than volume. Proving per-lead economics in a single trade and a single metro is the only way to know whether the model is worth replicating.",
  phase: 4,
  maxAutonomyLevel: 3,
  featureFlagKey: "feature.venture.lead_generation",
  status: "docs_only",
  offers: [
    {
      key: "per_lead",
      name: "Pay Per Lead",
      deliverable:
        "Exclusive delivery of a qualified enquiry matching the buyer's trade and service area, with the enquiry details and a 24-hour dispute window.",
      priceMinor: 8_500,
      billingInterval: "one_time",
      outcomeClaim:
        "Each lead is exclusive to one buyer, screened for duplicates and spam, and disputable within 24 hours.",
      nonClaims: [
        "Does not guarantee the lead will answer the phone or book a job.",
        "Does not guarantee any close rate or revenue.",
        "Does not guarantee lead volume in any period.",
      ],
      deliveryWorkflowKey: "leadgen.route_inbound",
    },
    {
      key: "territory",
      name: "Exclusive Monthly Territory",
      deliverable:
        "All qualified leads for one trade in an agreed set of postal codes for a calendar month, with a monthly report showing delivered, accepted and disputed counts.",
      priceMinor: 250_000,
      billingInterval: "monthly",
      outcomeClaim:
        "Every qualified lead generated in the agreed territory goes to this buyer and no other during the term.",
      nonClaims: [
        "Does not guarantee a minimum number of leads.",
        "Does not guarantee job value or close rate.",
        "Exclusivity covers our own channels only, not the buyer's other suppliers.",
      ],
      deliveryWorkflowKey: "leadgen.route_inbound",
    },
  ],
  workflowKeys: [LEAD_ROUTING_WORKFLOW.key],
  agentKeys: ["support.reply", "quality.control"],
  metrics: [
    { key: "cost_per_qualified_lead", label: "Cost per qualified lead", unit: "currency_minor", description: "Marketing spend divided by qualified leads. The number the whole venture lives on.", isNorthStar: true },
    { key: "lead_acceptance_rate", label: "Buyer acceptance rate", unit: "ratio", description: "Share of delivered leads buyers accept rather than dispute." },
    { key: "dispute_rate", label: "Dispute rate", unit: "ratio", description: "Share of leads disputed. Above 10% signals a quality problem." },
    { key: "duplicate_rate", label: "Duplicate rate", unit: "ratio", description: "Share of submissions caught as duplicates before delivery." },
    { key: "buyer_retention", label: "Buyer retention", unit: "ratio", description: "Share of buyers still purchasing after 90 days." },
  ],
  killCriteria: [
    { description: "Cost per qualified lead exceeds what buyers will pay", threshold: "cost_per_qualified_lead above the per-lead price for two consecutive months", measuredBy: "marketing cost ledger vs qualified lead count" },
    { description: "Buyers dispute too many leads", threshold: "dispute_rate above 15% across 100 delivered leads", measuredBy: "lead acceptance records" },
    { description: "Buyers do not stay", threshold: "buyer_retention under 40% at 90 days", measuredBy: "subscription and purchase history" },
    { description: "The vertical cannot absorb the volume", threshold: "fewer than three active buyers willing to take exclusive territory in the metro", measuredBy: "CRM buyer pipeline" },
  ],
  legalNotes: [
    "Call recording requires jurisdiction-specific consent handling; do not enable recording until the applicable state rules are documented per territory.",
    "Lead forms must carry a clear disclosure that the enquiry will be shared with a service provider.",
    "Do not represent the venture as the service provider itself.",
    "Regulated verticals (legal, financial, medical) require a separate compliance review before any campaign runs.",
    "Every buyer agreement must state that no lead volume is guaranteed.",
  ],
};

export const MODULE = {
  manifest: MANIFEST,
  workflows: [LEAD_ROUTING_WORKFLOW],
  agents: [],
  prompts: [],
  flags: FLAGS,
} as const;
