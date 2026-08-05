import {
  errors,
  newId,
  systemClock,
  type Clock,
  type JsonObject,
  type Page,
} from "@holdco/core";
import type {
  Account,
  Contact,
  Lead,
  LeadStatus,
  Opportunity,
  Store,
  SupportCase,
  Task,
} from "@holdco/database";
import { AUDIT_ACTIONS, AuditLog, type AuditActor } from "@holdco/audit";
import { dedupeFingerprint, findDuplicates, normalizeEmail } from "./dedupe.ts";
import { detectSpam, isSpam, scoreLead, type ScoringModel } from "./lead-scoring.ts";

/**
 * One multi-tenant CRM for every venture (playbook §6).
 *
 * Every write goes through here rather than through the store directly, so
 * provenance fields, audit entries and venture ownership cannot be forgotten.
 */
export interface CrmContext {
  organizationId: string;
  ventureId: string | null;
  actor: AuditActor;
  correlationId?: string;
}

export interface CreateContactInput {
  accountId?: string | null;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  source: string;
  dataConfidence?: number;
  consentStatus?: Contact["consentStatus"];
  tags?: string[];
  metadata?: JsonObject;
}

export interface CaptureLeadInput {
  contact?: CreateContactInput;
  contactId?: string;
  accountId?: string | null;
  campaignId?: string | null;
  channel: string;
  source: string;
  intent?: string | null;
  serviceType?: string | null;
  postalCode?: string | null;
  companyName?: string | null;
  estimatedValueMinor?: number | null;
  payload?: JsonObject;
  /** Anti-spam inputs from the form. */
  honeypot?: string | null;
  submissionTimeMs?: number;
  scoringModel?: ScoringModel;
  tags?: string[];
}

export interface CaptureLeadResult {
  lead: Lead;
  outcome: "captured" | "duplicate" | "spam";
  duplicateOfId?: string;
  reasons: readonly string[];
}

export class CrmService {
  constructor(
    private readonly store: Store,
    private readonly audit: AuditLog,
    private readonly clock: Clock = systemClock,
  ) {}

  // --- Accounts ----------------------------------------------------------

  async createAccount(
    ctx: CrmContext,
    input: Omit<Account, keyof import("@holdco/database").VentureOwned | keyof import("@holdco/database").RecordProvenance> &
      Partial<Pick<Account, "source" | "dataConfidence" | "consentStatus" | "tags" | "metadata" | "assignedUserId" | "assignedAgentId" | "retentionPolicy">>,
  ): Promise<Account> {
    const account = await this.store.accounts.create({
      id: newId("cus", this.clock.epochMillis()),
      organizationId: ctx.organizationId,
      ventureId: ctx.ventureId,
      source: input.source ?? "manual",
      dataConfidence: input.dataConfidence ?? 0.8,
      consentStatus: input.consentStatus ?? "unknown",
      retentionPolicy: input.retentionPolicy ?? null,
      tags: input.tags ?? [],
      metadata: input.metadata ?? {},
      assignedUserId: input.assignedUserId ?? null,
      assignedAgentId: input.assignedAgentId ?? null,
      ...input,
    } as never);

    await this.auditCreate(ctx, "account", account.id, `Created account "${account.name}"`);
    return account;
  }

  async findAccount(organizationId: string, id: string): Promise<Account | null> {
    return this.store.accounts.get(id).then((a) => (a?.organizationId === organizationId ? a : null));
  }

  // --- Contacts ----------------------------------------------------------

  async createContact(ctx: CrmContext, input: CreateContactInput): Promise<Contact> {
    const email = input.email ? normalizeEmail(input.email) : null;
    const contact = await this.store.contacts.create({
      id: newId("cnt", this.clock.epochMillis()),
      organizationId: ctx.organizationId,
      ventureId: ctx.ventureId,
      accountId: input.accountId ?? null,
      firstName: input.firstName,
      lastName: input.lastName,
      email,
      emailBlindIndex: null,
      phone: input.phone ?? null,
      title: input.title ?? null,
      timezone: null,
      status: "active",
      source: input.source,
      dataConfidence: input.dataConfidence ?? 0.6,
      consentStatus: input.consentStatus ?? "unknown",
      retentionPolicy: null,
      tags: input.tags ?? [],
      metadata: input.metadata ?? {},
      assignedUserId: null,
      assignedAgentId: null,
    });

    await this.auditCreate(ctx, "contact", contact.id, `Created contact ${contact.firstName} ${contact.lastName}`);
    return contact;
  }

