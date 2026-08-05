# Local development

## Requirements

Node 22+, pnpm 10+. Docker only if you want PostgreSQL.

## First run

```bash
pnpm install
pnpm seed     # fictional data, in-memory
pnpm dev      # http://localhost:3000
```

No `.env`, no database, no API keys. Defaults: in-memory store, mock providers,
paid providers off, live communications off.

## With PostgreSQL

```bash
cp .env.example .env          # set STORE_DRIVER=prisma
docker compose up -d postgres
pnpm db:generate
pnpm db:push
pnpm seed
```

`docker-compose.yml` also provides Redis (unused so far) and Mailpit, a local
SMTP sink for when the SMTP adapter is written — nothing leaves the machine.

## Commands

```bash
pnpm test                 # all tests
pnpm test:watch
npx vitest run packages/workflows      # one package
pnpm typecheck
pnpm build
pnpm worker               # all maintenance jobs once
pnpm worker expireApprovals            # one job
```

## Layout conventions

- Packages export `./src/index.ts` directly — **no build step**. Edit and the
  change is live everywhere.
- Every package has `tsconfig.json` extending `tsconfig.base.json`.
- Tests live beside their source as `*.test.ts`.
- Integration tests live in `tests/integration/`.

## Adding a platform package

1. `packages/<name>/{package.json,tsconfig.json,src/index.ts}` — copy the shape
   of a small existing package.
2. Add workspace deps as `"@holdco/x": "workspace:*"`, then `pnpm install`.
3. If a Next page will import it, add it to `transpilePackages` in
   `apps/command-center/next.config.ts`.

## Adding a venture

1. `ventures/<key>/` with a `package.json` naming it `@venture/<key>`.
2. Export a `MANIFEST` — `validateManifest()` will reject it without kill
   criteria, and reject any offer with no non-claims.
3. Export `MODULE = { manifest, workflows, agents, prompts, flags }`.
4. Install it: `installVentureModule(platform, MODULE)`.
5. Write the ten required documents (see any existing venture folder).

## Writing tests

Use `@holdco/testing` for fixtures. Everything is fictional: `.invalid` domains
(reserved by RFC 2606, guaranteed never to resolve) and 555 phone numbers.

```ts
const clock = testClock();                 // deterministic
const store = testStore(clock);
const platform = await createPlatform({ env: testEnv(), clock, logger });
```

`testEnv()` sets `NODE_ENV=test`, which makes the config layer **reject** paid
providers and live communications outright. A test cannot spend money or email
a person even by mistake.

Note: with a fixed clock, records created in the same call share a timestamp,
so do not assert on insertion order — select records by content.

## Debugging

- `LOG_LEVEL=debug pnpm dev` — structured JSON logs, automatically redacted
- Command Center → Audit trail — every consequential action with its actor
- Command Center → Automation — workflow and agent runs with costs and errors
- `engine.dryRun()` — see what a workflow would do without doing it
