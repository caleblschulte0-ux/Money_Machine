/**
 * Backend configuration — resolved once at boot, from the environment only.
 *
 * Three environments (BARKLY_ENV): development | staging | production.
 * They differ in how much they are willing to assume:
 *
 *   development  permissive defaults, CORS *, no app token required
 *   staging      production rules, smaller budget, verbose logging
 *   production   FAILS CLOSED — refuses to boot without a key, an app token
 *                and an explicit CORS allowlist
 *
 * Boot-time refusal is deliberate. A proxy that silently starts with a
 * wildcard CORS policy and no token is an open relay on someone else's
 * Anthropic bill, and it looks perfectly healthy while it happens.
 */

const ENVS = ['development', 'staging', 'production'];

/** Models the app is allowed to ask for. Anything else is rejected upfront. */
const DEFAULT_MODELS = ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5-20251001'];

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function list(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export class ConfigError extends Error {}

/**
 * Build the runtime config. Throws ConfigError with an actionable message
 * rather than booting into a state the operator did not intend.
 */
export function loadConfig(env = process.env) {
  const name = (env.BARKLY_ENV || 'development').toLowerCase();
  if (!ENVS.includes(name)) {
    throw new ConfigError(`BARKLY_ENV must be one of ${ENVS.join(', ')} (got "${name}")`);
  }
  const isProd = name === 'production';
  const hardened = name !== 'development';

  const apiKey = env.ANTHROPIC_API_KEY || '';
  if (hardened && !apiKey) {
    throw new ConfigError(`ANTHROPIC_API_KEY is required in ${name}`);
  }

  const origins = list(env.BARKLY_ALLOWED_ORIGINS);
  if (isProd && origins.length === 0) {
    throw new ConfigError(
      'BARKLY_ALLOWED_ORIGINS is required in production (comma-separated, or "*" to accept it deliberately)',
    );
  }

  const appToken = env.BARKLY_APP_TOKEN || '';
  if (isProd && !appToken) {
    throw new ConfigError(
      'BARKLY_APP_TOKEN is required in production. It is obfuscation, not authentication ' +
        '(the app ships it), but it stops a stranger pointing curl at this host.',
    );
  }

  const models = list(env.BARKLY_ALLOWED_MODELS);
  const priceIn = Number(env.BARKLY_PRICE_INPUT_PER_MTOK);
  const priceOut = Number(env.BARKLY_PRICE_OUTPUT_PER_MTOK);

  return {
    env: name,
    isProd,
    port: num(env.PORT, 8787),
    apiKey,
    upstream: env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
    anthropicVersion: env.ANTHROPIC_VERSION || '2023-06-01',

    // Who may call us.
    allowedOrigins: origins.length > 0 ? origins : ['*'],
    appToken,
    adminToken: env.BARKLY_ADMIN_TOKEN || '',

    // What they may ask for.
    allowedModels: models.length > 0 ? models : DEFAULT_MODELS,
    defaultModel: env.BARKLY_DEFAULT_MODEL || DEFAULT_MODELS[0],
    maxBodyBytes: num(env.BARKLY_MAX_BODY_BYTES, 128 * 1024),
    maxOutputTokens: num(env.BARKLY_MAX_OUTPUT_TOKENS, 800),
    maxMessages: num(env.BARKLY_MAX_MESSAGES, 40),
    maxSystemChars: num(env.BARKLY_MAX_SYSTEM_CHARS, 24_000),

    // How often, and how much.
    rpm: num(env.BARKLY_RPM_LIMIT, hardened ? 20 : 60),
    burst: num(env.BARKLY_BURST_LIMIT, hardened ? 8 : 20),
    dailyTokenCap: num(env.BARKLY_DAILY_TOKEN_CAP, name === 'production' ? 5_000_000 : 500_000),
    dailyUsdCap: Number.isFinite(Number(env.BARKLY_DAILY_USD_CAP))
      ? Number(env.BARKLY_DAILY_USD_CAP)
      : null,
    perDeviceDailyTokenCap: num(env.BARKLY_DEVICE_DAILY_TOKEN_CAP, 200_000),

    // What a token costs. Left null unless the operator sets it, because a
    // wrong hard-coded price is worse than an honest "tokens only" report.
    pricing:
      Number.isFinite(priceIn) && Number.isFinite(priceOut)
        ? { inputPerMTok: priceIn, outputPerMTok: priceOut }
        : null,

    // Upstream behaviour.
    timeoutMs: num(env.BARKLY_UPSTREAM_TIMEOUT_MS, 20_000),
    retries: Number.isFinite(Number(env.BARKLY_UPSTREAM_RETRIES))
      ? Number(env.BARKLY_UPSTREAM_RETRIES)
      : 2,
    retryBaseMs: num(env.BARKLY_RETRY_BASE_MS, 400),

    logLevel: env.BARKLY_LOG_LEVEL || (name === 'development' ? 'debug' : 'info'),
  };
}

export { DEFAULT_MODELS };
