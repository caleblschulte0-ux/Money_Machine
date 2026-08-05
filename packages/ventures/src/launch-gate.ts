import type { JsonObject } from "@holdco/core";

/**
 * Venture launch gate (playbook §29). A venture cannot leave `validation`
 * until all five gates pass.
 *
 * Every gate requirement is a question a human answers with *evidence*, not a
 * checkbox. Evidence is stored on the gate result so a later reader can judge
 * whether the gate was passed honestly.
 */
export type GateKey = "problem" | "offer" | "demand" | "economic" | "operational";

export interface GateRequirement {
  readonly key: string;
  readonly question: string;
  /** What counts as evidence. Vague evidence is a failed gate. */
  readonly evidenceExpected: string;
  /** When true, the gate cannot pass without this requirement. */
  readonly required: boolean;
}

export interface GateSpec {
  readonly key: GateKey;
  readonly title: string;
  readonly description: string;
  readonly requirements: readonly GateRequirement[];
  /** For gates where any one of several proofs suffices. */
  readonly anyOf?: readonly string[];
}

export const LAUNCH_GATES: readonly GateSpec[] = [
  {
    key: "problem",
    title: "Problem validation",
    description: "A specific, painful problem held by an identifiable customer who already spends money on it.",
    requirements: [
      { key: "specific_problem", question: "What is the specific problem, in the customer's words?", evidenceExpected: "Quotes from at least three conversations, with dates and roles.", required: true },
      { key: "identifiable_customer", question: "Who exactly has it?", evidenceExpected: "A named segment with a countable population and a way to reach them.", required: true },
      { key: "existing_spend", question: "What do they spend on it today?", evidenceExpected: "Current tool, staff time or vendor invoices with amounts.", required: true },
      { key: "inadequate_alternatives", question: "Why are existing solutions inadequate?", evidenceExpected: "Specific failure modes of the incumbents, not adjectives.", required: true },
    ],
  },
  {
    key: "offer",
    title: "Offer validation",
    description: "A concrete deliverable at a concrete price with a stated outcome and delivery method.",
    requirements: [
      { key: "deliverable", question: "What exactly does the customer receive?", evidenceExpected: "A scope document a stranger could deliver against.", required: true },
      { key: "price", question: "What does it cost?", evidenceExpected: "A price and the reasoning behind it.", required: true },
      { key: "outcome", question: "What outcome is promised?", evidenceExpected: "A measurable claim we can defend, with the measurement method.", required: true },
      { key: "delivery", question: "How is it delivered?", evidenceExpected: "The workflow, who runs it, and the expected cycle time.", required: true },
    ],
  },
  {
    key: "demand",
    title: "Demand validation",
    description: "Evidence that customers will actually pay. At least one proof is required.",
    requirements: [
      { key: "paid_pilot", question: "Has anyone paid for a pilot?", evidenceExpected: "Invoice or payment record.", required: false },
      { key: "letter_of_intent", question: "Is there a signed letter of intent?", evidenceExpected: "Countersigned document reference.", required: false },
      { key: "deposits", question: "Have deposits been taken?", evidenceExpected: "Payment records.", required: false },
      { key: "qualified_waitlist", question: "Is there a qualified waitlist?", evidenceExpected: "Named contacts who confirmed budget and timing.", required: false },
      { key: "outbound_response", question: "Did outbound produce a strong response?", evidenceExpected: "Sent volume, reply rate and meeting count.", required: false },
      { key: "customer_request", question: "Did an existing customer ask for this?", evidenceExpected: "The request, with the account and date.", required: false },
    ],
    anyOf: ["paid_pilot", "letter_of_intent", "deposits", "qualified_waitlist", "outbound_response", "customer_request"],
  },
  {
    key: "economic",
    title: "Economic validation",
    description: "The unit economics work before scale, not after a hoped-for efficiency.",
    requirements: [
      { key: "cac", question: "Estimated customer acquisition cost?", evidenceExpected: "A number with the channel and assumptions behind it.", required: true },
      { key: "gross_margin", question: "Expected gross margin?", evidenceExpected: "Revenue minus delivery cost, AI cost and labour.", required: true },
      { key: "delivery_cost", question: "Cost to deliver one unit?", evidenceExpected: "Itemised, including human minutes.", required: true },
      { key: "support_burden", question: "Expected support burden?", evidenceExpected: "Cases per customer per month and who handles them.", required: true },
      { key: "ai_cost", question: "AI inference cost per unit?", evidenceExpected: "Measured from a real run, not estimated from a price list.", required: true },
      { key: "payback", question: "Payback period?", evidenceExpected: "Months, derived from CAC and gross profit per customer.", required: true },
      { key: "churn_risk", question: "What is the churn risk?", evidenceExpected: "Why customers would leave and what retains them.", required: true },
    ],
  },
  {
    key: "operational",
    title: "Operational validation",
    description: "We can actually run it, safely, when something goes wrong.",
    requirements: [
      { key: "delivery_workflow", question: "What is the delivery workflow?", evidenceExpected: "A workflow definition in the engine, not a description.", required: true },
      { key: "quality_controls", question: "How is quality checked?", evidenceExpected: "The QC step, its criteria and who reviews failures.", required: true },
      { key: "legal_restrictions", question: "What legal restrictions apply?", evidenceExpected: "A written review naming jurisdictions and constraints.", required: true },
      { key: "data_requirements", question: "What data do we need, and may we use it?", evidenceExpected: "Sources, licences and retention decisions.", required: true },
      { key: "support_plan", question: "Who supports customers?", evidenceExpected: "Named humans, hours and escalation path.", required: true },
      { key: "failure_recovery", question: "What happens when it breaks?", evidenceExpected: "The failure modes and the recovery procedure for each.", required: true },
    ],
  },
];

