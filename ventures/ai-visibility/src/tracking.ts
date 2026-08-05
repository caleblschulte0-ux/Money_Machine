import type { JsonObject } from "@holdco/core";

/**
 * The data model for answer-engine observations.
 *
 * An *observation* is a record of what one engine said about one question on
 * one date. It is evidence, not a metric. Metrics are derived from
 * observations by the functions below so that every number in a client report
 * can be traced back to the rows that produced it.
 *
 * Nothing here queries an external engine. Collection is gated behind
 * `feature.ai_visibility_live_probing`, which stays off until each provider's
 * terms have been reviewed.
 */
export interface TrackedQuestion {
  readonly id: string;
  readonly accountId: string;
  readonly question: string;
  /** The buying stage this question represents. */
  readonly intent: "awareness" | "comparison" | "purchase" | "support";
  readonly priority: number;
}

export interface AnswerObservation {
  readonly id: string;
  readonly questionId: string;
  readonly engine: string;
  readonly observedAt: Date;
  /** Whether the client's brand appeared in the answer. */
  readonly brandAppeared: boolean;
  /** How the brand was positioned, when it appeared. */
  readonly brandSentiment: "positive" | "neutral" | "negative" | "not_mentioned";
  readonly competitorsNamed: readonly string[];
  readonly sourcesCited: readonly string[];
  /** Statements about the brand that the client says are wrong. */
  readonly inaccuracies: readonly string[];
  /** Raw answer text, retained as the evidence behind the row. */
  readonly answerExcerpt: string;
  readonly collectionMethod: "manual" | "licensed_api" | "not_collected";
}

export interface VisibilitySummary {
  readonly accountId: string;
  readonly periodKey: string;
  readonly observationCount: number;
  readonly questionsTracked: number;
  /** Share of observations where the brand appeared, or null with no data. */
  readonly appearanceRate: number | null;
  readonly appearanceByEngine: Readonly<Record<string, number>>;
  readonly topCompetitors: readonly { name: string; appearances: number }[];
  readonly topSources: readonly { source: string; appearances: number }[];
  readonly inaccuracyCount: number;
  readonly caveats: readonly string[];
}

export function summarizeObservations(
  accountId: string,
  periodKey: string,
  questions: readonly TrackedQuestion[],
  observations: readonly AnswerObservation[],
): VisibilitySummary {
  const usable = observations.filter((o) => o.collectionMethod !== "not_collected");
  const caveats: string[] = [
    "Observations are point-in-time. Answer engines change their outputs without notice.",
    "Appearance rate describes what was observed on the dates measured. It does not predict future answers.",
  ];

  if (usable.length === 0) {
    caveats.push("No observations were collected this period; every figure below is unmeasured.");
    return {
      accountId,
      periodKey,
      observationCount: 0,
      questionsTracked: questions.length,
      appearanceRate: null,
      appearanceByEngine: {},
      topCompetitors: [],
      topSources: [],
      inaccuracyCount: 0,
      caveats,
    };
  }

  const byEngine = new Map<string, { total: number; appeared: number }>();
  const competitors = new Map<string, number>();
  const sources = new Map<string, number>();
  let inaccuracyCount = 0;

  for (const observation of usable) {
    const engine = byEngine.get(observation.engine) ?? { total: 0, appeared: 0 };
    engine.total++;
    if (observation.brandAppeared) engine.appeared++;
    byEngine.set(observation.engine, engine);

    for (const competitor of observation.competitorsNamed) {
      competitors.set(competitor, (competitors.get(competitor) ?? 0) + 1);
    }
    for (const source of observation.sourcesCited) {
      sources.set(source, (sources.get(source) ?? 0) + 1);
    }
    inaccuracyCount += observation.inaccuracies.length;
  }

  const manualShare = usable.filter((o) => o.collectionMethod === "manual").length / usable.length;
  if (manualShare > 0) {
    caveats.push(
      `${Math.round(manualShare * 100)}% of observations were collected manually; sample size is limited by hand-collection.`,
    );
  }

  const coverage = new Set(usable.map((o) => o.questionId)).size / Math.max(1, questions.length);
  if (coverage < 1) {
    caveats.push(
      `Only ${Math.round(coverage * 100)}% of tracked questions were observed this period.`,
    );
  }

  return {
    accountId,
    periodKey,
    observationCount: usable.length,
    questionsTracked: questions.length,
    appearanceRate: usable.filter((o) => o.brandAppeared).length / usable.length,
    appearanceByEngine: Object.fromEntries(
      [...byEngine.entries()].map(([engine, stats]) => [engine, stats.appeared / stats.total]),
    ),
    topCompetitors: [...competitors.entries()]
      .map(([name, appearances]) => ({ name, appearances }))
      .sort((a, b) => b.appearances - a.appearances)
      .slice(0, 10),
    topSources: [...sources.entries()]
      .map(([source, appearances]) => ({ source, appearances }))
      .sort((a, b) => b.appearances - a.appearances)
      .slice(0, 10),
    inaccuracyCount,
    caveats,
  };
}

/**
 * Compare two periods. Returns deltas with an explicit warning when either
 * period's sample is too small for the comparison to mean anything — the
 * failure mode of this product is a client acting on noise.
 */
export interface VisibilityComparison {
  readonly appearanceRateDelta: number | null;
  readonly newCompetitors: readonly string[];
  readonly lostSources: readonly string[];
  readonly reliable: boolean;
  readonly warnings: readonly string[];
}

const MIN_OBSERVATIONS_FOR_COMPARISON = 20;

export function comparePeriods(
  current: VisibilitySummary,
  previous: VisibilitySummary,
): VisibilityComparison {
  const warnings: string[] = [];
  const reliable =
    current.observationCount >= MIN_OBSERVATIONS_FOR_COMPARISON &&
    previous.observationCount >= MIN_OBSERVATIONS_FOR_COMPARISON;

  if (!reliable) {
    warnings.push(
      `Fewer than ${MIN_OBSERVATIONS_FOR_COMPARISON} observations in at least one period. ` +
        `Treat any change as noise until the sample is larger.`,
    );
  }

  const previousCompetitors = new Set(previous.topCompetitors.map((c) => c.name));
  const currentSources = new Set(current.topSources.map((s) => s.source));

  return {
    appearanceRateDelta:
      current.appearanceRate !== null && previous.appearanceRate !== null
        ? current.appearanceRate - previous.appearanceRate
        : null,
    newCompetitors: current.topCompetitors
      .map((c) => c.name)
      .filter((name) => !previousCompetitors.has(name)),
    lostSources: previous.topSources
      .map((s) => s.source)
      .filter((source) => !currentSources.has(source)),
    reliable,
    warnings,
  };
}

export function summaryToJson(summary: VisibilitySummary): JsonObject {
  return JSON.parse(JSON.stringify(summary)) as JsonObject;
}
