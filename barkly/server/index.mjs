#!/usr/bin/env node
/**
 * Barkly backend proxy — the production home for the Anthropic API key.
 *
 *   mobile app --POST /v1/messages--> this proxy --(+ server-held key)--> Anthropic
 *
 * The app's dialogue adapter takes a baseURL; point
 * EXPO_PUBLIC_BARKLY_BACKEND_URL at this server and the binary never carries a
 * real credential. Everything the proxy enforces lives in ./lib — config,
 * validation, rate limiting, budget caps, retries, content-free logging.
 *
 * Zero dependencies (plain Node 18+). See README.md for deployment.
 */

import { loadConfig, ConfigError } from './lib/config.mjs';
import { createLogger } from './lib/logging.mjs';
import { createServer } from './lib/server.mjs';

let config;
try {
  config = loadConfig(process.env);
} catch (err) {
  if (err instanceof ConfigError) {
    console.error(`barkly-proxy: refusing to start — ${err.message}`);
    process.exit(1);
  }
  throw err;
}

const log = createLogger({ level: config.logLevel, env: config.env });
const server = createServer(config, { logger: log });

server.listen(config.port, () => {
  log.info('server.listening', {
    port: config.port,
    model: config.defaultModel,
    rpm: config.rpm,
    burst: config.burst,
    dailyTokenCap: config.dailyTokenCap,
    pricing: config.pricing ? 'configured' : 'tokens-only',
    origins: config.allowedOrigins.join(','),
    appToken: config.appToken ? 'required' : 'none',
  });
  if (!config.isProd && config.allowedOrigins.includes('*')) {
    log.warn('cors.wildcard', { reason: 'set BARKLY_ALLOWED_ORIGINS before exposing this host' });
  }
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    log.info('server.stopping', { reason: sig });
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
