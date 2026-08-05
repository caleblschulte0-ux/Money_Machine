import { z } from "zod";

const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === "boolean" ? v : ["1", "true", "yes", "on"].includes(v.toLowerCase())));

const positiveNumber = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "number" ? v : Number(v)))
  .refine((v) => Number.isFinite(v) && v >= 0, "must be a non-negative number");

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  STORE_DRIVER: z.enum(["memory", "prisma"]).default("memory"),
  DATABASE_URL: z.string().optional(),

  QUEUE_DRIVER: z.enum(["memory", "redis"]).default("memory"),
  REDIS_URL: z.string().optional(),

  MODEL_PROVIDER: z.enum(["mock", "anthropic", "openai"]).default("mock"),
  EMAIL_PROVIDER: z.enum(["mock", "smtp", "resend"]).default("mock"),
  SMS_PROVIDER: z.enum(["mock", "twilio"]).default("mock"),
  TELEPHONY_PROVIDER: z.enum(["mock", "twilio"]).default("mock"),
  PAYMENT_PROVIDER: z.enum(["mock", "stripe"]).default("mock"),
  STORAGE_PROVIDER: z.enum(["memory", "s3"]).default("memory"),

  ALLOW_PAID_PROVIDERS: booleanish.default(false),
  ALLOW_LIVE_COMMUNICATIONS: booleanish.default(false),

  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  SESSION_SECRET: z.string().default("dev-only-session-secret-change-me"),
  FIELD_ENCRYPTION_KEY: z.string().default("dev-only-field-encryption-key-change"),

  BUDGET_AI_INFERENCE_MONTHLY: positiveNumber.default(200),
  BUDGET_ADVERTISING_MONTHLY: positiveNumber.default(0),
  BUDGET_CONTRACTOR_MONTHLY: positiveNumber.default(0),
  BUDGET_EXPERIMENT_MONTHLY: positiveNumber.default(500),

  APPROVAL_THRESHOLD_USD: positiveNumber.default(100),
});

export type Env = z.infer<typeof envSchema>;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * Parse and cross-validate configuration.
 *
 * The cross-checks are the important part: they are what stops a mis-set
 * variable from quietly turning a development run into one that spends money
 * or sends real messages.
 */
export function loadEnv(source: NodeJS.ProcessEnv | Record<string, unknown> = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new ConfigError(`Invalid environment configuration:\n${issues}`);
  }
  const env = parsed.data;

  if (env.STORE_DRIVER === "prisma" && !env.DATABASE_URL) {
    throw new ConfigError("STORE_DRIVER=prisma requires DATABASE_URL to be set.");
  }
  if (env.QUEUE_DRIVER === "redis" && !env.REDIS_URL) {
    throw new ConfigError("QUEUE_DRIVER=redis requires REDIS_URL to be set.");
  }

  const paidProviders: Array<[string, string]> = [
    ["MODEL_PROVIDER", env.MODEL_PROVIDER],
    ["EMAIL_PROVIDER", env.EMAIL_PROVIDER],
    ["SMS_PROVIDER", env.SMS_PROVIDER],
    ["TELEPHONY_PROVIDER", env.TELEPHONY_PROVIDER],
    ["PAYMENT_PROVIDER", env.PAYMENT_PROVIDER],
  ];
  const live = paidProviders.filter(([, value]) => value !== "mock" && value !== "smtp");
  if (live.length > 0 && !env.ALLOW_PAID_PROVIDERS) {
    throw new ConfigError(
      `These providers are set to a paid vendor but ALLOW_PAID_PROVIDERS is false: ` +
        `${live.map(([k, v]) => `${k}=${v}`).join(", ")}. ` +
        `Enabling paid providers is an owner decision — set ALLOW_PAID_PROVIDERS=true deliberately.`,
    );
  }

  if (env.NODE_ENV === "test" && (env.ALLOW_PAID_PROVIDERS || env.ALLOW_LIVE_COMMUNICATIONS)) {
    throw new ConfigError(
      "Tests may never enable paid providers or live communications. " +
        "Unset ALLOW_PAID_PROVIDERS / ALLOW_LIVE_COMMUNICATIONS for NODE_ENV=test.",
    );
  }

  if (env.NODE_ENV === "production") {
    if (env.SESSION_SECRET.startsWith("dev-only")) {
      throw new ConfigError("SESSION_SECRET must be set to a real secret in production.");
    }
    if (env.FIELD_ENCRYPTION_KEY.startsWith("dev-only")) {
      throw new ConfigError("FIELD_ENCRYPTION_KEY must be set to a real secret in production.");
    }
    if (env.STORE_DRIVER === "memory") {
      throw new ConfigError("STORE_DRIVER=memory is not permitted in production.");
    }
  }

  return env;
}

let cached: Env | null = null;

export function env(): Env {
  cached ??= loadEnv();
  return cached;
}

/** Test helper — forget the memoised environment. */
export function resetEnvCache(): void {
  cached = null;
}
