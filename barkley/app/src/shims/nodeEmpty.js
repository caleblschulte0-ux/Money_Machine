/**
 * Empty stand-in for Node builtins (node:fs, node:path, node:crypto, …) that
 * @anthropic-ai/sdk imports for its CLI credential-profile features. Those
 * code paths are unreachable in this app — the client is always constructed
 * with an explicit apiKey (or pointed at the backend proxy) — but Metro still
 * has to resolve the imports at bundle time. See metro.config.js.
 */
module.exports = {};
