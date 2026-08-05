import { describe, expect, it } from "vitest";
import {
  addMoney,
  formatMoney,
  grossMarginRatio,
  money,
  scaleMoney,
  sumMoney,
  usd,
} from "./money.ts";

describe("money", () => {
  it("refuses non-integer minor units", () => {
    expect(() => money(10.5)).toThrow(TypeError);
  });

  it("rounds dollars to the nearest cent", () => {
    expect(usd(19.995).amountMinor).toBe(2000);
    expect(usd(0.1).amountMinor).toBe(10);
  });

  it("adds without floating point drift", () => {
    const total = sumMoney([usd(0.1), usd(0.2)]);
    expect(total.amountMinor).toBe(30);
  });

  it("refuses to mix currencies", () => {
    const other = { amountMinor: 100, currency: "EUR" } as unknown as ReturnType<typeof money>;
    expect(() => addMoney(usd(1), other)).toThrow(TypeError);
  });

  it("scales with half-up rounding", () => {
    expect(scaleMoney(money(101), 0.5).amountMinor).toBe(51);
  });

  it("formats negative amounts with the sign outside the currency symbol", () => {
    expect(formatMoney(money(-12345))).toBe("-$123.45");
  });
});

describe("grossMarginRatio", () => {
  it("returns null with no revenue instead of a misleading zero", () => {
    expect(grossMarginRatio(usd(0), usd(500))).toBeNull();
  });

  it("computes the ratio when revenue exists", () => {
    expect(grossMarginRatio(usd(1000), usd(400))).toBeCloseTo(0.6);
  });

  it("goes negative when cost exceeds revenue", () => {
    expect(grossMarginRatio(usd(100), usd(250))).toBeCloseTo(-1.5);
  });
});
