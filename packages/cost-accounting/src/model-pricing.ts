import { money, type Money } from "@holdco/core";

/**
 * Model pricing used to convert token usage into money.
 *
 * IMPORTANT: these figures are configuration, not facts the platform can
 * verify. They must be checked against the vendor's current price list before
 * any live spend, and the source date below is the last time a human did that.
 * The mock provider bills at zero, so nothing here affects a default run.
 */
export interface ModelPrice {
  readonly provider: string;
  readonly model: string;
  /** USD per million input tokens. */
  readonly inputPerMillionUsd: number;
  /** USD per million output tokens. */
  readonly outputPerMillionUsd: number;
  /** When a human last verified this against the vendor price list. */
  readonly verifiedOn: string | null;
}

export const MODEL_PRICES: readonly ModelPrice[] = [
  { provider: "mock", model: "mock-small", inputPerMillionUsd: 0, outputPerMillionUsd: 0, verifiedOn: null },
  { provider: "mock", model: "mock-large", inputPerMillionUsd: 0, outputPerMillionUsd: 0, verifiedOn: null },
];

export class UnknownModelPriceError extends Error {
  constructor(provider: string, model: string) {
    super(
      `No price is configured for ${provider}/${model}. Add it to MODEL_PRICES with a ` +
        `verification date before enabling this model — the platform will not guess a price.`,
    );
    this.name = "UnknownModelPriceError";
  }
}

export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

/**
 * Cost of one model call, rounded up to the cent. Rounding up is deliberate:
 * under-reporting AI spend is the failure mode that quietly destroys margin.
 */
export function costOfUsage(provider: string, model: string, usage: TokenUsage): Money {
  const price = MODEL_PRICES.find((p) => p.provider === provider && p.model === model);
  if (!price) throw new UnknownModelPriceError(provider, model);

  const usd =
    (usage.inputTokens / 1_000_000) * price.inputPerMillionUsd +
    (usage.outputTokens / 1_000_000) * price.outputPerMillionUsd;

  return money(Math.ceil(usd * 100));
}

export function knownModels(): readonly string[] {
  return MODEL_PRICES.map((p) => `${p.provider}/${p.model}`);
}

/** Models with no human-verified price cannot be used for live spend. */
export function isPriceVerified(provider: string, model: string): boolean {
  const price = MODEL_PRICES.find((p) => p.provider === provider && p.model === model);
  if (!price) return false;
  if (price.provider === "mock") return true;
  return price.verifiedOn !== null;
}
