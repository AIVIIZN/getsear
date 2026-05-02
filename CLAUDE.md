# Sear POS — Project Instructions

## Project

Sear POS — a restaurant POS built on Next.js 16 (App Router + TypeScript + Tailwind v4 + shadcn/ui), Supabase (Postgres + Auth + Realtime + Storage), deployed at https://getsear.com via PM2 on a GCP VM (34.132.111.219). Production state and module depth: see `docs/MODULE_DEPTH_AUDIT.md` (2026-04-30 audit, 19 of 21 modules workflow-complete). Multi-version V5–V10 roadmap and autonomous build runner: see `build-pipeline/`.

## Behavioral rules (always)

- Do what has been asked; nothing more, nothing less.
- NEVER create files unless absolutely necessary.
- ALWAYS prefer editing an existing file to creating a new one.
- NEVER proactively create documentation (`*.md`, README) unless explicitly requested.
- ALWAYS read a file before editing it.
- NEVER commit secrets, credentials, or `.env*` files.
- NEVER save scratch/working files to the project root.

## File organization

- `src/` — application source (Next.js app, components, lib, stores, hooks, types, workers).
- `tests/` — unit tests.
- `e2e/` — Playwright tests.
- `docs/` — checked-in documentation.
- `scripts/` — utility scripts.
- `supabase/migrations/` — schema migrations (one-way; pair drops with rollback files).
- `build-pipeline/` — autonomous build runner state, specs, prompts (do not modify during a run).

## Architecture

- Domain-Driven Design with bounded contexts; keep files under 500 lines.
- Typed interfaces for every public API.
- Validate input at system boundaries with Zod.
- Realtime via Supabase channels for cross-terminal sync.
- Tenant scoping: every query filters by `org_id`; RLS is the second line of defense.

## Build & test

```bash
npm run build
npm run lint
npm test
npm run test:e2e
```

- ALWAYS run tests after code changes.
- Build must pass before commit.

## Security

- NEVER hardcode API keys, secrets, or credentials.
- Sanitize file paths to prevent traversal.
- Validate user input at boundaries.
- All mutating endpoints require auth; privileged actions (void, comp, manager override) additionally require manager-PIN with audit log entry.

## Memory & persistence

Memory across sessions is handled by the `mem0` MCP server (`mcp__mem0__*` tools), an Obsidian vault at `~/Desktop/ObsidianVault`, and the auto-loaded `MEMORY.md` index at `~/.claude/projects/-Users-ianrakow-Desktop-getsear/memory/`. Use these for durable knowledge — preferences, project state, decisions worth recalling. Do not invent CLI memory tools.

## Concurrency

- One message = all related operations. Independent tool calls run in parallel.
- Prefer the dedicated tool (`Read`, `Edit`, `Write`) over `Bash` when one fits.
- For multi-file work or wide searches, spawn parallel subagents via the `Agent` tool.

## Reference docs

- `docs/MODULE_DEPTH_AUDIT.md` — canonical state of the 21 modules.
- `docs/COMPETITIVE_RESEARCH.md` — Toast / R Power competitive analysis with hex codes.
- `SEAR_POS_ARCHITECTURE.md` — full product spec (heavy; extract sections rather than reading whole).
- `build-pipeline/RUNNER.md` — operating manual for the V5–V10 autonomous runner.
- `build-pipeline/STATE.yaml` — live build state.

## Deploy

```bash
ssh -i ~/.ssh/google_compute_engine ianrakow@34.132.111.219
cd /opt/sear/app && git pull origin main && npm ci && npm run build && \
  cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/ && \
  pm2 reload sear-pos
```

Or use the autonomous runner's `build-pipeline/DEPLOY.sh` which wraps this and smoke-tests.
