/**
 * Barkly backend proxy — the production home for the Anthropic API key.
 *
 * The mobile app's Anthropic adapter takes a baseURL; point
 * EXPO_PUBLIC_BARKLY_BACKEND_URL at this server and the app never carries a
 * real key. The proxy forwards ONLY POST /v1/messages to Anthropic, attaching
 * the server-held key, and enforces a request ceiling per client IP so a leaked
 * app build can't drain the account.
 *
 * Zero dependencies — plain Node 18+ (global fetch). Run:
 *   ANTHROPIC_API_KEY=sk-... node index.mjs           # port 8787
 */

import http from 'node:http';

const PORT = Number(process.env.PORT || 8787);
const KEY = process.env.ANTHROPIC_API_KEY;
const UPSTREAM = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
const MAX_BODY = 512 * 1024;

// Naive fixed-window rate limit: enough to stop abuse of a dev deployment.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = Number(process.env.BARKLY_RPM_LIMIT || 30);
const hits = new Map(); // ip -> { count, windowStart }

function limited(ip) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.windowStart > WINDOW_MS) {
    hits.set(ip, { count: 1, windowStart: now });
    return false;
  }
  h.count += 1;
  return h.count > MAX_PER_WINDOW;
}

const CORS = {
  'Access-Control-Allow-Origin': '*', // tighten to the app's origin(s) in production
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, anthropic-version, x-api-key, anthropic-dangerous-direct-browser-access',
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }
  if (req.method !== 'POST' || req.url !== '/v1/messages') {
    res.writeHead(404, { ...CORS, 'content-type': 'application/json' });
    return res.end(JSON.stringify({ error: 'not found' }));
  }
  if (!KEY) {
    res.writeHead(500, { ...CORS, 'content-type': 'application/json' });
    return res.end(JSON.stringify({ error: 'server missing ANTHROPIC_API_KEY' }));
  }
  const ip = req.socket.remoteAddress || 'unknown';
  if (limited(ip)) {
    res.writeHead(429, { ...CORS, 'content-type': 'application/json' });
    return res.end(JSON.stringify({ error: 'rate limited' }));
  }

  let body = '';
  let over = false;
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > MAX_BODY && !over) {
      over = true;
      res.writeHead(413, { ...CORS, 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'request too large' }));
      req.destroy();
    }
  });
  req.on('end', async () => {
    if (over) return;
    try {
      const upstream = await fetch(`${UPSTREAM}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': KEY,
          'anthropic-version': req.headers['anthropic-version'] || '2023-06-01',
        },
        body,
      });
      const text = await upstream.text();
      res.writeHead(upstream.status, { ...CORS, 'content-type': 'application/json' });
      res.end(text);
    } catch (e) {
      res.writeHead(502, { ...CORS, 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: `upstream failure: ${e.message}` }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`barkly proxy listening on :${PORT} (upstream ${UPSTREAM}, limit ${MAX_PER_WINDOW}/min/ip)`);
});