  async findContactByEmail(organizationId: string, email: string): Promise<Contact | null> {
    return this.store.contacts.findFirst({
      where: { organizationId, email: normalizeEmail(email) },
    });
  }

  // --- Leads -------------------------------------------------------------

  /**
   * The single entry point for inbound leads. Runs spam detection, then
   * duplicate detection, then scoring — in that order, because a spam
   * submission should never consume a scoring model or reach a buyer.
   */
  async captureLead(ctx: CrmContext, input: CaptureLeadInput): Promise<CaptureLeadResult> {
    const now = this.clock.now();
    const contactInput = input.contact;

    const spamSignals = detectSpam({
      email: contactInput?.email ?? null,
      phone: contactInput?.phone ?? null,
      message: typeof input.payload?.["message"] === "string" ? (input.payload["message"] as string) : null,
      name: contactInput ? `${contactInput.firstName} ${contactInput.lastName}` : null,
      honeypot: input.honeypot ?? null,
      submissionTimeMs: input.submissionTimeMs,
    });

    const fingerprint = dedupeFingerprint({
      ventureId: ctx.ventureId,
      email: contactInput?.email ?? null,
      phone: contactInput?.phone ?? null,
      companyName: input.companyName ?? null,
      postalCode: input.postalCode ?? null,
      serviceType: input.serviceType ?? null,
    });

    if (isSpam(spamSignals)) {
      const lead = await this.insertLead(ctx, input, {
        status: "spam",
        score: 0,
        scoreReasons: spamSignals.map((s) => `${s.key}: ${s.detail}`),
        dedupeKey: fingerprint,
        contactId: null,
        now,
      });
      await this.auditCreate(ctx, "lead", lead.id, "Rejected inbound submission as spam");
      return { lead, outcome: "spam", reasons: spamSignals.map((s) => s.detail) };
    }

    // Duplicate detection against recent leads in the same venture.
    const recent = await this.store.leads.all({
      where: {
        organizationId: ctx.organizationId,
        ventureId: ctx.ventureId,
        status: { notIn: ["spam", "duplicate"] },
      },
      orderBy: { field: "createdAt", direction: "desc" },
    });
    // Fuzzy matching is scoped to the same service type. The same person asking
    // for a roof quote and a plumbing quote is two legitimate leads, and
    // rejecting the second one costs a real sale.
    const sameService = input.serviceType
      ? recent.filter((lead) => lead.payload["serviceType"] === input.serviceType)
      : recent;

    const recentWithContacts = await Promise.all(
      sameService.slice(0, 500).map(async (lead) => {
        const contact = lead.contactId ? await this.store.contacts.get(lead.contactId) : null;
        return {
          id: lead.id,
          email: contact?.email ?? null,
          phone: contact?.phone ?? null,
          companyName: (lead.payload["companyName"] as string | undefined) ?? null,
          createdAt: lead.createdAt,
        };
      }),
    );

    const exactFingerprint = recent.find((l) => l.dedupeKey === fingerprint);
    const fuzzy = findDuplicates(
      {
        email: contactInput?.email ?? null,
        phone: contactInput?.phone ?? null,
        companyName: input.companyName ?? null,
      },
      recentWithContacts,
      { now },
    );
    const duplicateOf = exactFingerprint?.id ?? fuzzy[0]?.candidateId;

    if (duplicateOf) {
      const reasons = exactFingerprint
        ? ["identical lead fingerprint within the dedupe window"]
        : (fuzzy[0]?.reasons ?? []);
      const lead = await this.insertLead(ctx, input, {
        status: "duplicate",
        score: 0,
        scoreReasons: [...reasons],
        dedupeKey: fingerprint,
        contactId: null,
        duplicateOfId: duplicateOf,
        now,
      });
      await this.auditCreate(ctx, "lead", lead.id, `Marked lead as duplicate of ${duplicateOf}`);
      return { lead, outcome: "duplicate", duplicateOfId: duplicateOf, reasons };
    }

    const contact =
      input.contactId
        ? await this.store.contacts.require(input.contactId)
        : contactInput
          ? await this.createContact(ctx, contactInput)
          : null;

    const scored = input.scoringModel
      ? scoreLead(input.scoringModel, {
          ...(input.payload ?? {}),
          channel: input.channel,
          source: input.source,
          serviceType: input.serviceType ?? null,
          postalCode: input.postalCode ?? null,
          estimatedValueMinor: input.estimatedValueMinor ?? null,
          email: contact?.email ?? null,
          phone: contact?.phone ?? null,
        } as JsonObject)
      : null;

    const status: LeadStatus = scored
      ? scored.disqualified
        ? "disqualified"
        : scored.qualified
          ? "qualified"
          : "qualifying"
      : "new";

    const lead = await this.insertLead(ctx, input, {
      status,
      score: scored?.score ?? 0,
      scoreReasons: scored ? [...scored.reasons] : ["No scoring model configured for this venture."],
      dedupeKey: fingerprint,
      contactId: contact?.id ?? null,
      now,
    });

    await this.audit.record({
      scope: { organizationId: ctx.organizationId, correlationId: ctx.correlationId },
      ventureId: ctx.ventureId,
      action: AUDIT_ACTIONS.leadScored,
      entityType: "lead",
      entityId: lead.id,
      actor: ctx.actor,
      summary: `Captured lead via ${input.channel} — status ${status}, score ${lead.score}`,
      after: { status, score: lead.score, reasons: lead.scoreReasons },
    });

    return { lead, outcome: "captured", reasons: lead.scoreReasons };
  }

