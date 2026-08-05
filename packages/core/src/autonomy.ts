import type { Money } from "./money.ts";
import { compareMoney, money } from "./money.ts";

/**
 * Autonomy levels (playbook §31). Every workflow and every agent action
 * carries one. The level is a *ceiling* granted by a human, not a claim about
 * how clever the automation is.
 */
export const AUTONOMY_LEVELS = [0, 1, 2, 3, 4, 5] as const;
export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];

export const AUTONOMY_LABELS: Record<AutonomyLevel, string> = {
  0: "Manual",
  1: "Assisted",
  2: "Human Approval",
  3: "Rules-Based Autonomous",
  4: "Exception-Based Oversight",
  5: "Fully Automated",
};

export const AUTONOMY_DESCRIPTIONS: Record<AutonomyLevel, string> = {
  0: "A human performs the work. The system only records it.",
  1: "AI drafts or recommends. A human does the work.",
  2: "AI completes the work; a human approves before it takes effect.",
  3: "AI executes inside explicit numeric limits and logs everything.",
  4: "AI executes normally and escalates exceptions to a human.",
  5: "AI completes the workflow with no routine human involvement.",
};

/**
 * Risk classes. The class of an action, combined with the autonomy level
 * granted to its workflow, decides whether an approval is required.
 */
export type RiskClass = "low" | "medium" | "high" | "prohibited";

/**
 * Highest autonomy level ever permitted for a given risk class, regardless of
 * what a venture config asks for. Level 5 is reserved for low-risk,
 * reversible work (playbook §31).
 */
export const MAX_AUTONOMY_BY_RISK: Record<RiskClass, AutonomyLevel | -1> = {
  low: 5,
  medium: 4,
  high: 2,
  prohibited: -1,
};

/**
 * Action kinds the platform knows how to classify. Anything not listed is
 * treated as `high` risk by `riskClassFor` — unknown actions do not get to be
 * cheap by default.
 */
export const ACTION_RISK: Record<string, RiskClass> = {
  // low — reversible, internal, no money and no outbound message
  "report.generate": "low",
  "record.tag": "low",
  "record.update_internal_field": "low",
  "content.reformat": "low",
  "analytics.recompute": "low",
  "backup.verify": "low",
  "task.create": "low",
  "notification.internal": "low",
  "knowledge.index": "low",

  // medium — outbound but recoverable, or spends small metered amounts
  "email.send_transactional": "medium",
  "email.send_marketing": "medium",
  "sms.send": "medium",
  "content.publish_scheduled": "medium",
  "agent.run": "medium",
  "document.generate": "medium",
  "crm.record_create": "medium",
  "call.place_outbound": "medium",

  // high — money, legal effect, or hard to reverse
  "payment.charge": "high",
  "payment.refund": "high",
  "invoice.issue": "high",
  "contract.send": "high",
  "contract.sign": "high",
  "discount.grant": "high",
  "campaign.launch": "high",
  "vendor.create": "high",
  "data.export": "high",
  "account.delete": "high",
  "pricing.change": "high",
  "deploy.production": "high",
  "venture.activate": "high",
  "capital.allocate": "high",

  // prohibited — never automated at any level in this platform
  "legal.advice": "prohibited",
  "medical.advice": "prohibited",
  "employment.terminate": "prohibited",
  "employment.hire": "prohibited",
  "regulator.communicate": "prohibited",
  "property.transact": "prohibited",
  "review.fabricate": "prohibited",
  "identity.impersonate": "prohibited",
};

export function riskClassFor(actionKind: string): RiskClass {
  return ACTION_RISK[actionKind] ?? "high";
}

export interface AutonomyDecisionInput {
  actionKind: string;
  /** Autonomy level granted to the workflow or agent performing the action. */
  grantedLevel: AutonomyLevel;
  /** Money this single action commits or moves, if any. */
  financialImpact?: Money;
  /** Threshold above which an approval is always required. */
  approvalThreshold?: Money;
  /** Set by callers that know the action cannot be undone. */
  reversible?: boolean;
}

export type AutonomyDecision =
  | { outcome: "execute"; risk: RiskClass; effectiveLevel: AutonomyLevel }
  | { outcome: "require_approval"; risk: RiskClass; reason: string }
  | { outcome: "deny"; risk: RiskClass; reason: string };

/**
 * The single place that decides "can this action run unattended?".
 *
 * Deliberately conservative: prohibited actions are denied outright, anything
 * over the approval threshold escalates, irreversible actions cap at level 2,
 * and the risk ceiling always wins over the granted level.
 */
export function decideAutonomy(input: AutonomyDecisionInput): AutonomyDecision {
  const risk = riskClassFor(input.actionKind);

  if (risk === "prohibited") {
    return {
      outcome: "deny",
      risk,
      reason: `Action "${input.actionKind}" is prohibited from automated execution by platform policy.`,
    };
  }

  const ceiling = MAX_AUTONOMY_BY_RISK[risk] as AutonomyLevel;
  const effectiveLevel = Math.min(input.grantedLevel, ceiling) as AutonomyLevel;

  const impact = input.financialImpact;
  const threshold = input.approvalThreshold ?? money(0);
  if (impact && threshold.amountMinor > 0 && compareMoney(impact, threshold) >= 0) {
    return {
      outcome: "require_approval",
      risk,
      reason: `Financial impact of this action meets or exceeds the approval threshold.`,
    };
  }

  if (input.reversible === false && effectiveLevel > 2) {
    return {
      outcome: "require_approval",
      risk,
      reason: "Action was declared irreversible; irreversible actions cap at level 2 (human approval).",
    };
  }

  if (effectiveLevel <= 2) {
    return {
      outcome: "require_approval",
      risk,
      reason: `Autonomy level ${effectiveLevel} (${AUTONOMY_LABELS[effectiveLevel]}) requires a human to approve execution.`,
    };
  }

  return { outcome: "execute", risk, effectiveLevel };
}
