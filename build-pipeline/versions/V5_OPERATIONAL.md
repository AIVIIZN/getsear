# V5 — Operational Depth (Friday Night Survival)

## Theme
Close the loop on operational realism. A POS that compiles is not a POS that opens. By the end of V5, Sear runs a real shift on real iPads with real card readers, real printers, and real-world failure modes (wifi drops, two terminals editing the same check, a comp issued after payment).

## Exit criteria
- ✅ One full shift trace recorded: 9am cold start → 8 hours → close-out → daily Z report. No engineer intervention.
- ✅ Marketing audit ⚠️ closed (Send button is honest — either broadcasts for real or doesn't exist).
- ✅ Drive-Thru audit ⚠️ closed (orphaned stores deleted).
- ✅ Schema-in-VC baseline committed; future schema changes go through migrations only.
- ✅ Hardware integration (Star printer + Valor card reader + Bematech cash drawer) verified on real iPad.
- ✅ Offline mode: kill wifi for 5 minutes mid-service, orders queue, sync resumes, no data loss.
- ✅ Multi-terminal: terminal A and terminal B edit the same check simultaneously → one wins, other shows "someone updated this — refresh" with diff.
- ✅ ≥10 new Playwright workflow tests covering full shifts.

## Batch 5.0 — Pre-flight (sequential, ~2 hours)

### 5.0.1 — Snapshot Supabase schema
**Files:** `supabase/migrations/00000000_baseline.sql`
**Acceptance:** File checked in; `supabase db reset` reproduces production schema exactly.
**How:** `supabase db dump --schema public > supabase/migrations/00000000_baseline.sql`. Verify with diff.

### 5.0.2 — Add db:diff CI check
**Files:** `package.json`, `scripts/db-diff.mjs` (new), `.github/workflows/db-diff.yml`
**Acceptance:** CI fails the build if Supabase staging schema drifts from migrations.
**How:** Use `supabase db diff` against staging; non-zero diff fails CI.

### 5.0.3 — Worktree directory
**Files:** `.claude/worktrees/.gitkeep`
**Acceptance:** Directory exists; `.claude/worktrees/` excluded from main worktree's tracked files via `.gitignore`.

### 5.0.4 — Hardware/credential confirmation (manual)
**Acceptance:** Mark deferred if any unavailable. Software work continues regardless.

## Batch 5.1 — Foundation cleanup (parallel, ~3 hours)

### 5.1.1 — Delete 4 orphaned stores
**Files:** `src/stores/drive-thru-store.ts`, `src/stores/inventory-store.ts`, `src/stores/scheduling-store.ts`, `src/stores/delivery-store.ts`, `src/stores/index.ts` (remove exports)
**Acceptance:** Files deleted; `npm run build` passes; grep confirms no imports of deleted stores anywhere in `src/`.

### 5.1.2 — Marketing send: real recipient population
**Files:** `src/app/api/marketing/campaigns/[id]/send/route.ts`, `src/lib/marketing/recipients.ts` (new), `src/workers/campaign-email-worker.ts` (new), migration `add_campaign_recipients_indexes.sql`
**Acceptance:** POST to send endpoint:
- Queries the campaign's segment and produces a list of recipient customers.
- Inserts one `campaign_recipients` row per customer with `status='queued'`.
- Enqueues one BullMQ job per recipient on the `send-campaign-email` queue.
- Updates `campaigns.status` to `sending` and `recipients_count` to the actual count.
**Test:** Create draft campaign with simple segment, send, verify row count in `campaign_recipients` matches expected, verify queue jobs created.

### 5.1.3 — Marketing dispatch worker
**Files:** `src/workers/campaign-email-worker.ts`, `src/lib/marketing/email-template.tsx` (react-email)
**Acceptance:** Worker pulls jobs, sends emails via Resend, updates `campaign_recipients.status` to `sent` or `bounced` based on Resend response, records `sent_at` timestamp.
**Needs credential:** `RESEND_API_KEY`. If missing, defer.

### 5.1.4 — Marketing tracking
**Files:** `src/app/api/marketing/track/open/route.ts`, `src/app/api/marketing/track/click/route.ts`, `src/lib/marketing/analytics.ts`
**Acceptance:** 1×1 GIF endpoint at `/track/open?r={recipient_id}` updates `campaign_recipients.opened_at`. Click redirect at `/track/click?r={recipient_id}&u={url}` updates `clicked_at` then 302s. Analytics tab queries roll up real numbers from these columns.

### 5.1.5 — KDS ADD-order detection
**Files:** `src/app/api/kds/tickets/route.ts` (resolve TODO at line 427), `src/lib/kds/diff.ts` (new)
**Acceptance:** When items added to an already-sent order via the existing add-items API, the KDS ticket flags `is_add: true` for those items. KDS UI shows "ADD" badge on additional items.

## Batch 5.2 — Hardware integration (parallel, ~6 hours)

### 5.2.1 — Star TSP650II printer
**Files:** `src/lib/printing/star-driver.ts`, `src/app/api/printing/test/route.ts`, `src/components/printing/PrinterSetupWizard.tsx`
**Acceptance:** Receipt prints from POS on real Star printer via Bonjour discovery. "Test print" button in Settings → Printers works. Cash drawer kick line (5.2.3) callable through this driver.
**Needs hardware:** Star TSP650II. If absent, defer.

### 5.2.2 — Valor card reader production SDK
**Files:** `src/lib/payments/valor-client.ts` (replace mock), `src/app/api/payments/preauth/route.ts`, `.env.example` (add VALOR_API_KEY, VALOR_MERCHANT_ID)
**Acceptance:** Real card swipe → preauth → tip adjust → capture round-trip on Valor sandbox. Decline path tested. Receipt printer prints card receipt with brand + last4 + auth code.
**Needs credential + hardware.** Defer if either missing.

### 5.2.3 — Bematech cash drawer
**Files:** `src/lib/printing/cash-drawer.ts`, `src/app/api/cash-management/drawer-open/route.ts`
**Acceptance:** Drawer pops open when cash payment completes via printer kick line. Manager-PIN-protected manual open works.

## Batch 5.3 — Offline mode (parallel, ~5 hours)

### 5.3.1 — IndexedDB-backed offline queue
**Files:** `src/lib/offline/queue.ts`, `src/stores/offline-store.ts` (resurrected real one), `public/sw.js` (service worker)
**Acceptance:** Mutations buffered to IndexedDB when offline. On reconnect, replay queue with idempotency keys; no duplicate writes. Tested by disconnecting wifi, taking 5 orders + 2 payments, reconnecting, verifying all sync without dupes.

### 5.3.2 — Offline UI
**Files:** `src/components/offline/OfflineBanner.tsx`, `src/components/offline/PendingMutationsBadge.tsx`, integrated into POS layout
**Acceptance:** Top banner appears when offline. Counter badge shows pending mutation count. Tapping opens drawer listing each pending mutation with retry/abandon controls.

## Batch 5.4 — Concurrency & state machine (parallel, ~6 hours)

### 5.4.1 — Optimistic locking
**Files:** Multiple `src/app/api/orders/**/route.ts`, `src/lib/orders/concurrency.ts` (new), migration `add_order_version_columns.sql`
**Acceptance:** Stale write returns 409 with current state. UI receives 409, shows "Someone updated this — refresh" modal with diff. After refresh, user can re-apply their change. Tested with 2 concurrent terminals editing same order.

### 5.4.2 — Order state machine
**Files:** `src/lib/orders/state-machine.ts` (XState), `src/app/api/orders/[id]/comp/route.ts`, `src/app/api/payments/refund/route.ts` (extend), `src/app/api/orders/[id]/void/route.ts`
**Acceptance:** State machine declares all order states + transitions. Edge cases pass tests:
- Comp issued after order is closed and paid → re-opens to allow comp, audit trail recorded.
- Refund of tip portion only → tip line + payment line both adjusted correctly.
- Partial refund (3 of 5 items) → remaining items still owed.
- Void after close requires manager-PIN.

### 5.4.3 — Audit log expansion
**Files:** `src/lib/audit/log.ts` (extend), all relevant routes hook in, `src/app/(backoffice)/audit-log/page.tsx` (new)
**Acceptance:** Every privileged action (void, comp, discount, cash drop, manager override) writes an audit row with `user_id`, `manager_pin_user_id`, `before_state`, `after_state`, `reason`. Audit page shows filterable history with export to CSV.

## Batch 5.5 — Workflow test suite (parallel, ~4 hours)

### 5.5.1 — Full-shift workflow test
**Files:** `e2e/workflows/full-shift.spec.ts`
**Acceptance:** Single Playwright test runs in <5 minutes; opens day → 12 orders → varied payments (cash, card, gift card, split) → close shift → verifies daily Z report; uses fresh seed.

### 5.5.2 — 9 scenario tests
**Files:** `e2e/workflows/comp-after-pay.spec.ts`, `split-check-4-ways.spec.ts`, `gift-card-balance.spec.ts`, `drive-thru-lane.spec.ts`, `online-order-pickup.spec.ts`, `catering-deposit.spec.ts`, `marketing-send.spec.ts`, `kds-recall-refire.spec.ts`, `manager-pin-void.spec.ts`
**Acceptance:** All 9 green. Each tests one cross-module workflow end-to-end.

## Batch 5.6 — Demo + ship (sequential, ~2 hours)

### 5.6.1
- Run all exit criteria checks.
- Record full-shift demo (or note skip).
- Update `docs/MODULE_DEPTH_AUDIT.md` with V5 deltas (Marketing now ✅, schema in VC).
- Tag release `v5.0.0`.
- Write retro to `build-pipeline/logs/retros/V5.md`.
- Advance state to V6.

## Bonus batches

### Bonus Batch 5.7 — Recipe-based auto-deduction (parallel, ~5h)

#### 5.7.1 — Recipe→ingredient mapping
**Files:** migration `add_recipe_ingredients.sql`, `src/app/(backoffice)/menu/items/[id]/recipe/page.tsx`
**Acceptance:** Each menu item maps to N inventory ingredients with quantity + unit. UI lets owner edit recipes.

#### 5.7.2 — Order completion deduction hook
**Files:** `src/lib/inventory/auto-deduct.ts`, `src/app/api/orders/[id]/close/route.ts`
**Acceptance:** Closing an order deducts ingredient quantities from `inventory_items.current_stock` per recipe.

#### 5.7.3 — Variance dashboard
**Files:** `src/app/(backoffice)/inventory/variance/page.tsx`
**Acceptance:** Daily/weekly variance shows theoretical vs actual stock difference; flags top variance items.

### Bonus Batch 5.8 — Cash variance + chain-of-custody (parallel, ~3h)

#### 5.8.1 — Drawer count screens
**Files:** `src/app/(pos)/cash-management/page.tsx`, `src/app/api/cash-management/count/route.ts`
**Acceptance:** Open + close drawer screens require manager PIN; variance computed and stored.

#### 5.8.2 — Cash drop / pickup flow
**Files:** `src/app/(pos)/cash-management/drop/page.tsx`
**Acceptance:** Two-employee attestation; both sign; logged to audit_log.

#### 5.8.3 — Cash variance report
**Files:** `src/app/(backoffice)/reports/cash-variance/page.tsx`
**Acceptance:** Filter by employee/shift; spots repeat short-counters via running average per user.
