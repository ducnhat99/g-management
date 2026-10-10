# CLAUDE.md

Gold tracker: records purchases of plain 9999 gold rings and shows profit/loss against Ngọc Thịnh's
live price. Single user, built phase by phase (see the plan doc "Kế hoạch build app quản lý vàng (v2)").

## Product decisions (do not change without asking)

- Only track **"Vàng 9999 (nhẫn tròn)"** from Ngọc Thịnh. Price source: the table on the homepage
  <https://ngocthinh-jewelry.vn/> (unit VNĐ/CHỈ, numbers like `13.240.000`, "CẬP NHẬT LÚC HH:mm dd/MM/yyyy"
  in Vietnam time). The table appears twice in the HTML; it also has 98 and 96 nhẫn tròn rows.
- Prices are fetched **only on demand**, never by a scheduled job. One rule for both app open
  (`GET /prices/latest`) and "Làm mới" (`POST /prices/refresh`): crawl only if the last successful
  crawl (`checked_at`) is older than `PRICE_TTL_SECONDS` (default 3600 = 1 hour). Otherwise reuse the
  stored price. `PriceDto.nextRefreshAt` says when crawling is allowed again; the UI keeps "Làm mới"
  disabled until then, and an early `POST /prices/refresh` gets 429 with `nextRefreshAt`.
- After a failed crawl, serve the old snapshot with `refreshError` and allow a retry after
  `PRICE_FAILURE_BACKOFF_SECONDS` (default 60), not after the full hour. All of this lives only in
  `PricesService`.
- Profit/loss uses the shop's **buy price (giá mua vào)**, i.e. what the shop pays you back.
- Quantity is stored in **chỉ** (1 cây = 10 chỉ) as `Decimal(10,3)`. It crosses the API as a decimal
  string (`"0.5"`). Never `parseFloat` a quantity; parse the string into thousandths of a chỉ.
- Money is VND as integers (`bigint` in the DB, `number` in DTOs). Never use floats for money.
- All "today" / holding-days logic uses `Asia/Ho_Chi_Minh`. Purchase dates are `YYYY-MM-DD` strings.
- The web app uses Supabase **only for auth**. All data goes through the NestJS API. The Supabase Data
  API is disabled and RLS is enabled on every table with no policies.
- Every purchase carries `user_id` even though there is one user.

## Stack and versions

| Area            | Choice                                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| Runtime         | Node 24 LTS (`.nvmrc`), `engines >=22.12`                                                                 |
| Package manager | pnpm 10 via corepack (`packageManager` in root `package.json`)                                            |
| Monorepo        | Turborepo 2; `shared` builds before the apps (`dependsOn: ["^build"]`)                                    |
| API             | NestJS 12 in `apps/api`, port 4000                                                                        |
| Web             | Next.js 16 App Router + Tailwind v4 in `apps/web`, port 3000                                              |
| Shared          | `packages/shared` (`@gold/shared`), built by tsup to ESM + CJS                                            |
| TypeScript      | 6.0.x everywhere. Do not upgrade to 7 yet: typescript-eslint supports `<6.1` and the Nest CLI pins `~6.0` |
| Tests           | Vitest everywhere. API uses `unplugin-swc` for decorator metadata                                         |
| Lint/format     | ESLint 10 flat config + Prettier, both at the repo root                                                   |
| DB (Phase 1+)   | Supabase Postgres + Prisma pinned to 6.x                                                                  |

Module format notes:

- NestJS 12 packages are ESM-only. `apps/api` itself compiles to CommonJS (`module: nodenext`, no
  `"type": "module"`) and loads Nest through Node's `require(esm)`, same as the official Nest 12 starter.
  Relative imports in the API are extensionless.
- `@gold/shared` ships both formats; the API resolves the `require` export, the web app the `import` one.
- tsup's DTS step needs `ignoreDeprecations: '6.0'` (set in `packages/shared/tsup.config.ts`).

## Commands

```bash
pnpm dev         # shared (tsup --watch) + api + web
pnpm build
pnpm test        # Vitest in all packages
pnpm lint
pnpm typecheck
pnpm format
pnpm --filter api test   # one package

# Database (run in apps/api, or via pnpm --filter api <script>)
pnpm db:migrate  # prisma migrate dev
pnpm db:seed     # idempotent upsert of GoldType NT_9999
pnpm db:studio
```

## Database

- Schema: `apps/api/prisma/schema.prisma`; config: `apps/api/prisma.config.ts` (loads `.env` via
  dotenv, because Prisma skips `.env` loading when a config file exists).
