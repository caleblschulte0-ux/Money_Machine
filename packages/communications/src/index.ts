import { errors, newId, systemClock, type Clock, type JsonObject } from "@holdco/core";
import type { Communication, CommunicationChannel, Store } from "@holdco/database";
import type { FlagRegistry } from "@holdco/config";
import { AUDIT_ACTIONS, AuditLog } from "@holdco/audit";
import { ComplianceService } from "@holdco/compliance";
import { METRICS, type Logger, type MetricsRegistry } from "@holdco/observability";
import { SmtpEmailProvider } from "./smtp.ts";

/**
 * Outbound communications.
 *
 * Every send passes through `CommunicationsService`, which enforces, in order:
 * kill switch → feature flag → live-send guard → compliance check → provider.
 * A provider adapter is never called directly from a workflow or an agent.
 */
export interface SendResult {
  readonly providerMessageId: string;
  readonly acceptedAt: Date;
}

export interface EmailMessage {
  readonly to: string;
  readonly from: string;
  readonly subject: string;
  readonly body: string;
  readonly replyTo?: string;
  readonly headers?: Record<string, string>;
}

export interface SmsMessage {
  readonly to: string;
  readonly from: string;
  readonly body: string;
}

export interface EmailProvider {
  readonly name: string;
  /** True when messages actually leave the machine. */
  readonly delivers: boolean;
  send(message: EmailMessage): Promise<SendResult>;
}

export interface SmsProvider {
  readonly name: string;
  readonly delivers: boolean;
  send(message: SmsMessage): Promise<SendResult>;
}

/** Captures messages in memory. The default in every environment. */
export class MockEmailProvider implements EmailProvider {
  readonly name = "mock";
  readonly delivers = false;
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<SendResult> {
    this.sent.push(message);
    return {
      providerMessageId: `mock-email-${this.sent.length}`,
      acceptedAt: new Date(),
    };
  }

  clear(): void {
    this.sent.length = 0;
  }
}

export class MockSmsProvider implements SmsProvider {
  readonly name = "mock";
  readonly delivers = false;
  readonly sent: SmsMessage[] = [];

  async send(message: SmsMessage): Promise<SendResult> {
    this.sent.push(message);
    return { providerMessageId: `mock-sms-${this.sent.length}`, acceptedAt: new Date() };
  }

  clear(): void {
    this.sent.length = 0;
  }
}

/** Placeholder for a real vendor. Fails loudly rather than pretending. */
export class UnimplementedEmailProvider implements EmailProvider {
  readonly delivers = true;
  constructor(readonly name: string) {}
  async send(): Promise<SendResult> {
    throw errors.providerDisabled(
      `The "${this.name}" email adapter is not implemented. Implement it in ` +
        `packages/communications before switching EMAIL_PROVIDER away from mock.`,
    );
  }
}

export class UnimplementedSmsProvider implements SmsProvider {
  readonly delivers = true;
  constructor(readonly name: string) {}
  async send(): Promise<SendResult> {
    throw errors.providerDisabled(
      `The "${this.name}" SMS adapter is not implemented. Implement it in ` +
        `packages/communications before switching SMS_PROVIDER away from mock.`,
    );
  }
}

export interface CommunicationsDeps {
  store: Store;
  audit: AuditLog;
  compliance: ComplianceService;
  flags: FlagRegistry;
  logger: Logger;
  metrics: MetricsRegistry;
  email: EmailProvider;
  sms: SmsProvider;
  clock?: Clock;
  /** Mirrors ALLOW_LIVE_COMMUNICATIONS. */
  allowLiveCommunications: boolean;
}

export interface SendEmailInput {
  organizationId: string;
  ventureId: string | null;
  contactId?: string | null;
  accountId?: string | null;
  to: string;
  from: string;
  subject: string;
  body: string;
  purpose: "marketing" | "transactional";
  workflowRunId?: string | null;
  agentRunId?: string | null;
  metadata?: JsonObject;
  /** Frequency cap for this recipient across the venture. */
  frequencyCap?: number;
}

export type SendOutcome =
  | { status: "sent"; communication: Communication }
  | { status: "suppressed"; communication: Communication; reason: string }
  | { status: "blocked"; reason: string };

export class CommunicationsService {
  private readonly clock: Clock;

  constructor(private readonly deps: CommunicationsDeps) {
    this.clock = deps.clock ?? systemClock;
  }

