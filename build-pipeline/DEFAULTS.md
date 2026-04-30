# DEFAULTS.md — Decision defaults the runner applies without asking

This file is referenced by every spawned agent. Every decision the runner could plausibly hit during V5–V10 has a default answer. The rule: **resolve via this document; if absent, choose the safer option, log the decision in `STATE.yaml decisions[]`, continue.**

The user is not watching. Asking is not allowed. Stopping is not allowed except for the hard blockers listed in `RUNNER.md`.

---

## Library and dependency defaults

- **Need a UI primitive (dialog, dropdown, popover, etc.)?** Use the equivalent in `src/components/ui/` (shadcn) or `src/components/ui-v2/` (after V6). Do NOT introduce a new component library.
- **Need a state management primitive?** Use Zustand if cross-component, `useState` if local. Do NOT introduce Redux, Jotai, Recoil, etc.
- **Need a forms library?** `react-hook-form` + `zod` is already in `package.json`. Use these.
- **Need a date library?** `date-fns` is preferred. If not installed, install it. Do NOT introduce Moment, Day.js, or Luxon.
- **Need an HTTP client?** Use `fetch` (built-in). Do NOT introduce axios.
- **Need a queue?** BullMQ is in `package.json`. Use it.
- **Need an email lib?** `react-email` for templates + `Resend` for delivery. Do NOT introduce nodemailer.
- **Need an animation lib?** Framer Motion (install if absent).
- **Need a charting lib?** Recharts is in `package.json`. Use it.
- **Need a testing primitive?** Playwright for E2E (configured), `vitest` for unit (install if absent). Do NOT introduce Jest.
- **Greenfield library choice (not covered above):** pick the option with (a) most-recent commit < 30 days, (b) most GitHub stars among maintained options, (c) zero or minimal native deps, (d) MIT/Apache license. Log the decision.

## Color, design, and visual defaults

