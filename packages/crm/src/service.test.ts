import { beforeEach, describe, expect, it } from "vitest";
import { AuditLog } from "@holdco/audit";
import { seedOrganization, seedVenture, testClock, testStore } from "@holdco/testing";
import type { Store } from "@holdco/database";
import type { FixedClock } from "@holdco/core";
import { CrmService, type CrmContext } from "./service.ts";
import type { ScoringModel } from "./lead-scoring.ts";

const scoringModel: ScoringModel = {
  key: "test.model",
  ventureKey: "test-venture",
  version: 1,
  qualifiedThreshold: 50,
  maxScore: 100,
  rules: [
    { key: "has_phone", field: "phone", operator: "exists", points: 30, reason: "phone supplied" },
    { key: "urgent", field: "timeline", operator: "equals", value: "emergency", points: 40, reason: "emergency timeline" },
    { key: "owner", field: "role", operator: "equals", value: "owner", points: 30, reason: "decision maker" },
    { key: "competitor", field: "intent", operator: "equals", value: "competitor", points: 0, reason: "competitor research", disqualifies: true },
  ],
};

describe("CrmService.captureLead", () => {
  let store: Store;
  let crm: CrmService;
  let ctx: CrmContext;
  let clock: FixedClock;

  beforeEach(async () => {
    clock = testClock();
    store = testStore(clock);
    crm = new CrmService(store, new AuditLog(store, clock), clock);
    const organization = await seedOrganization(store);
    const venture = await seedVenture(store, organization.id);
    ctx = {
      organizationId: organization.id,
      ventureId: venture.id,
      actor: { type: "system" },
    };
  });

  const baseLead = {
    channel: "web_form",
    source: "landing_page",
    contact: {
      firstName: "Dana",
      lastName: "Whitmore",
      email: "dana.whitmore@harbor-mechanical.invalid",
      phone: "555-0142",
      source: "landing_page",
    },
    companyName: "Harbor Mechanical",
    postalCode: "57104",
    serviceType: "hvac",
  };

  it("captures a qualified lead with its scoring reasons", async () => {
    const result = await crm.captureLead(ctx, {
      ...baseLead,
      scoringModel,
      payload: { timeline: "emergency", role: "owner", phone: "555-0142" },
    });
    expect(result.outcome).toBe("captured");
    expect(result.lead.status).toBe("qualified");
    expect(result.lead.score).toBe(100);
    expect(result.lead.scoreReasons.length).toBeGreaterThan(0);
  });

  it("disqualifies competitor research", async () => {
    const result = await crm.captureLead(ctx, {
      ...baseLead,
      scoringModel,
      payload: { intent: "competitor" },
    });
    expect(result.lead.status).toBe("disqualified");
    expect(result.lead.scoreReasons.join(" ")).toContain("DISQUALIFIED");
  });

  it("explains a zero score rather than leaving it bare", async () => {
    const result = await crm.captureLead(ctx, {
      ...baseLead,
      contact: { ...baseLead.contact, phone: null },
      scoringModel,
      payload: {},
    });
    expect(result.lead.score).toBe(0);
    expect(result.lead.scoreReasons[0]).toContain("No scoring rules matched");
  });

  it("says plainly when no scoring model is configured", async () => {
    const result = await crm.captureLead(ctx, baseLead);
    expect(result.lead.status).toBe("new");
    expect(result.lead.scoreReasons[0]).toContain("No scoring model configured");
  });

  it("marks a repeat submission as a duplicate and does not create a second contact", async () => {
    await crm.captureLead(ctx, { ...baseLead, scoringModel, payload: { role: "owner" } });
    const second = await crm.captureLead(ctx, { ...baseLead, scoringModel, payload: { role: "owner" } });

    expect(second.outcome).toBe("duplicate");
    expect(second.lead.duplicateOfId).toBeTruthy();
    expect(await store.contacts.count({})).toBe(1);
  });

  it("treats gmail dot and plus variants as the same person", async () => {
    const first = { ...baseLead, contact: { ...baseLead.contact, email: "dana.whitmore@gmail.com" } };
    const second = { ...baseLead, contact: { ...baseLead.contact, email: "danawhitmore+quote@gmail.com" } };
    await crm.captureLead(ctx, first);
    const result = await crm.captureLead(ctx, second);
    expect(result.outcome).toBe("duplicate");
  });

  it("does not treat a different service type as a duplicate", async () => {
    await crm.captureLead(ctx, { ...baseLead, serviceType: "hvac" });
    const other = await crm.captureLead(ctx, { ...baseLead, serviceType: "plumbing" });
    expect(other.outcome).toBe("captured");
  });

  it("rejects a honeypot submission as spam without creating a contact", async () => {
    const result = await crm.captureLead(ctx, { ...baseLead, honeypot: "http://spam.invalid" });
    expect(result.outcome).toBe("spam");
    expect(result.lead.status).toBe("spam");
    expect(await store.contacts.count({})).toBe(0);
  });

  it("rejects a submission with several independent spam signals", async () => {
    const result = await crm.captureLead(ctx, {
      ...baseLead,
      contact: { ...baseLead.contact, email: "x@mailinator.com" },
      submissionTimeMs: 200,
    });
    expect(result.outcome).toBe("spam");
  });
});

