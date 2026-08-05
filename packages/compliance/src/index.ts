import { addDays, errors, newId, systemClock, type Clock, type JsonObject } from "@holdco/core";
import type {
  CommunicationChannel,
  ConsentRecord,
  ConsentStatus,
  DataSubjectRequestRecord,
  Store,
  SuppressionRecord,
} from "@holdco/database";
import { AUDIT_ACTIONS, AuditLog, type AuditActor } from "@holdco/audit";

/**
 * Compliance controls (playbook §33).
 *
 * The design rule throughout: **suppression beats consent, and consent beats
 * convenience.** A check returns a decision plus the reason, so a blocked send
 * can be explained to a customer or a regulator without reconstructing state.
 *
 * Nothing here is legal advice, and no file in `legal/` may be described as
 * attorney-approved without a real documented review.
 */
export type ContactDecision =
  | { allowed: true; basis: string }
  | { allowed: false; reason: string; code: "suppressed" | "no_consent" | "consent_withdrawn" | "consent_expired" | "frequency_cap" };

export interface CaptureConsentInput {
  organizationId: string;
  ventureId: string | null;
  contactId?: string | null;
  identifier: string;
  channel: CommunicationChannel | "all";
  status: ConsentStatus;
  /** The lawful basis or the mechanism by which consent was given. */
  basis: string;
  capturedVia: string;
  evidence?: JsonObject;
  expiresAt?: Date | null;
}

export interface SuppressInput {
  organizationId: string;
  ventureId?: string | null;
  identifier: string;
  channel: CommunicationChannel | "all";
  reason: SuppressionRecord["reason"];
  scope?: SuppressionRecord["scope"];
  notes?: string;
}

/** Channels where we require affirmative consent before any outreach. */
const CONSENT_REQUIRED_CHANNELS: readonly (CommunicationChannel | "all")[] = ["sms", "call"];

export class ComplianceService {
  constructor(
    private readonly store: Store,
    private readonly audit: AuditLog,
    private readonly clock: Clock = systemClock,
  ) {}

  private normalize(identifier: string): string {
    return identifier.trim().toLowerCase();
  }

  async captureConsent(input: CaptureConsentInput, actor: AuditActor): Promise<ConsentRecord> {
    if (!input.basis.trim()) {
      throw errors.validation("Consent must record the basis on which it was obtained");
    }
    const now = this.clock.now();
    const record = await this.store.consents.create({
      id: newId("csn", now.getTime()),
      organizationId: input.organizationId,
      ventureId: input.ventureId,
      contactId: input.contactId ?? null,
      identifier: this.normalize(input.identifier),
      channel: input.channel,
      status: input.status,
      basis: input.basis,
      capturedAt: now,
      capturedVia: input.capturedVia,
      evidence: input.evidence ?? {},
      expiresAt: input.expiresAt ?? null,
      withdrawnAt: input.status === "withdrawn" ? now : null,
    });

    await this.audit.record({
      scope: { organizationId: input.organizationId },
      ventureId: input.ventureId,
      action: AUDIT_ACTIONS.consentCaptured,
      entityType: "consent",
      entityId: record.id,
      actor,
      summary: `Consent ${input.status} for ${input.channel} via ${input.capturedVia}`,
      after: { status: input.status, channel: input.channel, basis: input.basis },
    });

    // Withdrawal immediately creates a suppression — the two must never drift.
    if (input.status === "withdrawn" || input.status === "denied") {
      await this.suppress(
        {
          organizationId: input.organizationId,
          ventureId: input.ventureId,
          identifier: input.identifier,
          channel: input.channel,
          reason: "unsubscribe",
          scope: "organization",
          notes: `Consent ${input.status} via ${input.capturedVia}`,
        },
        actor,
      );
    }

    return record;
  }