  private async insertLead(
    ctx: CrmContext,
    input: CaptureLeadInput,
    fields: {
      status: LeadStatus;
      score: number;
      scoreReasons: string[];
      dedupeKey: string;
      contactId: string | null;
      duplicateOfId?: string;
      now: Date;
    },
  ): Promise<Lead> {
    return this.store.leads.create({
      id: newId("led", fields.now.getTime()),
      organizationId: ctx.organizationId,
      ventureId: ctx.ventureId,
      contactId: fields.contactId,
      accountId: input.accountId ?? null,
      campaignId: input.campaignId ?? null,
      status: fields.status,
      score: fields.score,
      scoreReasons: fields.scoreReasons,
      intent: input.intent ?? null,
      channel: input.channel,
      dedupeKey: fields.dedupeKey,
      duplicateOfId: fields.duplicateOfId ?? null,
      estimatedValueMinor: input.estimatedValueMinor ?? null,
      disqualifyReason: null,
      routedToAccountId: null,
      routedAt: null,
      acceptedAt: null,
      rejectedReason: null,
      payload: {
        ...(input.payload ?? {}),
        ...(input.companyName ? { companyName: input.companyName } : {}),
        ...(input.serviceType ? { serviceType: input.serviceType } : {}),
        ...(input.postalCode ? { postalCode: input.postalCode } : {}),
      },
      source: input.source,
      dataConfidence: 0.6,
      consentStatus: "unknown",
      retentionPolicy: null,
      tags: input.tags ?? [],
      metadata: {},
      assignedUserId: null,
      assignedAgentId: null,
    });
  }

  /**
   * Route a qualified lead to a buyer. Refuses to route anything that is not
   * qualified, and refuses to route the same lead twice — both are how a
   * lead-gen business loses buyer trust.
   */
  async routeLead(
    ctx: CrmContext,
    leadId: string,
    buyerAccountId: string,
  ): Promise<Lead> {
    const lead = await this.store.leads.require(leadId);
    if (lead.organizationId !== ctx.organizationId) {
      throw errors.forbidden("Lead belongs to another organization");
    }
    if (lead.status !== "qualified") {
      throw errors.conflict(`Only qualified leads may be routed; this lead is "${lead.status}"`, {
        leadId, status: lead.status,
      });
    }
    if (lead.routedToAccountId) {
      throw errors.conflict("Lead has already been routed", {
        leadId, routedTo: lead.routedToAccountId,
      });
    }

    const updated = await this.store.leads.update(leadId, {
      routedToAccountId: buyerAccountId,
      routedAt: this.clock.now(),
    });

    await this.audit.record({
      scope: { organizationId: ctx.organizationId, correlationId: ctx.correlationId },
      ventureId: ctx.ventureId,
      action: AUDIT_ACTIONS.leadRouted,
      entityType: "lead",
      entityId: leadId,
      actor: ctx.actor,
      summary: `Routed lead to buyer ${buyerAccountId}`,
      after: { routedToAccountId: buyerAccountId },
    });

    return updated;
  }