- **Color choice ambiguous?** Use existing tokens in `src/styles/tokens.css` (after V6) or `src/app/globals.css` (current). Never hardcode hex values in component files.
- **Reference for premium feel?** `docs/COMPETITIVE_RESEARCH.md` has Toast and R Power hex codes and layout specs. `docs/GEMINI_VIDEO_ANALYSIS.md` has additional reference.
- **Sidebar styling?** Light (Apple iPadOS #F2F2F7), per memory feedback. Do not regress to dark sidebar.
- **POS primary color?** `#007AFF` (already deployed per memory).
- **Empty state pattern?** Custom illustration + clear message + primary CTA. Use the `EmptyState` component once V6 ships.
- **Loading state pattern?** Skeleton matching final shape, never spinner.

## Schema migration defaults

- **Direction:** always additive. Add columns with `DEFAULT` values that match existing rows' implicit semantics.
- **Drops:** never drop a column without an explicit task in the version spec marked `safe_drop: true`.
- **Renames:** never rename a column. Add new column, copy data, deprecate old. Old column dropped only via explicit safe_drop task.
- **Indexes:** add freely; CI does not block index migrations.
- **Constraint changes:** never tighten a constraint without verifying every existing row passes it. Add a check constraint with `NOT VALID` first, validate, then enable.
- **Migration filename format:** `{YYYYMMDDHHMMSS}_{slug}.sql` lowercase with underscores. Each migration must be paired with a `.rollback.sql` file (the one-way rule from V5 onward).
- **Always run `npm run db:diff` after applying** to verify staging matches expected schema.

## API design defaults

- **Routing:** mirror `src/app/api/` patterns. REST conventions: `GET /resource`, `POST /resource`, `GET/PATCH/DELETE /resource/[id]`, `POST /resource/[id]/[action]` for verbs.
- **Auth:** every route imports `getAuthUser` from `src/lib/api/auth.ts` and returns 401 if missing. Privileged actions also call `requireRole(user, [...])`.
- **Tenant scoping:** every query filters by `org_id = user.org_id`. RLS plus explicit filter is belt-and-suspenders.
- **Validation:** every request body validated with `zod`. Return 400 with field-level errors on failure.
- **Response shape:** `{ data, error?, meta? }`. Never bare arrays at the top level.
- **Error codes:** machine-readable `code` (string), human `message` (sentence), optional `action` (what user can do).
- **Idempotency:** mutating endpoints accept optional `Idempotency-Key` header.
- **Pagination:** cursor-based for large lists, page-based for small admin lists. Default limit 25.

## File location defaults

- Source code: `src/`.
- Tests: `tests/` for unit, `e2e/` for Playwright.
- Documentation: `docs/`.
- Configuration: `config/` if not project-root-required.
- Utility scripts: `scripts/`.
- Examples: `examples/`.
- **NEVER** save to project root. Per `CLAUDE.md`.
- **NEVER** save working/scratch/test files to repo. Use `/tmp/`.

## Naming defaults

- **Entities:** singular for type, plural for table (`User` type, `users` table).
- **IDs:** `{entity}_id` (e.g., `org_id`, `user_id`). Never `organization_id`.
- **Columns:** `snake_case`. TypeScript types: `camelCase`. Boundary conversion in API handlers.
- **Routes:** `/api/{resource-plural-kebab}/{id}/{action-kebab}`.
- **Components:** `PascalCase.tsx` files; default export the component.
- **Utility files:** `kebab-case.ts`.
- **Branches (worktrees):** `v{N}-batch-{B}-{slug}` lowercase.

## Hardware and credential defaults

- **Hardware unavailable** (printer/reader/drawer not on desk): **defer the task**, mark `needs_hardware: <name>`, continue with software-only tasks in the same batch. After 3 consecutive defer cycles across multiple batches with no resolution → BLOCKERS.md.
- **Credential missing** (env var unset): defer, mark `needs_credential: <ENV_VAR>`, continue. Same 3-cycle rule.
- **Sandbox vs production:** always use sandbox for V5–V9 unless task explicitly says production. V10 launch (10.99) flips to production keys.
- **API quota exceeded:** wait 60s, retry; if still failing, defer with `needs_quota_reset`, continue.

## Test failure defaults

- **Flaky test:** retry once. If passes, mark stable. If fails again, add `test.fixme()` with link to follow-up issue, continue. Log in `decisions[]`.
- **New test failure:** 3 fix attempts. After attempt 3 fails: log to `BLOCKERS.md` and stop.
- **Snapshot/visual regression diff:** if change is intentional (new design), update the baseline. If unclear, defer with `needs_visual_review`.
- **Type error:** fix it. Type errors are never deferred or `// @ts-ignore`'d (per Rule 18 spirit).

## Build failure defaults

- **First failure:** read full output, fix, retry.
- **Second failure:** revert latest change in worktree, restart task with cleaner approach.
- **Third failure:** log to BLOCKERS.md and stop.
- **Out-of-memory build:** add `NODE_OPTIONS=--max-old-space-size=8192` to next-build env. Continue.

## Deploy failure defaults

- **SSH timeout:** retry once.
- **Build on VM fails:** check disk space (`df -h`), clear `/opt/sear/app/.next` cache, retry.
- **PM2 reload fails:** `pm2 logs sear-pos --lines 50`, attempt full `pm2 restart sear-pos`.
- **Smoke test 5xx:** check Sentry first; if unhandled error, treat as test failure (3 attempts to fix forward, otherwise revert and BLOCKERS).
- **Smoke test 200 but visibly broken:** rare; log to `decisions[]` and continue. The next batch's tests should catch it.
- **Three consecutive deploy failures:** BLOCKERS.md.

## Network / external dependency defaults

- **OpenAI/Anthropic API down:** retry with exponential backoff up to 5 minutes. Then defer with `needs_external_recovery`.
- **Supabase down:** wait 60s and retry. If sustained > 5 min, defer.
- **GitHub down:** retry. If sustained, log decision to do work locally, push later.
- **Resend/SendGrid down:** retry. Email tasks defer; non-email tasks continue.

## Cost defaults

- **Anthropic API budget per session:** soft cap at $20 (gateway warns), hard cap at $50 (gateway throws). Log to `decisions[]` if approaching cap.
- **OpenAI budget:** $10 soft / $25 hard.
- **AI feature pricing target:** keep per-tenant monthly AI cost < $20 for the pro tier ($199/mo) to maintain ≥90% gross margin.

## Worktree merge conflict defaults

- **Two agents touched the same line:** prefer the change that is purely additive (new function/component). If both are additive, both can coexist — merge both. If one mutates and one adds, prefer the addition; the mutation goes through a follow-up task.
- **One worktree merged successfully, another now conflicts:** rebase the conflicting branch on top of main; auto-resolve with `theirs` strategy for content that was already merged; manual resolve for genuinely conflicting business logic.
- **Conflict that requires business judgment:** log to `decisions[]` and pick the version that adds more capability without breaking existing tests.

## Documentation defaults

- **No documentation files unless asked.** Per `CLAUDE.md` rule. The plan and version specs ARE the documentation; do not create `README.md`, `ARCHITECTURE.md`, etc. unless a task explicitly says so.
- **Comments:** none unless explaining a non-obvious WHY. Per system instructions.
- **JSDoc:** only on public APIs that other modules import. Never on private internals.

## Test coverage defaults

- **New API route:** at least 1 happy-path test, 1 auth-failure test, 1 validation-error test.
- **New page:** at least 1 Playwright test that loads and verifies key elements.
- **New workflow:** 1 full Playwright workflow test (UI → DB → UI feedback).
- **Refactor:** existing tests must still pass; no need to add new ones unless behavior changed.

## When DEFAULTS.md genuinely doesn't cover a case

1. Choose the option with smaller blast radius (more reversible).
2. Choose the option that is more consistent with existing code patterns.
3. Choose the option that requires fewer new dependencies.
4. Log the decision in `STATE.yaml decisions[]` with: timestamp, task ID, what was decided, why, alternatives considered.
5. Continue.

The runner does not stop because something is ambiguous. It stops only for the hard blockers in `RUNNER.md`.
