# Repository Guidelines

## Project Structure & Module Organization

This repository contains the Afloat v1 specification under `docs/v1/` and an active Next.js implementation under `src/`. The numbered files describe product rules, calendar protocol, fact-layer computation, thread commitments, sync behavior, UI boundaries, MVP scope, progressive adoption, and technical architecture. Keep new product decisions in the relevant numbered document and update `docs/v1/README.md` when adding or renaming docs.

The planned application structure is:

```text
src/app/          Next.js pages, layouts, and API routes
src/server/db/   Drizzle schema, migrations, and queries
src/server/calendar/ CalDAV provider adapter
src/server/domain/   pure parsing, overlay, stats, and thread logic
src/server/views/    computed view generation
src/components/      reusable UI components
```

## Build, Test, and Development Commands

Use the existing package scripts for local validation:

```bash
pnpm install
pnpm dev
pnpm test
pnpm lint
pnpm build
pnpm db:generate
pnpm db:migrate
pnpm dev:caldav:reset
pnpm dev:caldav:seed
pnpm dev:caldav:sync
```

If local Postgres is introduced, use `docker compose up postgres` as described in `docs/v1/10-technical-architecture.md`.

### Development server port handling

When port `3000` is occupied, do not immediately switch ports or terminate the existing process. First identify the listener with `ss -ltnp | rg ':3000'` or an equivalent command, inspect its command and working directory with `ps` and `/proc/<pid>/cwd`, and verify whether it is this repository's Next.js development server.

- If it is this repository's `next dev` server, reuse `http://localhost:3000` and do not start another server.
- If it is another service, leave it running and start Afloat on an unused port, then report the actual URL.
- Never kill an existing process without explicit authorization.

## Coding Style & Naming Conventions

Use TypeScript for implementation code. Keep business rules in `src/server/domain` as pure functions where possible; route handlers should stay thin and call server-layer services. Use `camelCase` for variables/functions, `PascalCase` for React components and types, and kebab-case for route segments. Prefer small, explicit modules over broad utility files.

Markdown docs should use clear headings, short paragraphs, and existing Chinese terminology consistently: `计划层`, `偏移层`, `事实层`, `派生视图`, and `线程承诺`.

## UI & Design Boundaries

When creating or modifying frontend components, pages, or layouts, strictly adhere to the UI rules defined in `docs/v1/11-design-system.md`.
- Ensure the application of the Data Ledger / Brutalist aesthetic using Tailwind CSS.
- Strictly use native `<details>`/`<summary>` elements for collapsable layouts.
- Avoid introducing JavaScript-heavy interactivity for simple UI states.
- Maintain the strict routing philosophy: `/` is the static landing page, while `/dashboard` handles the authenticated or guest state logic.

## Testing Guidelines

Domain rules require focused unit tests: title parsing, same-layer overlap detection, drift overlay, statistics, thread lifecycle, and feasibility calculations. Name tests after behavior, for example `title-parser.test.ts` or `thread-commitments.test.ts`. Add regression tests whenever changing protocol semantics.

## Commit & Pull Request Guidelines

This repo has no Git history yet, so use concise Conventional Commit-style messages such as `docs: add progressive adoption rules` or `feat: implement CalDAV event sync`. Pull requests should include a summary, affected docs or modules, test results, and screenshots for UI changes.

## Security & Configuration Tips

Never commit `.env`, `.env.local`, CalDAV credentials, database URLs, or encryption keys. Browsers must not connect directly to Postgres; all database, credential, and raw calendar access belongs on the server side.
