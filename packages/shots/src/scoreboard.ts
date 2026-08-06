import { systemClock, type Clock } from "@holdco/core";
import type { Store } from "@holdco/database";
import { signalWeight, type Shot } from "./definition.ts";

/**
 * The scoreboard: which shots got a response, and which are just noise.
 *
 * The distinction that makes or breaks a scattergun strategy:
 *
 *   no signups + no visitors  =  you learned NOTHING. Not a failed idea, an
 *                                unsent one. Killing it is a mistake.
 *   no signups + real traffic =  you learned something real. Kill it.
 *
 * Most people conflate those two and conclude "none of my ideas worked", when
 * the truth is they never showed most of them to anybody.
 */
export interface ShotResult {
  readonly shot: Shot;
  readonly views: number;
  readonly uniqueVisitors: number;
  readonly signups: number;
  /** Signups weighted by what was actually asked for. */
  readonly weightedSignal: number;
  readonly conversionRate: number | null;
  readonly daysLive: number | null;
  readonly verdict:
    | "not_launched"
    | "no_audience_yet"
    | "no_signal"
    | "early_signal"
    | "stuck"
    | "past_kill_date";
  readonly whatToDo: string;
}

/** Below this, a "nobody wanted it" conclusion is not supported by the data. */
export const MIN_VISITORS_FOR_A_VERDICT = 30;

export class ShotScoreboard {
  constructor(
    private readonly store: Store,
    private readonly clock: Clock = systemClock,
  ) {}

  async score(organizationId: string, shot: Shot): Promise<ShotResult> {
    // Views are recorded as domain events; signups land in the CRM as leads
    // tagged with the shot slug, so a shot that graduates keeps its history.
    const viewEvents = await this.store.domainEvents.all({
      where: { organizationId, type: "shot.viewed" } as never,
    });
    const views = viewEvents.filter((e) => e.payload["slug"] === shot.slug);
    const uniqueVisitors = new Set(views.map((v) => String(v.payload["visitor"] ?? v.id))).size;

    const leads = await this.store.leads.all({
      where: { organizationId, channel: `shot:${shot.slug}` } as never,
    });
    const signups = leads.filter((l) => l.status !== "spam" && l.status !== "duplicate").length;

    const launchedAt = views.length
      ? views.reduce((earliest, v) => (v.occurredAt < earliest ? v.occurredAt : earliest), views[0]!.occurredAt)
      : null;
    const daysLive = launchedAt
      ? Math.floor((this.clock.epochMillis() - launchedAt.getTime()) / 86_400_000)
      : null;

    const conversionRate = uniqueVisitors > 0 ? signups / uniqueVisitors : null;
    const weightedSignal = signups * signalWeight(shot);

    let verdict: ShotResult["verdict"];
    let whatToDo: string;

    // Status only decides the verdict when there is no data. If people are
    // already landing on a page still marked draft, the traffic is the truth
    // and the status is just stale.
    const draftNote = shot.status === "draft" ? " (still marked draft — set status to \"live\")" : "";

    if (shot.status === "draft" && views.length === 0) {
      verdict = "not_launched";
      whatToDo = "Not live yet. Set status to \"live\" and send it some traffic.";
    } else if (uniqueVisitors < MIN_VISITORS_FOR_A_VERDICT) {
      verdict = "no_audience_yet";
      whatToDo =
        `Only ${uniqueVisitors} visitor(s). This tells you nothing yet — you have not shown it ` +
        `to enough people to judge it. Get it in front of ${MIN_VISITORS_FOR_A_VERDICT}+ before deciding.` + draftNote;
    } else if (signups === 0) {
      verdict = daysLive !== null && daysLive >= shot.killAfterDays ? "past_kill_date" : "no_signal";
      whatToDo =
        `${uniqueVisitors} people saw it and nobody acted. That is a real answer. ` +
        (verdict === "past_kill_date" ? "Past its kill date — close it." : "Change the offer or close it.") + draftNote;
    } else if (weightedSignal >= 10) {
      verdict = "stuck";
      whatToDo =
        `${signups} signup(s) at ${(conversionRate! * 100).toFixed(1)}%. This one is worth real work — ` +
        `talk to every person who signed up before building anything.` + draftNote;
    } else {
      verdict = "early_signal";
      whatToDo =
        `${signups} signup(s). Promising but thin. Keep it running and get more traffic before committing.` + draftNote;
    }

    return {
      shot, views: views.length, uniqueVisitors, signups,
      weightedSignal, conversionRate, daysLive, verdict, whatToDo,
    };
  }

  async scoreAll(organizationId: string, shots: readonly Shot[]): Promise<readonly ShotResult[]> {
    const results = await Promise.all(shots.map((shot) => this.score(organizationId, shot)));
    // Strongest evidence first; unlaunched last.
    const order: Record<ShotResult["verdict"], number> = {
      stuck: 0, early_signal: 1, no_signal: 2, past_kill_date: 3,
      no_audience_yet: 4, not_launched: 5,
    };
    return [...results].sort(
      (a, b) => order[a.verdict] - order[b.verdict] || b.weightedSignal - a.weightedSignal,
    );
  }

  /** One honest sentence about the whole portfolio of attempts. */
  summarize(results: readonly ShotResult[]): string {
    const launched = results.filter((r) => r.verdict !== "not_launched");
    const unseen = results.filter((r) => r.verdict === "no_audience_yet");
    const stuck = results.filter((r) => r.verdict === "stuck" || r.verdict === "early_signal");
    const answered = launched.length - unseen.length;

    if (launched.length === 0) return "Nothing is live yet.";
    if (answered === 0) {
      return (
        `${launched.length} shot(s) live, but none has been seen by enough people to judge. ` +
        `You have not tested anything yet — you have only published.`
      );
    }
    return (
      `${answered} of ${launched.length} shot(s) got a real test. ` +
      `${stuck.length} got a response. ${unseen.length} still need traffic before they mean anything.`
    );
  }
}
