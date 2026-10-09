# CLAUDE.md

Gold tracker: records purchases of plain 9999 gold rings and shows profit/loss against Ngọc Thịnh's
live price. Single user, built phase by phase (see the plan doc "Kế hoạch build app quản lý vàng (v2)").

## Product decisions (do not change without asking)

- Only track **"Vàng 9999 (nhẫn tròn)"** from Ngọc Thịnh. Price source: the table on the homepage
  https://ngocthinh-jewelry.vn/ (unit VNĐ/CHỈ, numbers like `13.240.000`, "CẬP NHẬT LÚC HH:mm dd/MM/yyyy"
  in Vietnam time). The table appears twice in the HTML; it also has 98 and 96 nhẫn tròn rows.
- Prices are fetched **only on demand**: when the user opens the app (TTL `PRICE_TTL_SECONDS`, default 600) or presses "Làm mới" (30 s cooldown counted from the last attempt). No scheduled jobs. After a
  failed crawl, do not retry for `PRICE_FAILURE_BACKOFF_SECONDS` (default 60); serve the old snapshot
  with `refreshError`.
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
```

## Conventions

- Put shared types, zod schemas, money/quantity math and formatters in `packages/shared` so the web
  form and the API compute identical numbers.
- Tests live next to the code (`*.test.ts`); API e2e tests in `apps/api/test/`.
- Crawler tests use saved real HTML fixtures, never the network.
- Commit per phase with message `phase-N: ...`.