  async sendEmail(input: SendEmailInput): Promise<SendOutcome> {
    const flagContext = {
      organizationId: input.organizationId,
      ventureId: input.ventureId ?? undefined,
    };

    if (this.deps.flags.isStopped("killswitch.outbound_communications", flagContext)) {
      return { status: "blocked", reason: "Outbound communications kill switch is engaged." };
    }
    if (this.deps.flags.automationStopped(flagContext)) {
      return { status: "blocked", reason: "Global automation kill switch is engaged." };
    }
    if (!this.deps.flags.isEnabled("feature.outbound_email", flagContext)) {
      return { status: "blocked", reason: "Outbound email is disabled by feature flag." };
    }

    // The guard that keeps a test run from emailing a real person.
    if (this.deps.email.delivers && !this.deps.allowLiveCommunications) {
      return {
        status: "blocked",
        reason:
          `Email provider "${this.deps.email.name}" delivers real mail but ` +
          `ALLOW_LIVE_COMMUNICATIONS is false. Refusing to send.`,
      };
    }

    const recentSendCount = input.frequencyCap
      ? await this.deps.store.communications.count({
          organizationId: input.organizationId,
          ventureId: input.ventureId,
          channel: "email",
          toAddress: input.to.toLowerCase(),
          status: "sent",
          sentAt: { gte: new Date(this.clock.epochMillis() - 7 * 24 * 60 * 60 * 1000) },
        } as never)
      : 0;

    const decision = await this.deps.compliance.canContact({
      organizationId: input.organizationId,
      ventureId: input.ventureId,
      identifier: input.to,
      channel: "email",
      purpose: input.purpose,
      recentSendCount,
      frequencyCap: input.frequencyCap,
    });

    if (!decision.allowed) {
      const communication = await this.record(input, "suppressed", {
        failureReason: decision.reason,
      });
      this.deps.metrics.increment(METRICS.emailsSuppressed, {
        venture: input.ventureId ?? "holdco",
        code: decision.code,
      });
      await this.deps.audit.record({
        scope: { organizationId: input.organizationId },
        ventureId: input.ventureId,
        action: AUDIT_ACTIONS.communicationSuppressed,
        entityType: "communication",
        entityId: communication.id,
        actor: { type: "system" },
        summary: `Email to ${this.mask(input.to)} suppressed: ${decision.reason}`,
      });
      return { status: "suppressed", communication, reason: decision.reason };
    }

    try {
      const result = await this.deps.email.send({
        to: input.to,
        from: input.from,
        subject: input.subject,
        body: input.body,
      });
      const communication = await this.record(input, "sent", {
        providerMessageId: result.providerMessageId,
        sentAt: result.acceptedAt,
      });
      this.deps.metrics.increment(METRICS.emailsSent, { venture: input.ventureId ?? "holdco" });
      await this.deps.audit.record({
        scope: { organizationId: input.organizationId },
        ventureId: input.ventureId,
        action: AUDIT_ACTIONS.communicationSent,
        entityType: "communication",
        entityId: communication.id,
        actor: { type: "system" },
        summary: `Email sent to ${this.mask(input.to)} via ${this.deps.email.name} — "${input.subject}"`,
        metadata: { basis: decision.basis, provider: this.deps.email.name },
      });
      return { status: "sent", communication };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await this.record(input, "failed", { failureReason: reason });
      this.deps.logger.error("email send failed", { reason, to: this.mask(input.to) });
      return { status: "blocked", reason };
    }
  }

  private mask(address: string): string {
    const [local, domain] = address.split("@");
    if (!local || !domain) return "***";
    return `${local.slice(0, 2)}***@${domain}`;
  }

  private async record(
    input: SendEmailInput,
    status: Communication["status"],
    extra: { providerMessageId?: string; sentAt?: Date; failureReason?: string } = {},
  ): Promise<Communication> {
    return this.deps.store.communications.create({
      id: newId("com", this.clock.epochMillis()),
      organizationId: input.organizationId,
      ventureId: input.ventureId,
      channel: "email" as CommunicationChannel,
      direction: "outbound",
      status,
      contactId: input.contactId ?? null,
      accountId: input.accountId ?? null,
      subject: input.subject,
      body: input.body,
      fromAddress: input.from,
      toAddress: input.to.toLowerCase(),
      providerMessageId: extra.providerMessageId ?? null,
      providerName: this.deps.email.name,
      failureReason: extra.failureReason ?? null,
      sentAt: extra.sentAt ?? null,
      durationSeconds: null,
      recordingUrl: null,
      transcript: null,
      summary: null,
      workflowRunId: input.workflowRunId ?? null,
      agentRunId: input.agentRunId ?? null,
      metadata: input.metadata ?? {},
    });
  }
}

export interface ProviderSelection {
  email: "mock" | "smtp" | "resend";
  sms: "mock" | "twilio";
  allowPaidProviders: boolean;
  smtp?: {
    host: string;
    port: number;
    user?: string;
    pass?: string;
    secure: boolean;
    rejectUnauthorized?: boolean;
  };
}

export function createEmailProvider(selection: ProviderSelection): EmailProvider {
  if (selection.email === "mock") return new MockEmailProvider();
  if (selection.email === "smtp") {
    if (!selection.smtp?.host) {
      throw errors.providerDisabled(
        "EMAIL_PROVIDER=smtp requires SMTP_HOST (and usually SMTP_USER/SMTP_PASS) to be set.",
      );
    }
    // SMTP itself is not a paid vendor, but it DELIVERS — every send still
    // passes the ALLOW_LIVE_COMMUNICATIONS gate in CommunicationsService.
    return new SmtpEmailProvider(selection.smtp);
  }
  if (!selection.allowPaidProviders) {
    throw errors.providerDisabled(
      `EMAIL_PROVIDER=${selection.email} requires ALLOW_PAID_PROVIDERS=true.`,
    );
  }
  return new UnimplementedEmailProvider(selection.email);
}

export function createSmsProvider(selection: ProviderSelection): SmsProvider {
  if (selection.sms === "mock") return new MockSmsProvider();
  if (!selection.allowPaidProviders) {
    throw errors.providerDisabled(`SMS_PROVIDER=${selection.sms} requires ALLOW_PAID_PROVIDERS=true.`);
  }
  return new UnimplementedSmsProvider(selection.sms);
}

export { SmtpEmailProvider, sendSmtp, type SmtpConfig } from "./smtp.ts";
