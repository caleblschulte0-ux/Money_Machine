# Barkly backend proxy

The production home for the Anthropic API key. The mobile app never ships a
real credential — its dialogue adapter takes a `baseURL`, and this proxy is
what that URL points at.

```
mobile app ──POST /v1/messages──▶ this proxy ──(+ server-held key)──▶ Anthropic
```

Zero dependencies, plain Node 18+. One process, no build step, deploys
anywhere Node runs (Fly.io, Railway, Render, a VPS).

## Run

```bash
cd barkly/server

# development — permissive, boots with nothing
node index.mjs

# production — refuses to boot half-configured
BARKLY_ENV=production \
ANTHROPIC_API_KEY=sk-ant-... \
BARKLY_ALLOWED_ORIGINS=https://barkly.app \
BARKLY_APP_TOKEN=$(openssl rand -hex 16) \
BARKLY_ADMIN_TOKEN=$(openssl rand -hex 16) \
node index.mjs
```

Then in the app's `.env`:

```
EXPO_PUBLIC_BARKLY_BACKEND_URL=https://your-proxy.example
EXPO_PUBLIC_BARKLY_APP_TOKEN=<the same BARKLY_APP_TOKEN>
EXPO_PUBLIC_ANTHROPIC_API_KEY=      # leave empty — the proxy holds the key
```

## Tests

```bash
cd barkly/server && node --test test/*.test.mjs
```

Fake clock, fake fetch, no network, no spend. They cover the cases you
otherwise only meet in production: a 529, a hung socket, a leaked build asking
for a model we do not allow, and the day the budget runs out.

## What it enforces

**The request body is rebuilt, not forwarded.** Anything the app can set, an
attacker with the `.ipa` can set too. `lib/validate.mjs` reads the fields it
recognises (`model`, `messages`, `system`, a capped `max_tokens`, and a short
allowlist of options) and constructs a fresh body from them. A `tools` array,
a `metadata.user_id`, or `max_tokens: 64000` from a modified client never
reaches Anthropic on our key.

**Model allowlist.** `BARKLY_ALLOWED_MODELS`. A request for anything else is a
400 before it costs a cent.

**Rate limiting.** A token bucket per install (`x-barkly-device`, falling back
to IP), so one abusive device does not throttle a whole school's shared NAT.
`BARKLY_RPM_LIMIT` sustained, `BARKLY_BURST_LIMIT` instantaneous.

**Budget caps.** Daily totals per deployment and per device. When one is hit
the proxy answers 429 with `x-barkly-fallback: 1`, which the app reads as
"use the offline Barkly" rather than showing a child an error.

**Timeouts and retries.** Every upstream attempt has a hard deadline, and the
whole call has an overall deadline so retries cannot stack. Network errors,
408, 429 and 5xx are retried with jittered exponential backoff, honouring
`retry-after`. A 400 is not retried — that is our bug, and retrying it just
spends twice.

