/**
 * Money is always stored and passed around as integer minor units (cents).
 * Floating point dollars are never persisted and never summed.
 */
export type CurrencyCode = "USD";

export interface Money {
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
}

export function money(amountMinor: number, currency: CurrencyCode = "USD"): Money {
  if (!Number.isInteger(amountMinor)) {
    throw new TypeError(`Money must be an integer number of minor units, got ${amountMinor}`);
  }
  return { amountMinor, currency };
}

/** Convert a decimal dollar figure to Money, rounding half-up to the cent. */
export function usd(dollars: number): Money {
  return money(Math.round(dollars * 100));
}

export const ZERO_USD: Money = { amountMinor: 0, currency: "USD" };

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new TypeError(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor + b.amountMinor, a.currency);
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor - b.amountMinor, a.currency);
}

export function sumMoney(values: readonly Money[], currency: CurrencyCode = "USD"): Money {
  return values.reduce<Money>((acc, v) => addMoney(acc, v), money(0, currency));
}

/** Multiply by a ratio, rounding half-up. Used for margins, shares, taxes. */
export function scaleMoney(value: Money, factor: number): Money {
  return money(Math.round(value.amountMinor * factor), value.currency);
}

export function compareMoney(a: Money, b: Money): number {
  assertSameCurrency(a, b);
  return a.amountMinor - b.amountMinor;
}

export function isNegative(value: Money): boolean {
  return value.amountMinor < 0;
}

export function toDollars(value: Money): number {
  return value.amountMinor / 100;
}

export function formatMoney(value: Money): string {
  const sign = value.amountMinor < 0 ? "-" : "";
  const abs = Math.abs(value.amountMinor);
  return `${sign}$${(abs / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Gross margin as a ratio in [-inf, 1]. Returns null when there is no revenue,
 * because "0% margin" and "no revenue yet" are different facts and the
 * command center must not display the second as the first.
 */
export function grossMarginRatio(revenue: Money, cost: Money): number | null {
  if (revenue.amountMinor === 0) return null;
  return (revenue.amountMinor - cost.amountMinor) / revenue.amountMinor;
}
