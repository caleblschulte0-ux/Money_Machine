import { newId, systemClock, type Clock, type JsonObject } from "@holdco/core";
import type { Store } from "@holdco/database";
import type { CrmService } from "@holdco/crm";
import type { Shot } from "./definition.ts";

/**
 * Recording what happens on a shot page.
 *
 * Signups become ordinary CRM leads, tagged `shot:<slug>`, so an idea that
 * works arrives at day one with its early interest already in the system
 * instead of stranded in a spreadsheet.
 */
export class ShotCapture {
  constructor(
    private readonly store: Store,
    private readonly crm: CrmService,
    private readonly clock: Clock = systemClock,
  ) {}

  /** A page view. `visitor` is a coarse anonymous key, never a person's identity. */
  async recordView(input: {
    organizationId: string;
    slug: string;
    visitor: string;
    referrer?: string;
  }): Promise<void> {
    await this.store.domainEvents.create({
      id: newId("evt", this.clock.epochMillis()),
      organizationId: input.organizationId,
      ventureId: null,
      type: "shot.viewed",
      payload: {
        slug: input.slug,
        visitor: input.visitor,
        referrer: input.referrer ?? null,
      } as JsonObject,
      occurredAt: this.clock.now(),
      processedAt: null,
      correlationId: input.visitor,
      source: "shot_page",
    });
  }

  /** Someone clicked through to the payment link. Stronger than a signup. */
  async recordPaymentClick(input: {
    organizationId: string;
    slug: string;
    visitor: string;
  }): Promise<void> {
    await this.store.domainEvents.create({
      id: newId("evt", this.clock.epochMillis()),
      organizationId: input.organizationId,
      ventureId: null,
      type: "shot.payment_click",
      payload: { slug: input.slug, visitor: input.visitor } as JsonObject,
      occurredAt: this.clock.now(),
      processedAt: null,
      correlationId: input.visitor,
      source: "shot_page",
    });
  }

  /**
   * Someone acted. This is the only number that matters on a shot page, and it
   * goes through the normal CRM path, so spam and duplicate handling apply
   * exactly as they do everywhere else.
   */
  async recordSignup(input: {
    organizationId: string;
    shot: Shot;
    email: string;
    name?: string;
    note?: string;
    honeypot?: string;
    submissionTimeMs?: number;
  }): Promise<{ accepted: boolean; message: string }> {
    const [firstName, ...rest] = (input.name ?? "").trim().split(/\s+/);

    const result = await this.crm.captureLead(
      {
        organizationId: input.organizationId,
        ventureId: null,
        actor: { type: "system", label: `shot:${input.shot.slug}` },
      },
      {
        channel: `shot:${input.shot.slug}`,
        source: "shot_page",
        serviceType: input.shot.slug,
        contact: {
          firstName: firstName || "Unknown",
          lastName: rest.join(" ") || "",
          email: input.email,
          source: "shot_page",
        },
        honeypot: input.honeypot ?? null,
        submissionTimeMs: input.submissionTimeMs,
        tags: [`shot:${input.shot.slug}`, `ask:${input.shot.askedFor}`],
        payload: {
          shot: input.shot.slug,
          offer: input.shot.offer,
          priceMinor: input.shot.priceMinor,
          note: input.note ?? null,
        },
      },
    );

    if (result.outcome === "spam") {
      // Say nothing useful to a bot, and nothing alarming to a human caught by
      // mistake — they can simply try again.
      return { accepted: false, message: "Something went wrong. Please try again." };
    }
    if (result.outcome === "duplicate") {
      return { accepted: true, message: "You're already on the list — no need to sign up twice." };
    }
    return {
      accepted: true,
      message:
        input.shot.askedFor === "email"
          ? "You're on the list. You'll hear from a person, not an autoresponder."
          : "Got it. Someone will be in touch shortly.",
    };
  }
}
