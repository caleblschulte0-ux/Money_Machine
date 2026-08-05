# Tests

Unit tests live beside their source as `packages/*/src/**/*.test.ts`.
Cross-package tests live here.

## Integration tests

`integration/lead-to-approval.test.ts` exercises the whole platform through its
composition root: a venture module is installed, a lead is captured and scored,
the venture's workflow runs, work reaches a human, launch gates block and then
release a stage transition, costs are attributed, and billing refuses to charge.

This is the test that catches the composition root drifting away from the
packages it wires together.

## Conventions

- `@holdco/testing` provides fixtures and a `FixedClock`
- `testEnv()` sets `NODE_ENV=test`, which makes the config layer **reject**
  paid providers and live communications — a test cannot spend money or email
  a person even by mistake
- All data is fictional: `.invalid` domains, 555 phone numbers
- With a fixed clock, records created in one call share a timestamp, so select
  records by content rather than asserting on insertion order

## Running

```bash
pnpm test
npx vitest run packages/workflows
npx vitest run tests/integration
```

## Not covered

No browser end-to-end tests (Playwright is not configured), no load testing,
and the Prisma adapter is untested because no database is available in the
build environment. See `docs/KNOWN_LIMITATIONS.md`.