export interface GateEvidence {
  /** requirement key -> evidence text/reference. Empty or whitespace = missing. */
  readonly [requirementKey: string]: string | undefined;
}

export interface GateEvaluation {
  readonly gate: GateKey;
  readonly passed: boolean;
  readonly satisfied: readonly string[];
  readonly missing: readonly string[];
  readonly notes: readonly string[];
}

function hasEvidence(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length >= 10;
}

export function evaluateGate(gate: GateKey, evidence: GateEvidence): GateEvaluation {
  const spec = LAUNCH_GATES.find((g) => g.key === gate);
  if (!spec) throw new Error(`Unknown launch gate "${gate}"`);

  const satisfied: string[] = [];
  const missing: string[] = [];
  const notes: string[] = [];

  for (const requirement of spec.requirements) {
    if (hasEvidence(evidence[requirement.key])) satisfied.push(requirement.key);
    else if (requirement.required) missing.push(requirement.key);
  }

  let passed = missing.length === 0;

  if (spec.anyOf) {
    const anySatisfied = spec.anyOf.some((key) => hasEvidence(evidence[key]));
    if (!anySatisfied) {
      passed = false;
      notes.push(`At least one of: ${spec.anyOf.join(", ")} must have evidence.`);
    }
  }

  const thin = spec.requirements
    .filter((r) => {
      const value = evidence[r.key];
      return typeof value === "string" && value.trim().length > 0 && value.trim().length < 10;
    })
    .map((r) => r.key);
  if (thin.length > 0) {
    notes.push(`Evidence too thin to count for: ${thin.join(", ")}.`);
  }

  return { gate, passed, satisfied, missing, notes };
}

export interface LaunchReadiness {
  readonly ready: boolean;
  readonly evaluations: readonly GateEvaluation[];
  readonly blockingGates: readonly GateKey[];
}

export function evaluateLaunchReadiness(
  evidenceByGate: Partial<Record<GateKey, GateEvidence>>,
): LaunchReadiness {
  const evaluations = LAUNCH_GATES.map((spec) =>
    evaluateGate(spec.key, evidenceByGate[spec.key] ?? {}),
  );
  const blockingGates = evaluations.filter((e) => !e.passed).map((e) => e.gate);
  return { ready: blockingGates.length === 0, evaluations, blockingGates };
}

export function gateEvidenceToJson(evidence: GateEvidence): JsonObject {
  return Object.fromEntries(
    Object.entries(evidence).filter(([, v]) => v !== undefined),
  ) as JsonObject;
}
