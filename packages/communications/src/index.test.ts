import { beforeEach, describe, expect, it } from "vitest";
import { FlagRegistry } from "@holdco/config";
import { AuditLog } from "@holdco/audit";
import { ComplianceService } from "@holdco/compliance";
import { MemorySink, MetricsRegistry, createLogger } from "@holdco/observability";
import { seedOrganization, seedVenture, testClock, testStore } from "@holdco/testing";
import type { Store } from "@holdco/database";
import type { FixedClock } from "@holdco/core";
import {
  CommunicationsService,
  MockEmailProvider,
  MockSmsProvider,
  UnimplementedEmailProvider,
  type EmailProvider,
} from "./index.ts";

const system = { type: "system" as const };

interface Harness {
  service: CommunicationsService;
  compliance: ComplianceService;
  flags: FlagRegistry;
  store: Store;
  email: EmailProvider;
  clock: FixedClock;
  organizationId: string;
  ventureId: string;
}

async function createHarness(
  options: { email?: EmailProvider; allowLive?: boolean } = {},
): Promise<Harness> {
  const clock = testClock();
  const store = testStore(clock);
  const audit = new AuditLog(store, clock);
  const compliance = new ComplianceService(store, audit, clock);
  const flags = new FlagRegistry();
  const email = options.email ?? new MockEmailProvider();
  const organization = await seedOrganization(store);
  const venture = await seedVenture(store, organization.id);

  return {
    store, compliance, flags, email, clock,
    organizationId: organization.id,
    ventureId: venture.id,
    service: new CommunicationsService({
      store, audit, compliance, flags,
      logger: createLogger({ level: "error", sink: new MemorySink() }),
      metrics: new MetricsRegistry(),
      email,
      sms: new MockSmsProvider(),
      clock,
      allowLiveCommunications: options.allowLive ?? false,
    }),
  };
}

function message(harness: Harness, overrides: Record<string, unknown> = {}) {
  return {
    organizationId: harness.organizationId,
    ventureId: harness.ventureId,
    to: "dana.whitmore@harbor-mechanical.invalid",
    from: "team@ridgeline.invalid",
    subject: "Your automation audit",
    body: "Here is the summary you asked for.",
    purpose: "transactional" as const,
    ...overrides,
  };
}

describe("CommunicationsService", () => {
  let harness: Harness;

  beforeEach(async () => {
    harness = await createHarness();
  });

  it("sends a transactional email through the mock provider", async () => {
    const outcome = await harness.service.sendEmail(message(harness));
    expect(outcome.status).toBe("sent");
    expect((harness.email as MockEmailProvider).sent).toHaveLength(1);
  });

  it("records every send as a communication row", async () => {
    await harness.service.sendEmail(message(harness));
    const communications = await harness.store.communications.all({});
    expect(communications).toHaveLength(1);
    expect(communications[0]!.status).toBe("sent");
    expect(communications[0]!.providerName).toBe("mock");
  });

  it("refuses marketing email without consent", async () => {
    const outcome = await harness.service.sendEmail(message(harness, { purpose: "marketing" }));
    expect(outcome.status).toBe("suppressed");
    if (outcome.status === "suppressed") expect(outcome.reason).toContain("No consent record");
    expect((harness.email as MockEmailProvider).sent).toHaveLength(0);
  });

  it("sends marketing email once consent is on file", async () => {
    await harness.compliance.captureConsent(
      {
        organizationId: harness.organizationId,
        ventureId: harness.ventureId,
        identifier: "dana.whitmore@harbor-mechanical.invalid",
        channel: "email",
        status: "granted",
        basis: "signed up for the newsletter on the pricing page",
        capturedVia: "web_form",
      },
      system,
    );
    const outcome = await harness.service.sendEmail(message(harness, { purpose: "marketing" }));
    expect(outcome.status).toBe("sent");
  });

  it("lets suppression beat a later consent record", async () => {
    await harness.compliance.suppress(
      {
        organizationId: harness.organizationId,
        identifier: "dana.whitmore@harbor-mechanical.invalid",
        channel: "email",
        reason: "unsubscribe",
      },
      system,
    );
    await harness.compliance.captureConsent(
      {
        organizationId: harness.organizationId,
        ventureId: harness.ventureId,
        identifier: "dana.whitmore@harbor-mechanical.invalid",
        channel: "email",
        status: "granted",
        basis: "re-subscribed via a form",
        capturedVia: "web_form",
      },
      system,
    );

    const outcome = await harness.service.sendEmail(message(harness, { purpose: "marketing" }));
    expect(outcome.status).toBe("suppressed");
    if (outcome.status === "suppressed") expect(outcome.reason).toContain("suppressed");
  });

  it("blocks all outbound mail when the communications kill switch is pulled", async () => {
    harness.flags.setOverride({
      key: "killswitch.outbound_communications",
      value: true,
      reason: "deliverability incident",
      setBy: "owner",
      setAt: harness.clock.now(),
    });
    const outcome = await harness.service.sendEmail(message(harness));
    expect(outcome.status).toBe("blocked");
    expect((harness.email as MockEmailProvider).sent).toHaveLength(0);
  });

  it("refuses a delivering provider unless live communications are enabled", async () => {
    const live = await createHarness({
      email: new UnimplementedEmailProvider("resend"),
      allowLive: false,
    });
    const outcome = await live.service.sendEmail(message(live));
    expect(outcome.status).toBe("blocked");
    if (outcome.status === "blocked") {
      expect(outcome.reason).toContain("ALLOW_LIVE_COMMUNICATIONS is false");
    }
  });

  it("enforces a frequency cap", async () => {
    await harness.compliance.captureConsent(
      {
        organizationId: harness.organizationId,
        ventureId: harness.ventureId,
        identifier: "dana.whitmore@harbor-mechanical.invalid",
        channel: "email",
        status: "granted",
        basis: "opted in",
        capturedVia: "web_form",
      },
      system,
    );

    const first = await harness.service.sendEmail(
      message(harness, { purpose: "marketing", frequencyCap: 1 }),
    );
    expect(first.status).toBe("sent");

    const second = await harness.service.sendEmail(
      message(harness, { purpose: "marketing", frequencyCap: 1 }),
    );
    expect(second.status).toBe("suppressed");
    if (second.status === "suppressed") expect(second.reason).toContain("Frequency cap");
  });

  it("masks the recipient address in the audit trail", async () => {
    await harness.service.sendEmail(message(harness));
    const events = await harness.store.auditEvents.all({ where: { action: "communication.sent" } });
    expect(events[0]!.summary).toContain("da***@harbor-mechanical.invalid");
    expect(events[0]!.summary).not.toContain("dana.whitmore@");
  });
});
