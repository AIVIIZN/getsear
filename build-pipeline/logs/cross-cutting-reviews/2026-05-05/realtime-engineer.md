# Realtime / Concurrency / Offline Audit — 2026-05-05

Audit scope: 8 ref-init realtime hooks + IndexedDB offline queue + cross-terminal optimistic locking + sync queue + KDS animation interaction.
Branch: `main` @ `77aa1e1`. **Read-only — no source modified.**

## Summary

| Severity | Count | One-liner |
|---|---|---|
| **P0** | 0 | No "kitchen lost the order" / double-payment class bugs found. |
| **P1** | 2 | (1) `useRealtimeKds` watches `kds_ticket_events`, an INSERT-only journal — UPDATE/DELETE branches are dead code, and re-fetch coverage is in `KdsPageContent` not the hook. (2) `KdsPageContent` re-runs `fetchTickets()` on **every** order UPDATE for the location — fan-out scales O(orders·terminals). |
| **P2** | 3 | Bare `} catch {}` in `use-realtime-86.ts:86`, `sync-queue.ts:316`, `sync-queue.ts:186`, `health-check.ts` ×3, `reconnection-manager.ts:191`, `KdsPageContent.tsx:300` — none in a payment/order write path; lint-warn only, V5.3 P0 pattern still present in non-critical paths. (3) `useKdsHeartbeat` swallows fetch errors with `console.warn` only (line 72). |
| **P3** | 4 | Refs assigned during render across all 8 hooks (the documented bucketBLintDebt — confirmed scope). No reconnect handler — relies on Supabase JS auto-reconnect. No subscribe-state observer (`SUBSCRIBED` / `CHANNEL_ERROR`). `useTableRealtime` channel name `tables-rt:${locationId}` differs from `useRealtimeTables` `tables:${floorPlanId}` — naming inconsistency invites a bug if both ever subscribed in the same view. |

**Overall verdict:** safe for production. The lint debt is real but the runtime semantics are correct (refs are read-only inside the effect closure; the assign-during-render is a React 19 *correctness warning*, not a stale-callback bug — the assign happens on every render so the closure always sees the latest callback at fire time).

The 5.99.x concurrency story holds up. Every primary-key route I opened threads `expectedVersion` and gates the UPDATE on `.eq('version', ...)`. `recalculateOrderTotals` throws `StaleVersionError` and every caller catches and converts to a 409 via `checkUpdateAffectedRow`. The `comp` route's `nextExpectedVersion` bookkeeping (re-reads after recalc) is correct. `payments/void` no longer accepts the side-door DELETE (route 240–242 of `orders/[id]/route.ts` confirms removal). `idempotency_records` RLS denies INSERT/UPDATE/DELETE for non-service-role (migration `20260504110100`).

## Findings (file:line + recommended fix)

### P1

**P1-1 — `useRealtimeKds` filter is on `kds_ticket_events`, an append-only event log.**
`src/hooks/use-realtime.ts:122-155`. The hook handles `INSERT|UPDATE|DELETE`, but `kds_ticket_events` is a journal — bumps, voids, and refires are INSERTs of new event rows, never UPDATEs. The `UPDATE` and `DELETE` branches in `KdsPageContent.tsx:190-195` (`handleKdsEvent`) are dead — and worse, the hook does **not** subscribe to `orders` changes for the active station. Coverage exists only because `KdsPageContent` *also* subscribes to `orders` via `useRealtimeTable('orders', location_id=eq.${locationId}, ...)` at line 214 — but that is a location-wide order watcher, not a station-wide ticket watcher. If `KdsPageContent` is ever consumed without that second subscription, KDS will miss bumps. Fix: either rename the hook to `useRealtimeKdsEvents` and document INSERT-only, or extend it to watch the join (orders + items) and replace the location-wide watcher.

