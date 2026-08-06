import { beforeEach, describe, expect, it } from "vitest";
import { AuditLog } from "@holdco/audit";
import { CrmService } from "@holdco/crm";
import { seedOrganization, testClock, testStore } from "@holdco/testing";
import type { Store } from "@holdco/database";
import type { FixedClock } from "@holdco/core";
import { ShotCapture } from "./capture.ts";
import { ShotScoreboard, MIN_VISITORS_FOR_A_VERDICT } from "./scoreboard.ts";
import type { Shot } from "./definition.ts";

const shot: Shot = {
  slug: "quote-chaser",
  name: "Quote Chaser",
  forWhom: "Contractors who send quotes and lose track of them",
  problem: "You send a quote and hear nothing back, then forget to follow up.",
  offer: "We follow up on every quote you send until they answer yes or no.",
  priceMinor: 29_900,
  points: ["Chased three times", "One list each Monday"],
  notPromised: ["We do not promise more closed jobs."],
  askedFor: "email",
  cta: "Join the list",
  successLooksLike: "25 signups in 21 days",
  killAfterDays: 14,
  status: "live",
};

describe("ShotScoreboard", () => {
  let store: Store;
  let capture: ShotCapture;
  let scoreboard: ShotScoreboard;
  let clock: FixedClock;
  let org: string;

  beforeEach(async () => {
    clock = testClock();
    store = testStore(clock);
    const crm = new CrmService(store, new AuditLog(store, clock), clock);
    capture = new ShotCapture(store, crm, clock);
    scoreboard = new ShotScoreboard(store, clock);
    org = (await seedOrganization(store)).id;
  });

  const view = (n: number, slug = shot.slug) =>
    Promise.all(
      Array.from({ length: n }, (_, i) =>
        capture.recordView({ organizationId: org, slug, visitor: `v${i}` }),
      ),
    );

  const signup = (email: string) =>
    capture.recordSignup({ organizationId: org, shot, email, name: "Test Person" });

  it("says a draft with no traffic is simply not launched", async () => {
    const result = await scoreboard.score(org, { ...shot, status: "draft" });
    expect(result.verdict).toBe("not_launched");
  });

  it("lets real traffic override a stale draft status", async () => {
    await view(MIN_VISITORS_FOR_A_VERDICT + 5);
    const result = await scoreboard.score(org, { ...shot, status: "draft" });
    expect(result.verdict).not.toBe("not_launched");
    expect(result.whatToDo).toContain("still marked draft");
  });

  it("refuses to call it a failure before enough people have seen it", async () => {
    await view(5);
    const result = await scoreboard.score(org, shot);
    expect(result.verdict).toBe("no_audience_yet");
    expect(result.whatToDo).toContain("tells you nothing yet");
  });

  it("calls it a real answer once enough people saw it and nobody acted", async () => {
    await view(MIN_VISITORS_FOR_A_VERDICT);
    const result = await scoreboard.score(org, shot);
    expect(result.verdict).toBe("no_signal");
    expect(result.whatToDo).toContain("real answer");
  });

  it("counts a signup and computes the conversion rate", async () => {
    await view(40);
    await signup("dana@harbor-mechanical.invalid");
    const result = await scoreboard.score(org, shot);
    expect(result.signups).toBe(1);
    expect(result.conversionRate).toBeCloseTo(1 / 40);
    expect(result.verdict).toBe("early_signal");
  });

  it("weights a booked call above a bare email", async () => {
    await view(40);
    await signup("dana@harbor-mechanical.invalid");
    const emailResult = await scoreboard.score(org, shot);

    const callShot: Shot = { ...shot, slug: "call-shot", askedFor: "booked_call" };
    await view(40, callShot.slug);
    await capture.recordSignup({
      organizationId: org, shot: callShot, email: "ruben@castellanos-roofing.invalid",
    });
    const callResult = await scoreboard.score(org, callShot);

    expect(callResult.weightedSignal).toBeGreaterThan(emailResult.weightedSignal);
  });

  it("does not count a bot submission as a signup", async () => {
    await view(40);
    await capture.recordSignup({
      organizationId: org, shot,
      email: "bot@mailinator.com",
      honeypot: "http://spam.invalid",
      submissionTimeMs: 200,
    });
    const result = await scoreboard.score(org, shot);
    expect(result.signups).toBe(0);
    expect(result.verdict).toBe("no_signal");
  });

  it("does not count the same person twice", async () => {
    await view(40);
    await signup("dana@harbor-mechanical.invalid");
    const second = await signup("Dana+quote@Harbor-Mechanical.invalid");
    expect(second.message).toContain("already on the list");

    const result = await scoreboard.score(org, shot);
    expect(result.signups).toBe(1);
  });

  it("flags a shot past its kill date", async () => {
    await view(40);
    clock.advance((shot.killAfterDays + 1) * 86_400_000);
    const result = await scoreboard.score(org, shot);
    expect(result.verdict).toBe("past_kill_date");
    expect(result.whatToDo).toContain("close it");
  });

  it("ranks the shot with a response above the ones without", async () => {
    const dead: Shot = { ...shot, slug: "dead-idea" };
    await view(40);
    await signup("dana@harbor-mechanical.invalid");
    await view(40, dead.slug);

    const results = await scoreboard.scoreAll(org, [dead, shot]);
    expect(results[0]!.shot.slug).toBe(shot.slug);
  });

  it("distinguishes 'nobody wanted it' from 'nobody saw it' in the summary", async () => {
    await view(3);
    const unseen = await scoreboard.scoreAll(org, [shot]);
    expect(scoreboard.summarize(unseen)).toContain("only published");

    await view(40, "other");
    const tested = await scoreboard.scoreAll(org, [shot, { ...shot, slug: "other" }]);
    expect(scoreboard.summarize(tested)).toContain("got a real test");
  });
});
