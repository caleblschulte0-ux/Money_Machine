/**
 * Fictional demo data (playbook rule 6).
 *
 * Every company, person, email and phone number here is invented. Domains use
 * `.invalid`, which the DNS standard reserves and guarantees will never
 * resolve, and phone numbers use the 555 range. Nothing here corresponds to a
 * real business or person.
 *
 * Shared by `pnpm seed` and by the Command Center when it runs on the
 * in-memory store, so the dashboard and the CLI show the same world.
 */
import { monthKey, usd, type JsonObject } from "@holdco/core";
import { installVentureModule, type Platform } from "@holdco/platform";
import { LAUNCH_GATES } from "@holdco/ventures";
import { MODULE as AGENCY, SCORING_MODEL } from "@venture/automation-agency";
import { MODULE as VISIBILITY } from "@venture/ai-visibility";
import { MODULE as LEADGEN } from "@venture/lead-generation";

const OWNER_ACTOR = { type: "human" as const, id: "usr_owner", label: "Owner" };

export interface SeedResult {
  organizationId: string;
  ownerUserId: string;
  ventureIds: Record<string, string>;
  periodKey: string;
}

export async function seedDemoData(platform: Platform): Promise<SeedResult> {
  const period = monthKey(platform.clock.now());
  installVentureModule(platform, AGENCY);
  installVentureModule(platform, VISIBILITY);
  installVentureModule(platform, LEADGEN);

  // --- Holding company and people ----------------------------------------
  const { organization, owner } = await platform.auth.registerOrganization({
    name: "Northbridge Holdings",
    slug: "northbridge",
    kind: "holding",
    ownerEmail: "owner@northbridge.invalid",
    ownerName: "Sam Okonkwo",
    ownerPassword: "seed-only-password-change-me",
  });
  const organizationId = organization.id;

  await platform.auth.createUser({
    organizationId,
    email: "ops@northbridge.invalid",
    name: "Iris Calloway",
    password: "seed-only-password-change-me",
    role: "operator",
  });

  // --- Ventures -----------------------------------------------------------
  const agency = await platform.ventures.create(
    {
      organizationId,
      key: AGENCY.manifest.key,
      name: AGENCY.manifest.name,
      brandName: AGENCY.manifest.brandName,
      thesis: AGENCY.manifest.thesis,
      ownerUserId: owner.id,
      domains: ["ridgeline-ops.invalid"],
      maxAutonomyLevel: 3,
      monthlyBudgetMinor: usd(1500).amountMinor,
      stopLossMinor: usd(15000).amountMinor,
    },
    OWNER_ACTOR,
  );

  const visibility = await platform.ventures.create(
    {
      organizationId,
      key: VISIBILITY.manifest.key,
      name: VISIBILITY.manifest.name,
      brandName: VISIBILITY.manifest.brandName,
      thesis: VISIBILITY.manifest.thesis,
      ownerUserId: owner.id,
      domains: ["answerline.invalid"],
      maxAutonomyLevel: 2,
      monthlyBudgetMinor: usd(400).amountMinor,
      stopLossMinor: usd(6000).amountMinor,
    },
    OWNER_ACTOR,
  );

  const leadgen = await platform.ventures.create(
    {
      organizationId,
      key: LEADGEN.manifest.key,
      name: LEADGEN.manifest.name,
      brandName: LEADGEN.manifest.brandName,
      thesis: LEADGEN.manifest.thesis,
      ownerUserId: owner.id,
      domains: ["traderouteleads.invalid"],
      maxAutonomyLevel: 3,
      monthlyBudgetMinor: usd(0).amountMinor,
      stopLossMinor: usd(5000).amountMinor,
    },
    OWNER_ACTOR,
  );

  // The agency has cleared its gates and is operating; the others have not.
  await platform.ventures.transition(
    { organizationId, ventureId: agency.id, to: "validation", reason: "Beginning customer discovery." },
    OWNER_ACTOR,
  );
  for (const gate of LAUNCH_GATES) {
    await platform.ventures.recordGate(
      {
        organizationId,
        ventureId: agency.id,
        gate: gate.key,
        evidence: Object.fromEntries(
          gate.requirements.map((r) => [
            r.key,
            `[SEED DATA] Fictional evidence recorded for "${r.key}" during discovery in February 2026.`,
          ]),
        ),
        reviewedByUserId: owner.id,
      },
      OWNER_ACTOR,
    );
  }
  await platform.ventures.transition(
    { organizationId, ventureId: agency.id, to: "build", reason: "All five launch gates passed." },
    OWNER_ACTOR,
  );
  await platform.ventures.transition(
    { organizationId, ventureId: agency.id, to: "launched", reason: "First paid audit delivered." },
    OWNER_ACTOR,
  );

  await platform.ventures.transition(
    { organizationId, ventureId: visibility.id, to: "validation", reason: "Testing whether monitoring is a product." },
    OWNER_ACTOR,
  );

  // --- Budgets ------------------------------------------------------------
  for (const [ventureId, limit] of [
    [agency.id, usd(300)],
    [visibility.id, usd(100)],
    [leadgen.id, usd(50)],
    [null, usd(200)],
  ] as const) {
    await platform.costs.setBudget({
      organizationId,
      ventureId,
      category: "ai_inference",
      periodKey: period,
      limit,
      enforcement: "hard",
      setByUserId: owner.id,
      notes: "Seeded budget.",
    });
  }

  // --- Plans --------------------------------------------------------------
  for (const offer of AGENCY.manifest.offers) {
    await platform.billing.createPlan({
      organizationId,
      ventureId: agency.id,
      key: `agency.${offer.key}`,
      name: offer.name,
      description: offer.deliverable,
      billingInterval: offer.billingInterval,
      priceMinor: offer.priceMinor,
      setupFeeMinor: offer.setupFeeMinor ?? 0,
      includedUnits: 0,
      overageUnitPriceMinor: 0,
      unitName: null,
      status: "active",
    });
  }

  // --- Customers, leads and work -----------------------------------------
  const crmCtx = {
    organizationId,
    ventureId: agency.id,
    actor: { type: "human" as const, id: owner.id },
  };

  const harbor = await platform.crm.createAccount(crmCtx, {
    name: "Harbor Mechanical Services",
    type: "customer",
    domain: "harbor-mechanical.invalid",
    industry: "HVAC",
    employeeCount: 64,
    city: "Sioux Falls",
    state: "SD",
    country: "US",
    status: "active",
    ownerUserId: owner.id,
    source: "referral",
  } as never);

  await platform.billing.subscribe({
    organizationId,
    ventureId: agency.id,
    accountId: harbor.id,
    planKey: "agency.department",
  });

  const leads: Array<{
    companyName: string;
    contact: Parameters<typeof platform.crm.createContact>[1];
    payload: JsonObject;
  }> = [
    {
      companyName: "Castellanos Roofing",
      contact: { firstName: "Ruben", lastName: "Castellanos", email: "ruben@castellanos-roofing.invalid", phone: "555-0187", title: "Owner", source: "web_form" },
      payload: { employeeCount: 22, monthlyHoursOnProcess: 35, role: "Owner", systems: "Excel, Gmail", timeline: "this_quarter", budgetRange: "5k-10k" },
    },
    {
      companyName: "Meridian Commercial Doors",
      contact: { firstName: "Priya", lastName: "Raghunathan", email: "priya.r@meridian-doors.invalid", phone: "555-0163", title: "Controller", source: "web_form" },
      payload: { employeeCount: 41, monthlyHoursOnProcess: 60, role: "Controller", systems: "Sage, Outlook, paper schedules", timeline: "immediately", budgetRange: "10k-25k" },
    },
    {
      companyName: "Aldergate Excavating",
      contact: { firstName: "Tom", lastName: "Aldergate", email: "t.aldergate@aldergate-excavating.invalid", phone: "555-0119", title: "President", source: "referral" },
      payload: { employeeCount: 18, role: "President", timeline: "next_year" },
    },
  ];

  for (const lead of leads) {
    const captured = await platform.crm.captureLead(crmCtx, {
      channel: "web_form",
      source: "pricing_page",
      companyName: lead.companyName,
      serviceType: "operations_audit",
      contact: lead.contact,
      scoringModel: SCORING_MODEL,
      payload: lead.payload,
    });

    // Run the venture's intake workflow exactly as production would.
    await platform.engine.run(platform.workflows.get("agency.lead_intake"), {
      type: "lead.created",
      organizationId,
      ventureId: agency.id,
      payload: {
        ventureKey: "automation-agency",
        leadId: captured.lead.id,
        companyName: lead.companyName,
        channel: "web_form",
        score: captured.lead.score,
      },
    });
  }

  // --- Recorded costs -----------------------------------------------------
  await platform.costs.record({
    organizationId, ventureId: agency.id, category: "software",
    amount: usd(89), description: "[SEED] CRM and scheduling tools", vendorName: "Fictional Vendor Co",
  });
  await platform.costs.record({
    organizationId, ventureId: agency.id, category: "contractor",
    amount: usd(1200), description: "[SEED] Implementation contractor, 15 hours",
    customerAccountId: harbor.id,
  });
  await platform.costs.record({
    organizationId, ventureId: null, category: "hosting",
    amount: usd(45), description: "[SEED] Shared platform hosting",
  });

  // --- Metric snapshots ---------------------------------------------------
  const previousPeriod = "2026-02";
  await platform.ventures.recordSnapshot({
    organizationId, ventureId: agency.id, periodKey: previousPeriod,
    revenueMinor: usd(4200).amountMinor, cogsMinor: usd(900).amountMinor,
    marketingSpendMinor: usd(300).amountMinor, contractorSpendMinor: usd(800).amountMinor,
    aiSpendMinor: usd(65).amountMinor, otherSpendMinor: usd(120).amountMinor,
    customerCount: 3, activeSubscriptions: 2, newCustomers: 2, churnedCustomers: 0,
    refundsMinor: 0, receivablesMinor: usd(2500).amountMinor, supportCases: 4,
    humanHours: 62, automatedActions: 340, manualActions: 210,
  });
  await platform.ventures.recordSnapshot({
    organizationId, ventureId: agency.id, periodKey: period,
    revenueMinor: usd(7400).amountMinor, cogsMinor: usd(1100).amountMinor,
    marketingSpendMinor: usd(450).amountMinor, contractorSpendMinor: usd(1200).amountMinor,
    aiSpendMinor: usd(90).amountMinor, otherSpendMinor: usd(140).amountMinor,
    customerCount: 5, activeSubscriptions: 3, newCustomers: 2, churnedCustomers: 0,
    refundsMinor: 0, receivablesMinor: usd(3800).amountMinor, supportCases: 5,
    humanHours: 48, automatedActions: 690, manualActions: 180,
  });

  // --- Knowledge ----------------------------------------------------------
  const policy = await platform.knowledge.create({
    organizationId,
    ventureId: agency.id,
    key: "agency.claims_policy",
    title: "What we may and may not claim in agency proposals",
    body: [
      "We quantify savings only from baseline figures the client supplied in writing.",
      "We never state or imply that any employee, role or position can be eliminated.",
      "We describe outcomes as hours reduced, errors reduced and response time improved.",
      "Any claim about a client's results requires their written approval before publication.",
    ].join("\n"),
    kind: "policy",
    ownerUserId: owner.id,
  });
  await platform.knowledge.approve(policy.id, owner.id);

  // --- An experiment with a real end date and loss cap --------------------
  await platform.experiments.create(
    {
      organizationId,
      ventureId: visibility.id,
      key: "visibility.paid-audit-presale",
      hypothesis:
        "At least 5 of 60 contacted local firms will pre-pay $1,500 for a one-time AI visibility audit.",
      customerDescription: "Marketing leads at 20-200 person regional service firms.",
      problem: "They do not know how AI assistants describe them to buyers.",
      proposedSolution: "A one-time audit across an agreed set of buying questions.",
      acquisitionChannel: "Direct outbound email to a hand-built list.",
      offer: "One-Time AI Visibility Audit",
      price: usd(1500),
      budget: usd(400),
      maxLoss: usd(600),
      startsAt: new Date("2026-03-01T00:00:00Z"),
      endsAt: new Date("2026-04-15T00:00:00Z"),
      successMetric: "Pre-paid audits",
      successThreshold: "5 or more",
      failureMetric: "Pre-paid audits",
      failureThreshold: "fewer than 2",
      ownerUserId: owner.id,
    },
    OWNER_ACTOR,
  );

  // --- An approval waiting for the owner ----------------------------------
  await platform.approvals.request(
    {
      organizationId,
      ventureId: agency.id,
      actionKind: "campaign.launch",
      title: "Launch the March outbound campaign",
      summary: "Send 400 first-touch emails to HVAC and roofing operations managers over two weeks.",
      reason: "Campaign launches are high risk and always require a human decision.",
      evidence: {
        listSize: 400,
        consentBasis: "Business contacts sourced from public directories; every message carries an opt-out.",
        estimatedCostMinor: usd(120).amountMinor,
      },
      financialImpact: usd(120),
      requestedBy: "operator",
      requestedByType: "human",
      deadlineAt: new Date("2026-03-20T00:00:00Z"),
      payload: { campaignKey: "march-outbound", listSize: 400 },
    },
    OWNER_ACTOR,
  );

  return {
    organizationId,
    ownerUserId: owner.id,
    ventureIds: {
      "automation-agency": agency.id,
      "ai-visibility": visibility.id,
      "lead-generation": leadgen.id,
    },
    periodKey: period,
  };
}