  async currentConsent(
    organizationId: string,
    identifier: string,
    channel: CommunicationChannel,
  ): Promise<ConsentRecord | null> {
    const records = await this.store.consents.all({
      where: {
        organizationId,
        identifier: this.normalize(identifier),
        channel: { in: [channel, "all"] },
      } as never,
      orderBy: { field: "capturedAt", direction: "desc" },
    });
    return records[0] ?? null;
  }

  async suppress(input: SuppressInput, actor: AuditActor): Promise<SuppressionRecord> {
    const identifier = this.normalize(input.identifier);
    const existing = await this.store.suppressions.findFirst({
      where: { organizationId: input.organizationId, identifier, channel: input.channel },
    });
    if (existing) return existing;

    const record = await this.store.suppressions.create({
      id: newId("sup", this.clock.epochMillis()),
      organizationId: input.organizationId,
      ventureId: input.ventureId ?? null,
      identifier,
      channel: input.channel,
      reason: input.reason,
      scope: input.scope ?? "organization",
      notes: input.notes ?? null,
      expiresAt: null,
    });

    await this.audit.record({
      scope: { organizationId: input.organizationId },
      ventureId: input.ventureId ?? null,
      action: AUDIT_ACTIONS.suppressionAdded,
      entityType: "suppression",
      entityId: record.id,
      actor,
      summary: `Suppressed ${input.channel} contact (${input.reason})`,
      after: { channel: input.channel, reason: input.reason, scope: record.scope },
    });

    return record;
  }

  async isSuppressed(
    organizationId: string,
    identifier: string,
    channel: CommunicationChannel,
    ventureId?: string | null,
  ): Promise<SuppressionRecord | null> {
    const matches = await this.store.suppressions.all({
      where: {
        organizationId,
        identifier: this.normalize(identifier),
        channel: { in: [channel, "all"] },
      } as never,
    });
    const now = this.clock.epochMillis();
    return (
      matches.find((s) => {
        if (s.expiresAt && s.expiresAt.getTime() <= now) return false;
        if (s.scope === "venture") return s.ventureId === ventureId;
        return true; // organization and global scopes apply everywhere
      }) ?? null
    );
  }

  /**
   * The single check every outbound message must pass.
   *
   * Order is deliberate: suppression first (an unsubscribe outranks any later
   * consent record), then consent, then frequency capping.
   */
  async canContact(input: {
    organizationId: string;
    ventureId: string | null;
    identifier: string;
    channel: CommunicationChannel;
    /** Marketing requires consent; transactional replies to a live thread do not. */
    purpose: "marketing" | "transactional";
    /** Messages already sent on this channel in the cap window. */
    recentSendCount?: number;
    frequencyCap?: number;
  }): Promise<ContactDecision> {
    const suppression = await this.isSuppressed(
      input.organizationId,
      input.identifier,
      input.channel,
      input.ventureId,
    );
    if (suppression) {
      return {
        allowed: false,
        code: "suppressed",
        reason: `Recipient is suppressed for ${input.channel} (${suppression.reason}, scope ${suppression.scope}).`,
      };
    }

    const consent = await this.currentConsent(input.organizationId, input.identifier, input.channel);

    if (input.purpose === "marketing" || CONSENT_REQUIRED_CHANNELS.includes(input.channel)) {
      if (!consent || consent.status === "unknown") {
        return {
          allowed: false,
          code: "no_consent",
          reason: `No consent record for ${input.channel}; ${input.purpose} contact requires one.`,
        };
      }
      if (consent.status === "withdrawn") {
        return { allowed: false, code: "consent_withdrawn", reason: "Consent was withdrawn." };
      }
      if (consent.status === "denied") {
        return { allowed: false, code: "no_consent", reason: "Consent was denied." };
      }
      if (consent.expiresAt && consent.expiresAt.getTime() <= this.clock.epochMillis()) {
        return { allowed: false, code: "consent_expired", reason: "Consent has expired." };
      }
    }

    if (
      input.frequencyCap !== undefined &&
      (input.recentSendCount ?? 0) >= input.frequencyCap
    ) {
      return {
        allowed: false,
        code: "frequency_cap",
        reason: `Frequency cap of ${input.frequencyCap} messages reached for this recipient.`,
      };
    }

    return {
      allowed: true,
      basis: consent?.basis ?? (input.purpose === "transactional" ? "transactional relationship" : "consent on file"),
    };
  }

