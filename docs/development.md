# 개발 환경

pnpm workspace with a Next.js app and a NestJS API on Postgres + PostGIS.

```
apps/web   Next.js 16 (App Router, Tailwind 4, shadcn/ui)        :3000
apps/api   NestJS 12 (ESM, Prisma 7, Swagger, oxlint)            :3001, routes under /api
compose.yaml   Postgres 18 + PostGIS 3.6 for local dev           :5432
```

## Setup

Needs Node 22+, pnpm, and Docker.

```bash
pnpm install                                  # also generates the Prisma client
cp apps/api/.env.example apps/api/.env
docker compose up -d --wait                   # start Postgres
pnpm --filter @footprint/api db:migrate        # apply migrations
pnpm dev                                      # both apps, in parallel
```

Open http://localhost:3000. Next rewrites `/api/*` to Nest, so the browser never needs CORS. Swagger UI is at http://localhost:3000/api/docs.

Other commands: `pnpm build`, `pnpm lint`.

## API layout

Follows the Nest docs: one folder per feature module directly under `src/`, with `dto/` and `interfaces/` inside when the module has them.

```
apps/api/src
  main.ts, app.module.ts
  config/      env schema, repo data/ paths
  common/      cross-cutting Nest pieces (filters/, pipes/, later guards/, interceptors/, decorators/)
  prisma/      PrismaModule (global) + PrismaService
  geo/         plain GeoJSON helpers shared by modules, no Nest
  health/      GET /api/health
  catalog/     Scene storage (CatalogRepository), startup load, GET /api/scenes/:id
  stac/        STAC API (/api/stac/*) on top of CatalogRepository
               dto/ holds the zod search schemas + inferred type, checked by common/pipes/ZodValidationPipe
               (Nest pipes docs). Not @Body({ schema }): Swagger would regenerate the hand-written search docs
  generated/   Prisma client (gitignored)
```

## Database

The schema lives in `apps/api/prisma/schema.prisma`. After changing it:

```bash
pnpm --filter @footprint/api db:migrate --name <change>
```

This creates a migration in `apps/api/prisma/migrations` (commit it), applies it, and regenerates the client in `apps/api/src/generated` (gitignored). Use `PrismaService` in any Nest provider. In production, apply migrations with `pnpm --filter @footprint/api exec prisma migrate deploy`.

`docker compose down` stops Postgres; add `-v` to also delete its data.

## Web stack

| Need               | Library                                               |
| ------------------ | ----------------------------------------------------- |
| Server state       | `@tanstack/react-query` + `@suspensive/react-query-5` |
| API client         | `openapi-fetch` with types from `openapi-typescript`  |
| Forms              | `react-hook-form` + `@hookform/resolvers` + `zod`     |
| UI                 | shadcn/ui (Radix), `lucide-react`, `cn`               |
| Toasts / theme     | `sonner`, `next-themes`                               |
| Client / URL state | `zustand`, `nuqs`                                     |
| Utils              | `es-toolkit`                                          |
| Format             | Prettier + Tailwind plugin                            |

## Web layout

Next.js leaves project organization open. This app follows [bulletproof-react](https://github.com/alan2207/bulletproof-react): `app/` holds routes only, each feature owns its code under `features/<name>/`, and anything shared across features lives in a flat top-level folder. No barrel `index.ts` files; import the file directly.

```
apps/web/src
  app/                routes, layouts, providers, error/not-found. No business logic.
    (portal)/         route group for the main shell, not in the URL
  features/
    explore/          scene search screen
      api/            react-query hooks per endpoint (get-collections, search-scenes)
      components/     explore, scene list/map/card, filter panel
      hooks/          URL state (nuqs)
      stores/         zustand client state (selection)
      types/          zod schemas + inferred types
      utils/          pure logic: search body, URL parsers, format, server-side AOI loader
      constants.ts
  components/
    ui/               shadcn primitives (added with `shadcn add`)
    layout/           app shell (site header)
  hooks/              shared hooks (use-maplibre, use-media-query)
  lib/                preconfigured libraries (openapi-fetch client, maplibre controls)
  types/              shared types (generated OpenAPI schema)
  utils/              framework-free helpers (date, geo)
```

Dependencies flow one way: shared folders → `features` → `app`. ESLint (`import/no-restricted-paths` in `eslint.config.mjs`) fails the build if a shared folder imports from `features` or `app`, or a feature imports from `app`. Features must not import from each other; promote to a shared folder instead.

## API types

Nest serves its OpenAPI spec at `/api/docs-json`, built from `*.dto.ts` classes and explicit controller return types (swagger CLI plugin). After changing an endpoint, with `pnpm dev` running:

```bash
pnpm --filter @footprint/web gen:api
```

This regenerates `apps/web/src/types/api.d.ts`. Commit it. If it fails with `ECONNREFUSED`, the API is not running.

## Env

Each app validates its env with zod at startup and refuses to start on a missing or invalid value. The API reads `apps/api/.env` (see `.env.example`); real environment variables win over the file.

| Var               | App | Default                 | Notes                                                                                          |
| ----------------- | --- | ----------------------- | ---------------------------------------------------------------------------------------------- |
| `DATABASE_URL`    | api | required                | Postgres URL; `.env.example` matches `compose.yaml`                                            |
| `PORT`            | api | `3001`                  | API only: `next dev` is pinned to 3000. If you change it, set the web app's `API_URL` to match |
| `NODE_ENV`        | api | `development`           | `development`, `production` or `test`                                                          |
| `STAC_PUBLIC_URL` | api | `http://localhost:3001` | Absolute base for STAC response links (the API's own address, not the web proxy)               |
| `API_URL`         | web | `http://localhost:3001` | Read by `next.config.ts`, so set it at build                                                   |
