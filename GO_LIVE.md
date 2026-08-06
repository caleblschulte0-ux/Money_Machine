# Go live

The shortest path from this repository to shot pages on the public internet,
with signups landing in a real database and alerts landing in your inbox.

Everything in this file has been verified working end-to-end in development
against a real PostgreSQL 16 and a real SMTP conversation. What has NOT been
verified is your specific hosting provider and your specific SMTP vendor —
that's what the smoke test at the end is for.

---

## What only you can do (the capital and account decisions)

These need your identity or your card. Nothing in the codebase can do them,
and nothing else on this list is blocked on code.

| # | Action | Where | Time | Cost |
|---|--------|-------|------|------|
| 1 | Create a Postgres database | neon.tech or supabase.com, free tier | 5 min | $0 |
| 2 | Create a hosting account and connect this GitHub repo | vercel.com or railway.app | 10 min | $0–5/mo |
| 3 | Buy a domain | any registrar | 5 min | ~$10/yr |
| 4 | Get an SMTP credential for alerts | your email provider's app password, or smtp2go/brevo free tier | 10 min | $0 |
| 5 | (When a shot sells something) create a Stripe account and a Payment Link | stripe.com | 15 min | 2.9% + 30¢ |
| 6 | Send traffic | ads, posts, outreach — your call | ongoing | your budget |

Item 6 is the one that matters. The pages do not find visitors on their own,
and the scoreboard refuses to judge an idea fewer than 30 people have seen.

---

## Deploying the shots app

Point the host at `apps/shots` (build command `pnpm build`, or use the
provided `apps/shots/Dockerfile`). Set these environment variables:

```bash
NODE_ENV=production
STORE_DRIVER=prisma
DATABASE_URL=<from step 1>

# 32 random bytes each:  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
SESSION_SECRET=<random>
FIELD_ENCRYPTION_KEY=<random>

# Alerts to your inbox
EMAIL_PROVIDER=smtp
SMTP_HOST=<from step 4>
SMTP_PORT=587
SMTP_USER=<from step 4>
SMTP_PASS=<from step 4>
SMTP_FROM=alerts@yourdomain.com
OWNER_NOTIFY_EMAIL=<your real inbox>
ALLOW_LIVE_COMMUNICATIONS=true

# Keeps the scoreboard private: open /?key=<value>
SCOREBOARD_KEY=<pick a long random string>
```

Then run the schema push once against the production database:

```bash
DATABASE_URL=<prod url> pnpm db:generate && DATABASE_URL=<prod url> pnpm db:push
```

Note `ALLOW_PAID_PROVIDERS` stays **unset** (false). SMTP is the only live
channel, and it only sends to `OWNER_NOTIFY_EMAIL` — alerts to you, nothing
to the public.

## Smoke test (do not skip)

1. Open `https://yourdomain.com/s/quote-chaser` — page loads.
2. Submit the form with your own email.
3. Confirm the signup email arrives in your inbox.
4. Open `https://yourdomain.com/?key=<SCOREBOARD_KEY>` — 1 signup shows.
5. Open the scoreboard without the key — it must say "This page is private."

If all five pass, you are live. If step 3 fails, the problem is the SMTP
credential — everything else will still be recording.

---

## Operating it hands-off

- **Per signup:** you get an email with the person's details and their note.
  Reply personally, fast. That reply is the business.
- **Digest:** run the worker on a schedule (host cron, e.g. daily):
  `pnpm worker shotsDigest` with the same env vars. One email summarising
  every shot: seen by, signups, verdict, what to do.
- **New idea:** copy a block in `packages/shots/src/portfolio.ts`, change the
  words, set `status: "live"`, push. The host redeploys and the page exists.
- **Taking money:** set `paymentLinkUrl` on a shot to your Stripe Payment
  Link. After signup, the page offers the payment; click-throughs show on the
  scoreboard as "Pay clicks".

## What to expect

Nothing in this stack manufactures demand. Realistic use: put 20 ideas in the
portfolio, push traffic at them in batches, kill the ones real visitors ignore
(the scoreboard will tell you which those are), and put your attention on
anything that gets signups — by talking to the people who signed up, before
building anything.
