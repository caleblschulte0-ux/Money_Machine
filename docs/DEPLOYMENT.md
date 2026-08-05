# Deployment

**Nothing here has been deployed.** No production environment exists, no
pipeline is configured, and the Prisma adapter has never run against a live
PostgreSQL instance. This document is the intended path and its gates, not a
description of a working deployment.

## What the config layer enforces in production

`loadEnv()` refuses to start when `NODE_ENV=production` and:

- `SESSION_SECRET` is still the dev default
- `FIELD_ENCRYPTION_KEY` is still the dev default
- `STORE_DRIVER=memory`

A production build of the Command Center is intentionally request-time rendered
so it never boots the platform during a build.

## Before the first deploy

**Infrastructure**
- [ ] PostgreSQL with automated backups
- [ ] **A restore actually tested**, not just configured
- [ ] Secret storage that is not a `.env` file on a server
- [ ] TLS everywhere
- [ ] Log aggregation and retention

**Configuration**
- [ ] Real `SESSION_SECRET` and `FIELD_ENCRYPTION_KEY` (32 random bytes each)
- [ ] `STORE_DRIVER=prisma` with a real `DATABASE_URL`
- [ ] Every provider still `mock` unless deliberately enabled
- [ ] `ALLOW_PAID_PROVIDERS=false` and `ALLOW_LIVE_COMMUNICATIONS=false` until
      an owner decides otherwise

**Verification**
- [ ] `pnpm typecheck && pnpm test` clean
- [ ] `pnpm db:push` against a scratch database, then inspect the schema
- [ ] `pnpm seed` against that database
- [ ] Every Command Center page loads

**Gaps to close first**
- [ ] Authentication in the Command Center UI (it currently assumes a single
      trusted operator)
- [ ] A real job scheduler for the worker
- [ ] Dependency scanning

## Enabling a paid provider

Deliberately multi-step, in this order:

1. Write the adapter. `UnimplementedModelProvider` throws by design.
2. Add pricing to `MODEL_PRICES` with a `verifiedOn` date from the vendor's
   current price list. The agent runner refuses to spend against an unverified
   rate.
3. Test against the vendor's sandbox with `ALLOW_PAID_PROVIDERS=false` still
   set, to confirm the refusal path works.
4. Set a hard budget with `costs.setBudget()` **before** enabling spend.
5. Get owner approval, recorded in the approval queue.
6. Set `ALLOW_PAID_PROVIDERS=true` and switch the one provider.
7. Watch cost per run for the first day.

Enabling live communications is the same shape, plus: verify suppression and
consent behaviour against the real provider with a seed list you control, and
confirm the `killswitch.outbound_communications` switch stops delivery.

## Rollback

- Feature flags and kill switches take effect immediately without a deploy.
  Pull `killswitch.all_automation` first, diagnose second.
- Schema changes need real migrations (`prisma migrate`), not `db:push`, once
  data exists.
- Workflow and agent definitions are versioned; reverting means republishing
  the previous version, which the run history will record.
