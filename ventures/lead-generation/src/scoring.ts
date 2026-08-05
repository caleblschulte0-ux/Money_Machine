import type { ScoringModel } from "@holdco/crm";

/**
 * Lead scoring for the first vertical: residential and light-commercial
 * roofing in one metro.
 *
 * The rules reflect what a roofing contractor will actually pay for: a
 * property owner, with a real address in the service area, with damage or a
 * project already in mind, reachable by phone.
 */
export const ROOFING_SCORING_MODEL: ScoringModel = {
  key: "leadgen.roofing",
  ventureKey: "lead-generation",
  version: 1,
  qualifiedThreshold: 55,
  maxScore: 100,
  rules: [
    {
      key: "is_owner",
      field: "propertyOwnership",
      operator: "equals",
      value: "owner",
      points: 25,
      reason: "caller owns the property and can authorise work",
    },
    {
      key: "is_renter",
      field: "propertyOwnership",
      operator: "equals",
      value: "renter",
      points: 0,
      reason: "renter cannot authorise roofing work",
      disqualifies: true,
    },
    {
      key: "phone_present",
      field: "phone",
      operator: "exists",
      points: 20,
      reason: "phone number supplied — contractors close by phone",
    },
    {
      key: "in_service_area",
      field: "postalCode",
      operator: "exists",
      points: 10,
      reason: "postal code supplied",
    },
    {
      key: "damage_described",
      field: "projectDescription",
      operator: "matches",
      value: "(leak|storm|hail|missing shingle|damage|replace|new roof)",
      points: 25,
      reason: "describes a concrete roofing need",
    },
    {
      key: "insurance_claim",
      field: "insuranceClaim",
      operator: "equals",
      value: true,
      points: 15,
      reason: "insurance claim in progress — higher job value and funding is identified",
    },
    {
      key: "timeline_soon",
      field: "timeline",
      operator: "in",
      value: ["emergency", "within_30_days"],
      points: 15,
      reason: "wants work within 30 days",
    },
    {
      key: "just_pricing",
      field: "intent",
      operator: "equals",
      value: "price_research_only",
      points: -20,
      reason: "explicitly price-shopping with no timeline",
    },
    {
      key: "vendor_solicitation",
      field: "intent",
      operator: "in",
      value: ["selling", "recruiting", "partnership"],
      points: 0,
      reason: "submission is a solicitation, not a customer enquiry",
      disqualifies: true,
    },
  ],
};

export const SCORING_MODELS = [ROOFING_SCORING_MODEL] as const;
