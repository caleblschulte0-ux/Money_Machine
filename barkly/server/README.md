# Barkly backend proxy

The production home for the Anthropic API key. The mobile app never ships a
real key — its Anthropic adapter takes a `baseURL`, and this proxy is what
that URL points at.

```
mobile app ──POST /v1/messages──▶ this proxy ──(+ server-held key)──▶ Anthropic
```

## Run

```bash
cd barkly/server
ANTHROPIC_API_KEY=sk-ant-... node index.mjs     # listens on :8787
```

Then in the app's `.env`:

```
EXPO_PUBLIC_BARKLY_BACKEND_URL=http://<your-host>:8787
EXPO_PUBLIC_ANTHROPIC_API_KEY=      # leave empty — the proxy holds the key
```

Zero dependencies (plain Node 18+). Env knobs: `PORT` (8787),
`BARKLY_RPM_LIMIT` (30 requests/min/IP), `ANTHROPIC_BASE_URL`.

## What it does / doesn't

- Forwards **only** `POST /v1/messages`; everything else 404s.
- Per-IP fixed-window rate limit and a 512KB body cap, so a leaked app build
  can't drain the account.
- CORS is `*` for development — tighten `Access-Control-Allow-Origin` before
  any public deployment.
- No auth of its own yet. Before real users: per-device tokens (which is also
  where parental controls attach — see `../docs/ARCHITECTURE.md`).

Deploy anywhere Node runs (Fly.io, Railway, a VPS). One file, no build step.
