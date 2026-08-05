import type { ScoringModel } from "@holdco/crm";

/**
 * Lead scoring for automation audit enquiries.
 *
 * The weights encode a specific belief: the best customer is a 20–200 person
 * company that already pays for several tools, has a named person feeling the
 * pain, and can describe the process in hours. Companies that cannot state a
 * baseline are not disqualified — they are just not ready to be quoted.
 */
export const SCORING_MODEL: ScoringModel = {
  key: "agency.audit_lead",
  ventureKey: "automation-agency",
  version: 1,
  qualifiedThreshold: 60,
  maxScore: 100,
  rules: [
    {
      key: "company_size_sweet_spot",
      field: "employeeCount",
      operator: "gte",
      value: 20,
      points: 20,
      reason: "at least 20 employees — enough process volume to be worth automating",
    },
    {
      key: "company_too_large",
      field: "employeeCount",
      operator: "gt",
      value: 500,
      points: -15,
      reason: "over 500 employees — procurement cycle likely exceeds our capacity",
    },
    {
      key: "stated_hours",
      field: "monthlyHoursOnProcess",
      operator: "gte",
      value: 20,
      points: 25,
      reason: "prospect can state 20+ hours per month on the process — a measurable baseline exists",
    },
    {
      key: "budget_signalled",
      field: "budgetRange",
      operator: "exists",
      points: 15,
      reason: "budget range supplied",
    },
    {
      key: "decision_maker",
      field: "role",
      operator: "matches",
      value: "(owner|president|ceo|coo|cfo|vp|director|controller|operations manager)",
      points: 20,
      reason: "contact has authority to buy",
    },
    {
      key: "named_systems",
      field: "systems",
      operator: "exists",
      points: 10,
      reason: "named the systems involved",
    },
    {
      key: "timeline_soon",
      field: "timeline",
      operator: "in",
      value: ["immediately", "this_quarter"],
      points: 10,
      reason: "wants to move this quarter",
    },
    {
      key: "student_or_research",
      field: "intent",
      operator: "in",
      value: ["research", "student", "competitor"],
      points: 0,
      reason: "enquiry is research rather than a buying intent",
      disqualifies: true,
    },
    {
      key: "asking_for_headcount_cuts",
      field: "goal",
      operator: "matches",
      value: "(replace (my|our) (staff|team|employees)|eliminate (jobs|positions|headcount)|fire )",
      points: 0,
      reason:
        "prospect's stated goal is eliminating staff, which is outside what this venture sells — route to a human conversation rather than automated qualification",
      disqualifies: true,
    },
  ],
};