  async listLeads(
    organizationId: string,
    filter: { ventureId?: string | null; status?: LeadStatus; limit?: number } = {},
  ): Promise<Page<Lead>> {
    const where: Record<string, unknown> = { organizationId };
    if (filter.ventureId !== undefined) where["ventureId"] = filter.ventureId;
    if (filter.status) where["status"] = filter.status;
    return this.store.leads.list({
      where: where as never,
      orderBy: { field: "createdAt", direction: "desc" },
      page: { limit: filter.limit ?? 25 },
    });
  }

  // --- Opportunities, tasks, cases ---------------------------------------

  async createOpportunity(
    ctx: CrmContext,
    input: {
      accountId: string;
      contactId?: string | null;
      name: string;
      amountMinor: number;
      offerKey?: string | null;
      expectedCloseDate?: Date | null;
      source: string;
    },
  ): Promise<Opportunity> {
    const opportunity = await this.store.opportunities.create({
      id: newId("opp", this.clock.epochMillis()),
      organizationId: ctx.organizationId,
      ventureId: ctx.ventureId,
      accountId: input.accountId,
      contactId: input.contactId ?? null,
      name: input.name,
      stage: "discovery",
      amountMinor: input.amountMinor,
      probability: 0.1,
      expectedCloseDate: input.expectedCloseDate ?? null,
      closedAt: null,
      lostReason: null,
      offerKey: input.offerKey ?? null,
      source: input.source,
      dataConfidence: 0.8,
      consentStatus: "not_required",
      retentionPolicy: null,
      tags: [],
      metadata: {},
      assignedUserId: null,
      assignedAgentId: null,
    });
    await this.auditCreate(ctx, "opportunity", opportunity.id, `Created opportunity "${input.name}"`);
    return opportunity;
  }

  async createTask(
    ctx: CrmContext,
    input: {
      title: string;
      description?: string | null;
      dueAt?: Date | null;
      priority?: Task["priority"];
      assignedUserId?: string | null;
      assignedAgentId?: string | null;
      relatedType?: string | null;
      relatedId?: string | null;
    },
  ): Promise<Task> {
    return this.store.tasks.create({
      id: newId("tsk", this.clock.epochMillis()),
      organizationId: ctx.organizationId,
      ventureId: ctx.ventureId,
      title: input.title,
      description: input.description ?? null,
      status: "open",
      priority: input.priority ?? "normal",
      dueAt: input.dueAt ?? null,
      completedAt: null,
      assignedUserId: input.assignedUserId ?? null,
      assignedAgentId: input.assignedAgentId ?? null,
      relatedType: input.relatedType ?? null,
      relatedId: input.relatedId ?? null,
      createdBy: ctx.actor.id ?? ctx.actor.type,
      metadata: {},
    });
  }

  async openSupportCase(
    ctx: CrmContext,
    input: {
      accountId?: string | null;
      contactId?: string | null;
      subject: string;
      description: string;
      priority?: SupportCase["priority"];
      category?: string | null;
    },
  ): Promise<SupportCase> {
    const supportCase = await this.store.supportCases.create({
      id: newId("sup", this.clock.epochMillis()),
      organizationId: ctx.organizationId,
      ventureId: ctx.ventureId,
      accountId: input.accountId ?? null,
      contactId: input.contactId ?? null,
      subject: input.subject,
      description: input.description,
      status: "new",
      priority: input.priority ?? "normal",
      category: input.category ?? null,
      assignedUserId: null,
      assignedAgentId: null,
      firstResponseAt: null,
      resolvedAt: null,
      escalatedReason: null,
      satisfactionScore: null,
      metadata: {},
    });
    await this.auditCreate(ctx, "support_case", supportCase.id, `Opened support case "${input.subject}"`);
    return supportCase;
  }

  private async auditCreate(
    ctx: CrmContext,
    entityType: string,
    entityId: string,
    summary: string,
  ): Promise<void> {
    await this.audit.record({
      scope: { organizationId: ctx.organizationId, correlationId: ctx.correlationId },
      ventureId: ctx.ventureId,
      action: AUDIT_ACTIONS.recordCreated,
      entityType,
      entityId,
      actor: ctx.actor,
      summary,
    });
  }
}