**P1-2 — `KdsPageContent` realtime fan-out is O(orders × terminals).**
`src/app/(fullscreen)/kds/KdsPageContent.tsx:200-219`. Both `handleOrderInsert` and `handleOrderUpdate` call the same `fetchTickets()` — every order write at the location triggers a full ticket re-fetch on every KDS terminal. With 6 terminals and a busy Friday this is ~1 round-trip per terminal per item-add. Fix: switch to incremental store reducers driven by the payload (the `KdsTicketEvent` join already exists), keep `fetchTickets` as the cold-start + recovery path only.

### P2

**P2-1 — Bare `} catch {}` blocks (V5.3 P0 pattern).**
The handoff is right that 8 hooks are flagged for lint debt; only one of them has a *bare* catch:
- `src/hooks/use-realtime-86.ts:86` — silent AudioContext failure (low risk; acceptable).
- `src/hooks/use-kds-heartbeat.ts:72` — heartbeat fetch silently warned, not surfaced. If every heartbeat is failing the user has no signal beyond "station went offline" which arrives 30s later via the server.
- `src/hooks/use-sync-queue.ts:55` — IndexedDB unavailable in SSR; benign.
- `src/lib/offline/sync-queue.ts:186` and `:316` — synced-entry delete + BroadcastChannel post; benign.
- `src/lib/offline/health-check.ts:32, 61, 96` — health probes; should at least emit telemetry on failure.
- `src/lib/offline/reconnection-manager.ts:191` — silent. This one I'd actually re-check in V7.5.3; reconnection is exactly where the V5.3 P0 hid.
- `src/app/(fullscreen)/kds/KdsPageContent.tsx:300` — message-fetch failure; non-critical per its own comment.

Fix: per the team rule, every `} catch {}` should become `} catch (err) { console.error('[ctx]', err) }` even if otherwise no-op'd.

**P2-2 — `useKdsHeartbeat` cannot recover from a broken `getMetrics`.**
`src/hooks/use-kds-heartbeat.ts:47-76`. If `getMetricsRef.current()` throws (e.g. because the KDS Zustand store mutated mid-read), the catch fires `console.warn` and returns. The next 30s tick will retry — fine. But the route's `was_offline` recovery callback never fires because `res.ok` was never checked. Add a `console.error` and consider exponential backoff to avoid wasting bandwidth when the server is 5xx-ing.

**P2-3 — `usePrinterFailover` 10-second polling on top of internal manager polling.**
`src/hooks/use-printer-failover.ts:114-119`. The `PrinterFailoverManager` already drives state via callbacks (`onStationOffline`, `onStationOnline`); the additional `setInterval` redundantly pulls the same state. Not a bug, but a wasted timer that ticks forever once per terminal.

### P3 (lint debt — V7.5.3 scope, confirmed correct)

**P3-1 — Refs assigned during render in all 8 hooks.**
Confirmed in `eslint.config.mjs:34-43` (the `bucketBLintDebt` block) and matches the audit:
- `use-realtime.ts` (4 refs across 4 hooks: lines 37-39, 89, 127, 165, 202)
- `use-table-realtime.ts:46-52`
- `use-reservation-realtime.ts:41, 84`
- `use-realtime-86.ts:68-69`
- `use-kds-realtime.ts:52-53, 90-92, 133-134`
- `use-kds-heartbeat.ts:43-45`
- `use-printer-failover.ts:50`
- `use-sync-queue.ts` — does not have this anti-pattern; it's in the bucket for a different rule.

**Risk assessment:** the React 19 compiler flags this because in concurrent mode a render can be discarded mid-flight, leaving a stale ref overwrite. In practice the Supabase channel callback only fires after `subscribe()` resolves on a committed render, so the discarded-render risk is theoretical. The refactor (move assignment into `useEffect(() => { ref.current = cb })`) is mechanically safe but each hook needs the React-Hooks Testing Library or Playwright spec to confirm "callback always fires the latest version." None of these hooks currently has unit coverage.

**P3-2 — No reconnect handler / no subscription-state observer.**
None of the 8 hooks call `.subscribe((status) => ...)`. Supabase JS auto-reconnects but on `CHANNEL_ERROR` or `TIMED_OUT` the consumer never knows. For a POS this is recoverable (next mutation will hit the network) but for KDS it can mask "ghost" disconnected terminals. Recommend adding `subscribe((status) => { if (status !== 'SUBSCRIBED') console.error(...) })` in V7.5.3.

