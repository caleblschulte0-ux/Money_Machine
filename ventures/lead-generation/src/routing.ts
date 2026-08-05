/**
 * Buyer routing.
 *
 * The rules that keep a lead-gen business alive: never exceed a buyer's daily
 * capacity, never route outside their service area, honour exclusivity, and
 * rotate fairly so one buyer does not absorb every good lead while others
 * churn. Each rejection reason is returned so a buyer asking "why did I not
 * get that one?" gets a real answer.
 */
export interface Buyer {
  readonly accountId: string;
  readonly name: string;
  readonly serviceTypes: readonly string[];
  readonly postalCodes: readonly string[];
  /** Maximum leads this buyer accepts per day. */
  readonly dailyCapacity: number;
  /** Leads already delivered to this buyer today. */
  readonly deliveredToday: number;
  /** Exclusive territory holders bypass rotation within their postal codes. */
  readonly exclusiveTerritory: boolean;
  readonly active: boolean;
  /** Rolling acceptance rate, used to break ties. */
  readonly acceptanceRate: number;
  /** Epoch millis of the last lead routed to this buyer. */
  readonly lastRoutedAt: number | null;
  /** Buyer is paused pending a billing or quality issue. */
  readonly pausedReason: string | null;
}

export interface RoutableLead {
  readonly leadId: string;
  readonly serviceType: string;
  readonly postalCode: string;
  readonly score: number;
}

export interface RoutingDecision {
  readonly leadId: string;
  readonly buyerAccountId: string | null;
  readonly reason: string;
  readonly rejected: readonly { buyerAccountId: string; reason: string }[];
}

export function routeLead(lead: RoutableLead, buyers: readonly Buyer[]): RoutingDecision {
  const rejected: { buyerAccountId: string; reason: string }[] = [];
  const eligible: Buyer[] = [];

  for (const buyer of buyers) {
    if (!buyer.active) {
      rejected.push({ buyerAccountId: buyer.accountId, reason: "buyer is inactive" });
      continue;
    }
    if (buyer.pausedReason) {
      rejected.push({ buyerAccountId: buyer.accountId, reason: `paused: ${buyer.pausedReason}` });
      continue;
    }
    if (!buyer.serviceTypes.includes(lead.serviceType)) {
      rejected.push({ buyerAccountId: buyer.accountId, reason: "does not buy this service type" });
      continue;
    }
    if (!buyer.postalCodes.includes(lead.postalCode)) {
      rejected.push({ buyerAccountId: buyer.accountId, reason: "outside service area" });
      continue;
    }
    if (buyer.deliveredToday >= buyer.dailyCapacity) {
      rejected.push({
        buyerAccountId: buyer.accountId,
        reason: `daily capacity reached (${buyer.deliveredToday}/${buyer.dailyCapacity})`,
      });
      continue;
    }
    eligible.push(buyer);
  }

  if (eligible.length === 0) {
    return {
      leadId: lead.leadId,
      buyerAccountId: null,
      reason: "No eligible buyer. The lead stays unrouted rather than going to a buyer who cannot serve it.",
      rejected,
    };
  }

  // Exclusive territory holders win outright — that is what they paid for.
  const exclusive = eligible.filter((b) => b.exclusiveTerritory);
  if (exclusive.length > 0) {
    const winner = exclusive.sort((a, b) => a.accountId.localeCompare(b.accountId))[0]!;
    for (const buyer of eligible) {
      if (buyer.accountId !== winner.accountId) {
        rejected.push({
          buyerAccountId: buyer.accountId,
          reason: "another buyer holds exclusive territory here",
        });
      }
    }
    return {
      leadId: lead.leadId,
      buyerAccountId: winner.accountId,
      reason: `exclusive territory holder for ${lead.postalCode}`,
      rejected,
    };
  }

  // Otherwise rotate: longest-waiting first, acceptance rate breaks ties.
  const sorted = [...eligible].sort((a, b) => {
    const aWaited = a.lastRoutedAt ?? 0;
    const bWaited = b.lastRoutedAt ?? 0;
    if (aWaited !== bWaited) return aWaited - bWaited;
    if (a.acceptanceRate !== b.acceptanceRate) return b.acceptanceRate - a.acceptanceRate;
    return a.accountId.localeCompare(b.accountId);
  });

  const winner = sorted[0]!;
  for (const buyer of sorted.slice(1)) {
    rejected.push({ buyerAccountId: buyer.accountId, reason: "rotation: another buyer waited longer" });
  }

  return {
    leadId: lead.leadId,
    buyerAccountId: winner.accountId,
    reason:
      winner.lastRoutedAt === null
        ? "rotation: buyer has not received a lead yet"
        : "rotation: longest time since last lead",
    rejected,
  };
}

/**
 * Dispute handling. A dispute is either accepted (buyer is credited) or
 * declined with a reason; there is no silent third option, because unanswered
 * disputes are what lose buyers.
 */
export type DisputeReason =
  | "duplicate"
  | "wrong_service"
  | "outside_area"
  | "invalid_contact"
  | "not_interested_at_submission"
  | "spam";

export interface DisputeDecision {
  readonly accepted: boolean;
  readonly creditIssued: boolean;
  readonly reason: string;
  readonly requiresHumanReview: boolean;
}

/**
 * Objective reasons are auto-credited because they are verifiable from our own
 * records. Subjective ones go to a human — automatically refusing a buyer's
 * judgement call is how a lead business acquires a reputation.
 */
const AUTO_CREDIT: readonly DisputeReason[] = [
  "duplicate", "wrong_service", "outside_area", "invalid_contact", "spam",
];

export function assessDispute(input: {
  reason: DisputeReason;
  hoursSinceDelivery: number;
  disputeWindowHours?: number;
  /** Buyer's dispute rate over the trailing period. */
  buyerDisputeRate: number;
}): DisputeDecision {
  const window = input.disputeWindowHours ?? 24;

  if (input.hoursSinceDelivery > window) {
    return {
      accepted: false,
      creditIssued: false,
      reason: `Dispute raised ${input.hoursSinceDelivery.toFixed(0)}h after delivery, outside the ${window}h window.`,
      requiresHumanReview: false,
    };
  }

  // A buyer disputing most of their leads is a relationship problem, not a
  // credit decision — send it to a human either way.
  if (input.buyerDisputeRate > 0.4) {
    return {
      accepted: false,
      creditIssued: false,
      reason: `Buyer's dispute rate is ${(input.buyerDisputeRate * 100).toFixed(0)}%. Needs a conversation, not another credit.`,
      requiresHumanReview: true,
    };
  }

  if (AUTO_CREDIT.includes(input.reason)) {
    return {
      accepted: true,
      creditIssued: true,
      reason: `"${input.reason}" is verifiable from our own records; credit issued automatically.`,
      requiresHumanReview: false,
    };
  }

  return {
    accepted: false,
    creditIssued: false,
    reason: `"${input.reason}" is a judgement call and goes to a human reviewer.`,
    requiresHumanReview: true,
  };
}
