The Write tool requires explicit permission approval for the target path which I cannot bypass — it's prompting for permission grant. Since the user told me to output to that file but the harness blocks the write, I'll deliver the findings inline and the user can grant permission to materialize them.

## Cross-cutting realtime/offline/concurrency review — V5 surfaces

**Audited:** all 8 lint-debt hooks, sync-queue/db/processor/order-sync/store, public/sw.js, state-machine, concurrency, idempotency, recalculate-order, StaleOrderModal, and 5 representative routes (orders DELETE/PATCH, /items, /send, /reopen, /comp).

**Verdict:** scaffolding is right; locking is leaky.

### CRITICAL (V5 ship-blockers)

1. **`DELETE /api/orders/[id]` (route.ts:208-270)** is a side-door void — no `assertVersion`, no `assertTransition`, no `withIdempotency`, no `audit.record`. Two terminals can both void; an already-voided order can be re-voided; a network-blip retry double-fires. The /void/ subroute does it right; this one bypasses everything.
2. **`recalculateOrderTotals` (recalculate-order.ts:175-184)** UPDATE filters only by `id` — no `.eq('version', expectedVersion)`. Every route that calls it (POST /items, PATCH /, /comp, /discount, /merge, /items/[itemId]) gates its primary write but leaks the totals write. The V5.4.1 reviewer flagged this; it is **STILL OPEN**. Concrete TOCTOU: T1+T2 pass `assertVersion` at v=5, both INSERT items, both call recalc — second writer's stale-snapshot UPDATE clobbers. Fix: thread `expectedVersion` and chain `.eq('version', v)`.

### HIGH (pre-V6)

3. **Offline replay priority breaks causality** (sync-queue.ts:11-22). `settle_payment=0`, `create_payment=1`, `create_order=5`. Per-entity dedup is by `(entity_type, entity_id)` so payment.entity_id ≠ order.id — a queued payment fires before its parent order, returns 404, burns 3 retries. Visible as transient 5xx during reconnect. Fix: sequence by entity-type ladder (orders → payments) with priority as intra-type tiebreak.
4. **Comp route re-open/auto-close UPDATEs are unlocked** (comp/route.ts:136-142, 223-230). `assertVersion` at line 98 is decorative — the actual writes don't gate on version, so a refund + comp race can both "win" with inconsistent ledger.

### MEDIUM

5. **`markSyncing` attempts increment broken by operator precedence** (sync-queue.ts:169-175). `?.attempts ?? 0 + 1` parses as `?.attempts ?? 1` — never increments. markFailed papers over but telemetry is wrong.
6. **Service worker leaks authenticated shell across users** (sw.js:124-133). `cache.put('/', ...)` after every successful nav — on shared kitchen tablets, user A's shell serves to user B on offline blip.
7. **`use-printer-failover` setState-after-unmount** (use-printer-failover.ts:107-127). Async start + 10s polling + event callbacks all setState without cancelled guard.
8. **`use-sync-queue` double-refresh + writes-into-store-from-effect** (use-sync-queue.ts:34-78). Two effects each call refresh on mount; refresh writes pending counts into Zustand from a polling timer.
9. **8 lint-debt hooks: refs assigned during render — concrete React 19 concurrent-rendering exposure.** Pattern `cbRef.current = cb` at top level. A discarded render's ref-write survives; subsequent realtime event invokes a callback closing over never-committed state. Already scheduled V7.5.3 — don't defer past V7.

### LOW

10. `assertVersion`'s `requireHeader=false` default invites silent lock bypass (concurrency.ts:194-234). Invert default; opt OUT in offline-replay.
11. Idempotency middleware caches arbitrary-size response bodies as JSON (idempotency.ts:114-132). Add 1MB cap + content-type gate.
12. `/send` and `/reopen` use inline status checks instead of `assertTransition` — partial state-machine coverage.
13. BroadcastChannel `getSyncChannel()` non-null assertion lies when API unavailable (sync-queue.ts:303-308).

### INFO (verified-correct)

- Channel cleanup: every Supabase subscribe pairs with `removeChannel`. ✓
- `notifyQueueChange()` fires after `await offlineDB.sync_queue.put(...)`. ✓
- SW `/api/*` bypass + non-GET bypass: correct. ✓
- UUIDv4 source: `crypto.randomUUID` (122 bits); `(key, route, org_id)` scoping prevents cross-tenant/route collisions. ✓
- Web Locks API correctly serializes queue processor across tabs. ✓

### Recommended immediate action

One focused fix task: (a) DELETE → /void/ delegate or duplicate guards; (b) `recalculateOrderTotals(expectedVersion)` with version-gated UPDATE; (c) re-order payment-vs-order in `getNextBatch`. Items 5-8 + 11-13 fold into V7.5.x; item 9 stays in V7.5.3.

---

**Note on output:** I cannot write to `/Users/ianrakow/Desktop/getsear/build-pipeline/logs/cross-cutting-reviews/realtime-engineer.md` — the harness is blocking with a permission prompt that requires user approval. The full JSONL content (20 findings + verdict) is ready to write the moment you grant permission, or I can drop it into a different already-writable location if you tell me where.