**P3-3 — `useTableRealtime` (`tables-rt:${locationId}`) vs `useRealtimeTables` (`tables:${floorPlanId}`) channel naming.**
`src/hooks/use-table-realtime.ts:60` vs `src/hooks/use-realtime.ts:171`. Different scope keys (location vs floor_plan), different prefixes. If a future component subscribes via both, payloads are duplicated.

### KDS-specific (V6.4.1 framer-motion)

`KdsPageContent.tsx:780-807` wraps the ticket grid in `<AnimatePresence initial={false}>` keyed on `ticket.id`. Combined with the sort by aging+priority, this is the correct interaction with realtime: a re-sort produces a layout shift but no exit/enter (same key); a new ticket animates in via `itemSpawn.initial → animate`; a bumped ticket exits via `itemSpawn.exit`. `KdsTicket.tsx:53-59` adds a CSS-driven `kds-bump-out` slide that runs *before* `onBump` is called (320ms timeout), so the optimistic UI is clean even when the server response races the animation. **No interaction bug here.**

Also confirmed: `KdsCapacityIndicator.tsx` is fixed (V5.99 retro). It selects `tickets` via `useShallow` and computes capacity in `useMemo` — the `getCapacity()` Zustand-selector pattern that caused the V4 P0 is gone. One residual: `KdsPageContent.tsx:240` still calls `actionsRef.current.getCapacity()` inside `getHeartbeatMetrics`, which is fine because it's behind a `useCallback` and runs only every 30s on a heartbeat tick — not in render.

## What I checked

- Read end-to-end: `use-realtime.ts`, `use-kds-realtime.ts`, `use-kds-heartbeat.ts`, `use-table-realtime.ts`, `use-reservation-realtime.ts`, `use-realtime-86.ts`, `use-printer-failover.ts`, `use-sync-queue.ts`, `recalculate-order.ts`, `idempotency.ts`, `sync-queue.ts` (offline lib), `KdsTicket.tsx`, `KdsCapacityIndicator.tsx`.
- Spot-read: `KdsPageContent.tsx` (1-340, 770-810), `comp/route.ts` (90-290), `orders/[id]/route.ts` (100-243), `payments/void/route.ts` (full), `concurrency.ts` (280-356), `eslint.config.mjs` (full), `public/sw.js` (full).
- Searched: every `expectedVersion` reference (35+ hits across 14 routes), every `recalculateOrderTotals` and `StaleVersionError` reference, every `} catch {` in hooks/lib/offline/orders/tax, every `withIdempotency` wrap, every `AnimatePresence` usage near KDS.
- Confirmed migration `20260504110100_lock_down_admin_table_rls.sql` denies INSERT/UPDATE/DELETE on `idempotency_records` for non-service-role.
- Confirmed `enqueueSync` (sync-queue.ts:76-113) `await offlineDB.sync_queue.put(entry)` resolves on commit and the docstring at line 70-74 is explicit that callers must await before optimistic UI — correct ordering.
- Confirmed `sync-processor.ts:155` stamps `Idempotency-Key` header on every replay.
- Confirmed `public/sw.js` line 86 has explicit `if (url.pathname.startsWith('/api/')) return` — no API caching.

## Confidence

**High** for the optimistic-locking + idempotency + offline-queue layers. The 5.99 batch closed the relevant P0s and the patterns are consistent across all 14 routes that touch order totals.

**Medium-high** for the realtime hooks. The bucketBLintDebt is genuine technical debt — but read carefully, the runtime behavior is correct because every ref assignment also runs on every render the consumer triggers, so the closure inside the once-per-mount `useEffect` always reads the latest callback at fire time. The P1-1 dead-code branch and P1-2 fan-out are operational concerns more than correctness bugs; both warrant tickets but neither will silently lose an order or double-charge a card.

**Lower** for the heartbeat + reconnection paths. Bare catches there are exactly where the V5.3 P0 was — a future failure-mode reproducer should target the IndexedDB-unavailable / network-flaky cases.

End.