  // --- Data subject requests --------------------------------------------

  async openDataSubjectRequest(input: {
    organizationId: string;
    ventureId: string | null;
    identifier: string;
    kind: DataSubjectRequestRecord["kind"];
    /** Statutory response window in days. */
    dueInDays?: number;
    notes?: string;
  }, actor: AuditActor): Promise<DataSubjectRequestRecord> {
    const now = this.clock.now();
    const record = await this.store.dataSubjectRequests.create({
      id: newId("evt", now.getTime()),
      organizationId: input.organizationId,
      ventureId: input.ventureId,
      identifier: this.normalize(input.identifier),
      kind: input.kind,
      status: "received",
      receivedAt: now,
      dueAt: addDays(now, input.dueInDays ?? 30),
      completedAt: null,
      handledByUserId: null,
      notes: input.notes ?? null,
    });

    // An opt-out request suppresses immediately; the paperwork follows.
    if (input.kind === "opt_out") {
      await this.suppress(
        {
          organizationId: input.organizationId,
          ventureId: input.ventureId,
          identifier: input.identifier,
          channel: "all",
          reason: "do_not_contact",
          scope: "global",
          notes: "Opt-out request received",
        },
        actor,
      );
    }

    await this.audit.record({
      scope: { organizationId: input.organizationId },
      ventureId: input.ventureId,
      action: "privacy.request_received",
      entityType: "data_subject_request",
      entityId: record.id,
      actor,
      summary: `${input.kind} request received; due ${record.dueAt.toISOString().slice(0, 10)}`,
    });

    return record;
  }

  /** Requests approaching or past their statutory deadline. */
  async overdueRequests(organizationId: string): Promise<readonly DataSubjectRequestRecord[]> {
    return this.store.dataSubjectRequests.all({
      where: {
        organizationId,
        status: { notIn: ["completed", "rejected"] },
        dueAt: { lt: this.clock.now() },
      } as never,
    });
  }

  // --- Retention ---------------------------------------------------------

  /**
   * Named retention policies. Deleting data is irreversible, so this module
   * only *reports* what is due — actual deletion runs through the approval
   * queue as an `account.delete` action.
   */
  async retentionCandidates(
    organizationId: string,
    policy: { entity: "leads" | "communications"; retainDays: number },
  ): Promise<readonly { id: string; createdAt: Date }[]> {
    const cutoff = new Date(this.clock.epochMillis() - policy.retainDays * 24 * 60 * 60 * 1000);
    if (policy.entity === "leads") {
      return this.store.leads.all({
        where: { organizationId, createdAt: { lt: cutoff } } as never,
      });
    }
    return this.store.communications.all({
      where: { organizationId, createdAt: { lt: cutoff } } as never,
    });
  }
}

/**
 * Disclosures required on outbound content. Kept as data so the content
 * pipeline and the QC agent check against the same list.
 */
export const REQUIRED_DISCLOSURES = {
  affiliate:
    "This page contains affiliate links. We may earn a commission if you buy through them, at no extra cost to you.",
  aiGenerated: "Portions of this content were produced with AI assistance and reviewed by a human before publication.",
  sponsored: "This is sponsored content. The sponsor paid for placement and reviewed it before publication.",
  callRecording:
    "This call may be recorded for quality and training purposes. Recording is subject to applicable law in your jurisdiction.",
  reviewRequest:
    "We ask every customer for a review regardless of their experience. We do not offer incentives for positive reviews.",
} as const;