**Content-free logging.** `lib/logging.mjs` has no message argument. You log an
event name plus a flat record; numbers and booleans pass, and a *string* passes
only if its field NAME is on an explicit allowlist. `speech` is not on it, so
it is dropped — not truncated. (Truncation was the first version and its own
test killed it: the first 48 characters of "my name is Sam and I live at 12 Elm
Street" is still a child's address.) Device ids are hashed before they are
written, so a log file is not a list of who talked to Barkly.

**Cost accounting.** Token counts are exact, straight from the upstream `usage`
block, and always recorded. Dollars are reported ONLY when you set
`BARKLY_PRICE_INPUT_PER_MTOK` / `BARKLY_PRICE_OUTPUT_PER_MTOK` from the current
price list. There is no hard-coded price table on purpose: a stale invented
number is worse than an honest token count.

`GET /admin/usage` with `x-barkly-admin-token` returns today plus seven days.
Without the header it 404s — an admin endpoint should not advertise itself.

## Environments

`BARKLY_ENV` picks how much the proxy is willing to assume.

| | development | staging | production |
|---|---|---|---|
| boots with no API key | yes | no | no |
| `BARKLY_APP_TOKEN` required | no | no | **yes** |
| `BARKLY_ALLOWED_ORIGINS` required | no (`*`) | no | **yes** |
| default rate limit | 60/min | 20/min | 20/min |
| default daily token cap | 500k | 500k | 5M |

Production **refuses to start** rather than come up as an open relay on
someone else's Anthropic bill — an open relay looks perfectly healthy while it
happens, which is exactly why it is a boot-time check and not a warning.

## Every environment variable

| var | default | what it does |
|---|---|---|
| `BARKLY_ENV` | `development` | `development` / `staging` / `production` |
| `PORT` | `8787` | listen port |
| `ANTHROPIC_API_KEY` | — | the real key; required outside development |
| `ANTHROPIC_BASE_URL` | `https://api.anthropic.com` | upstream override |
| `BARKLY_ALLOWED_ORIGINS` | `*` | comma-separated CORS allowlist |
| `BARKLY_APP_TOKEN` | — | required in prod; see the note below |
| `BARKLY_ADMIN_TOKEN` | — | gates `GET /admin/usage` |
| `BARKLY_ALLOWED_MODELS` | opus-5, sonnet-5, haiku-4.5 | comma-separated |
| `BARKLY_DEFAULT_MODEL` | `claude-opus-5` | used when the client sends none |
| `BARKLY_MAX_BODY_BYTES` | `131072` | request ceiling |
| `BARKLY_MAX_OUTPUT_TOKENS` | `800` | hard cap on `max_tokens` |
| `BARKLY_MAX_MESSAGES` | `40` | conversation length ceiling |
| `BARKLY_MAX_SYSTEM_CHARS` | `24000` | system prompt ceiling |
| `BARKLY_RPM_LIMIT` | 20 (60 dev) | sustained requests/min per install |
| `BARKLY_BURST_LIMIT` | 8 (20 dev) | bucket size |
| `BARKLY_DAILY_TOKEN_CAP` | 5M prod / 500k | deployment-wide daily ceiling |
| `BARKLY_DAILY_USD_CAP` | — | only meaningful with pricing set |
| `BARKLY_DEVICE_DAILY_TOKEN_CAP` | `200000` | per-install daily ceiling |
| `BARKLY_PRICE_INPUT_PER_MTOK` | — | USD per million input tokens |
| `BARKLY_PRICE_OUTPUT_PER_MTOK` | — | USD per million output tokens |
| `BARKLY_UPSTREAM_TIMEOUT_MS` | `20000` | per-attempt deadline |
| `BARKLY_UPSTREAM_RETRIES` | `2` | retries after the first attempt |
| `BARKLY_RETRY_BASE_MS` | `400` | backoff base |
| `BARKLY_LOG_LEVEL` | `info` (`debug` in dev) | |

## Honest limits

These are real, and they are cheap to fix when they start to matter — they are
listed so nobody deploys thinking otherwise.

- **`BARKLY_APP_TOKEN` is obfuscation, not authentication.** The app ships it,
  so anyone who unpacks the binary has it. It stops a stranger who finds the
  host from curling it; it does not stop a determined attacker. The controls
  that actually bound the damage are the rate limit and the budget caps. Real
  per-user auth arrives with accounts, and that is also where parental
  controls attach.
- **Rate-limit and budget state is in-memory**, so it is per-instance and
  resets on deploy. Correct for one small box. Two instances means two
  budgets — put a shared store behind `lib/ratelimit.mjs` and `lib/cost.mjs`
  (both are single-purpose modules with one seam each) before scaling out.
- **No streaming.** Barkly's replies are 1–3 sentences and he speaks them
  aloud, so a partial token stream buys nothing today. `stream: true` is
  dropped by the validator rather than half-supported.