describe("CrmService.routeLead", () => {
  let store: Store;
  let crm: CrmService;
  let ctx: CrmContext;

  beforeEach(async () => {
    const clock = testClock();
    store = testStore(clock);
    crm = new CrmService(store, new AuditLog(store, clock), clock);
    const organization = await seedOrganization(store);
    const venture = await seedVenture(store, organization.id);
    ctx = { organizationId: organization.id, ventureId: venture.id, actor: { type: "system" } };
  });

  async function qualifiedLead() {
    const result = await crm.captureLead(ctx, {
      channel: "web_form",
      source: "landing_page",
      companyName: "Castellanos Roofing",
      contact: { firstName: "Ruben", lastName: "Castellanos", email: "ruben@castellanos-roofing.invalid", source: "web" },
      scoringModel,
      payload: { role: "owner", phone: "555-0187", timeline: "emergency" },
    });
    return result.lead;
  }

  it("routes a qualified lead once", async () => {
    const lead = await qualifiedLead();
    const routed = await crm.routeLead(ctx, lead.id, "cus_buyer_1");
    expect(routed.routedToAccountId).toBe("cus_buyer_1");
    expect(routed.routedAt).not.toBeNull();
  });

  it("refuses to route the same lead twice", async () => {
    const lead = await qualifiedLead();
    await crm.routeLead(ctx, lead.id, "cus_buyer_1");
    await expect(crm.routeLead(ctx, lead.id, "cus_buyer_2")).rejects.toThrow(/already been routed/);
  });

  it("refuses to route a lead that is not qualified", async () => {
    const result = await crm.captureLead(ctx, {
      channel: "web_form",
      source: "landing_page",
      contact: { firstName: "Tom", lastName: "Aldergate", email: "t@aldergate-excavating.invalid", source: "web" },
      scoringModel,
      payload: {},
    });
    await expect(crm.routeLead(ctx, result.lead.id, "cus_buyer_1")).rejects.toThrow(/Only qualified/);
  });
});

describe("detectSpam name heuristic", () => {
  it("does not flag a real two-word name of 16+ letters", async () => {
    const clock = testClock();
    const store = testStore(clock);
    const crm = new CrmService(store, new AuditLog(store, clock), clock);
    const organization = await seedOrganization(store);
    const venture = await seedVenture(store, organization.id);

    // "Priya Raghunathan" is 16 letters — previously stripped of its space and
    // flagged as machine-generated, which combined with a fast submission to
    // reject a real person. Regression test for that exact case.
    const result = await crm.captureLead(
      { organizationId: organization.id, ventureId: venture.id, actor: { type: "system" } },
      {
        channel: "web_form",
        source: "shot_page",
        contact: {
          firstName: "Priya",
          lastName: "Raghunathan",
          email: "priya.r@meridian-doors.invalid",
          source: "web",
        },
        submissionTimeMs: 900,
      },
    );
    expect(result.outcome).not.toBe("spam");
  });

  it("still flags a single unbroken 16+ letter token plus another signal", async () => {
    const clock = testClock();
    const store = testStore(clock);
    const crm = new CrmService(store, new AuditLog(store, clock), clock);
    const organization = await seedOrganization(store);
    const venture = await seedVenture(store, organization.id);

    const result = await crm.captureLead(
      { organizationId: organization.id, ventureId: venture.id, actor: { type: "system" } },
      {
        channel: "web_form",
        source: "shot_page",
        contact: {
          firstName: "xkqzvbnmtrwplsdh",
          lastName: "",
          email: "x@mailinator.com",
          source: "web",
        },
      },
    );
    expect(result.outcome).toBe("spam");
  });
});
