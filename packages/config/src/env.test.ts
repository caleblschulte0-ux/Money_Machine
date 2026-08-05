import { describe, expect, it } from "vitest";
import { ConfigError, loadEnv } from "./env.ts";

const base = {
  NODE_ENV: "development",
  STORE_DRIVER: "memory",
};

describe("loadEnv safety cross-checks", () => {
  it("defaults every provider to a mock", () => {
    const env = loadEnv(base);
    expect(env.MODEL_PROVIDER).toBe("mock");
    expect(env.EMAIL_PROVIDER).toBe("mock");
    expect(env.PAYMENT_PROVIDER).toBe("mock");
    expect(env.ALLOW_PAID_PROVIDERS).toBe(false);
    expect(env.ALLOW_LIVE_COMMUNICATIONS).toBe(false);
  });

  it("refuses a paid provider unless paid providers are explicitly allowed", () => {
    expect(() => loadEnv({ ...base, MODEL_PROVIDER: "anthropic" })).toThrow(ConfigError);
    expect(() =>
      loadEnv({ ...base, MODEL_PROVIDER: "anthropic", ALLOW_PAID_PROVIDERS: "true" }),
    ).not.toThrow();
  });

  it("refuses paid providers and live communications under NODE_ENV=test", () => {
    expect(() =>
      loadEnv({ ...base, NODE_ENV: "test", ALLOW_PAID_PROVIDERS: "true" }),
    ).toThrow(/Tests may never enable paid providers/);
    expect(() =>
      loadEnv({ ...base, NODE_ENV: "test", ALLOW_LIVE_COMMUNICATIONS: "true" }),
    ).toThrow(/Tests may never enable paid providers/);
  });

  it("requires DATABASE_URL when the prisma driver is selected", () => {
    expect(() => loadEnv({ ...base, STORE_DRIVER: "prisma" })).toThrow(/DATABASE_URL/);
  });

  it("refuses the memory driver and default secrets in production", () => {
    expect(() =>
      loadEnv({ NODE_ENV: "production", STORE_DRIVER: "memory", DATABASE_URL: "postgres://x" }),
    ).toThrow(/SESSION_SECRET|memory/);

    expect(() =>
      loadEnv({
        NODE_ENV: "production",
        STORE_DRIVER: "prisma",
        DATABASE_URL: "postgres://x",
        SESSION_SECRET: "a-real-secret-value-that-is-long",
        FIELD_ENCRYPTION_KEY: "another-real-secret-value-here",
      }),
    ).not.toThrow();
  });

  it("parses budgets as numbers", () => {
    const env = loadEnv({ ...base, BUDGET_AI_INFERENCE_MONTHLY: "250" });
    expect(env.BUDGET_AI_INFERENCE_MONTHLY).toBe(250);
  });
});