- Tables and columns are snake_case via `@@map`/`@map` (`gold_types`, `price_snapshots`, `purchases`).
- CHECK constraints and `ENABLE ROW LEVEL SECURITY` are hand-written in migration SQL. For schema
  changes that need them, use `prisma migrate dev --create-only`, edit the SQL, then apply.
- Responses never expose raw Prisma values: use `src/prisma/serialize.ts` (`bigintToNumber`,
  `decimalToString`, `dateToIsoDate`) in DTO mappers.
- `PrismaService` connects lazily, so tests that don't query the DB need no database.

## Auth

- `SupabaseAuthGuard` is global (`APP_GUARD`): every route needs a Supabase access token unless
  marked `@Public()` (only `/health` today). Get the user with `@CurrentUser() userId: string`.
- Tokens are verified with `jose` against `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` (this
  project signs with ES256), checking `iss`, `aud = "authenticated"`, `exp` and a uuid `sub`.
  `SUPABASE_JWT_SECRET` (HS256) is only for legacy projects; leave it empty.
- Every purchase query is scoped by `userId` in `PurchaseStore`; another user's row is a 404.
- Validate request bodies with `new ZodValidationPipe(schema)` using schemas from `@gold/shared`.
  400 responses are `{ message: 'Validation failed', issues: [{ path, message }] }`.
- Web (`apps/web`): `src/proxy.ts` (Next 16's renamed middleware) refreshes the Supabase session on
  every page request and redirects signed-out users to `/login?next=...` (sanitized by
  `safeNextPath`). Server code checks the user with `getClaims()`, never `getSession()`. Signed-in
  pages live under `src/app/(app)/`. Client Components call the API through `getApi()` from
  `src/lib/api.ts` (Bearer token, refresh + retry once on 401) and TanStack Query.
- Before writing Next.js code, read the bundled docs in `apps/web/node_modules/next/dist/docs/`.
- Dashboard UI lives in `apps/web/src/components/dashboard/`; data hooks in `src/lib/queries.ts`
  (every mutation invalidates the summary). Component tests use `// @vitest-environment jsdom`,
  Testing Library, `vi.mock('@/lib/api')`, and data built with the real `calculatePortfolio`;
  compare VND text after replacing the non-breaking space (`formatVND(n).replace(/\s/g, ' ')`).
- Render's free plan sleeps the API. The web pings `/health` on every page load (`WarmUpApi` in the
  root layout), and if `/portfolio/summary` takes over 1.5 s the dashboard shows the "Hứng vàng"
  mini-game (`src/components/catch-gold/`: pure `engine.ts` + canvas `draw.ts`). The game makes no
  API calls; the player leaves via the "Dữ liệu đã sẵn sàng" bar, never automatically.
- E2E tests use `test/support/test-app.ts`: the real `AppModule` with a locally generated ES256 key
  (`tokenFor(userId)`) and an in-memory `PurchaseStore`.

## Conventions

- Put shared types, zod schemas, money/quantity math and formatters in `packages/shared` so the web
  form and the API compute identical numbers.
- Tests live next to the code (`*.test.ts`); API e2e tests in `apps/api/test/`.
- Crawler tests use saved real HTML fixtures, never the network. Fixtures are excluded from
  Prettier; build failure variants by editing a copy of the fixture string in the test.
- The crawler (`apps/api/src/prices/sources/ngocthinh.ts`) finds the table by its header text, not
  CSS classes (the markup is div rows, not `<table>`). Observed 2026-10-09: the site changed prices
  without changing "CẬP NHẬT LÚC", so never assume same timestamp means same price.
- Profit/loss comes only from `calculatePortfolio` in `@gold/shared` (API and web form alike): each
  lot's cost/value is rounded half-up to whole đồng, totals are sums of the rounded lots, and
  percentages round half away from zero to 2 decimals. Use `formatVND`, `formatChi`,
  `formatPercent` for display.
- Don't run Nest code through `tsx` (esbuild emits no decorator metadata, so DI injects
  `undefined`). For ad-hoc scripts, `pnpm build` and require from `apps/api/dist`.
- Deploy (see `DEPLOY.md`): API on Render from `apps/api/Dockerfile` via `render.yaml` (one
  instance only: price state is in memory; migrations run on container start); web on Vercel with
  root `apps/web` and `apps/web/vercel.json`. Test the image locally with
  `docker build --platform linux/amd64 -f apps/api/Dockerfile .` from the repo root.
- Commit per phase with message `phase-N: ...`.
