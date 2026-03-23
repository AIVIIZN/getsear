# Sear POS v4 — Phase 9: Offline-First Architecture (MASTER_TEMPLATE Part 1)

Paste this ENTIRE file + MASTER_TEMPLATE.md into a fresh Claude Code session.
Then say: "Follow the MASTER_TEMPLATE. Start at Phase 1."

---

## 1.1 What is this?

A production-depth implementation of offline-first capability for Sear POS. This is the #1 competitive differentiator per SEAR_POS_ARCHITECTURE.md — the owner persona says: "If your POS just shows a 'No Internet Connection' error and becomes a brick, I will return it the next day." Currently, the app has a `useOnlineStatus` hook in `src/hooks/use-online-status.ts` that detects connectivity, but there is zero offline functionality — no Service Worker, no IndexedDB cache, no sync queue, no offline order entry, no store-and-forward payments.

This phase builds the complete offline-first stack: a Service Worker that caches the PWA shell and static assets, IndexedDB storage for menu/tables/staff/settings data, offline order creation with a sync queue, offline cash payments with a sync queue, store-and-forward card payment queuing for Valor, offline clock in/out, a conflict resolution system for reconnection, a visible offline mode banner, and automatic reconnection with intelligent sync.

The POS must function fully offline for at minimum 4 hours. Orders, cash payments, clock-ins, and kitchen routing must all work on local data. When connectivity returns, everything syncs cleanly without duplicates or data loss.

**Read these files BEFORE planning:**
- CLAUDE.md — project config, tech stack
- SEAR_POS_ARCHITECTURE.md — section 1 (Offline-First is core differentiator #5), section 4 (owner's offline requirements), section 5 (network requirements, offline capability), competitive analysis (offline reliability is #1 customer complaint)
- SCHEMA.md — tables for orders, payments, time_entries, menu_items, tables, staff
- BUSINESS_RULES.md — order lifecycle, payment flows
- UI_DESIGN.md — design system tokens
- V4_PHASE_OUTLINE.md — phase 9 scope

---

## 1.2 Tech stack

Already built. Do not change core stack. New additions for this phase:
- **Framework:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4
- **Service Worker:** Custom SW using Workbox (`workbox-webpack-plugin`, `workbox-precaching`, `workbox-routing`, `workbox-strategies` — new dependencies)
- **IndexedDB:** Dexie.js v4 (`dexie` — new dependency, provides typed IndexedDB wrapper)
- **Sync Queue:** Custom implementation using Dexie + BullMQ-style retry logic in the browser
- **Online Detection:** Upgrade existing `use-online-status.ts` hook
- **Background Sync:** Service Worker Background Sync API where available, fallback to polling

---

## 1.3 User roles

Offline mode is transparent to all roles — every user gets the same offline capability based on what their role can normally do:
- **Owner/Manager**: Offline order entry, cash payments, can view cached reports (last downloaded), clock in/out
- **Server/Bartender**: Offline order entry, cash payments, clock in/out — this is the critical path
- **Host**: Offline waitlist management (add parties, mark seated) using cached table data
- **Kitchen**: Offline KDS — tickets from offline orders display on the KDS via local broadcast (if on same network)

---

## 1.4 Pages and features

### Service Worker — PWA Offline Shell

#### What it does:
- Precaches the entire Next.js app shell (HTML, CSS, JS bundles) on first load using Workbox
- Runtime caching strategy: Network-First for API calls (try server, fall back to cache), Cache-First for static assets (images, fonts, icons)
- Handles navigation requests: if offline and the URL matches a known route, serve the cached app shell; the client-side router handles the rest
- Background Sync: when online again, triggers sync of queued operations
- Update notification: when a new SW version is available, show a non-intrusive "Update available — tap to refresh" banner

#### Files:
- `public/sw.js` — Generated Service Worker (Workbox output)
- `src/lib/offline/sw-register.ts` — SW registration with update detection
- `next.config.ts` — Updated with Workbox plugin for SW generation
- `src/app/manifest.json` — PWA manifest (already exists? update with offline_enabled flag)

### IndexedDB Local Data Cache

#### What it stores:
The following data is cached to IndexedDB on login and kept in sync via Supabase Realtime while online. When offline, the app reads from IndexedDB instead of making API calls.

| Table | IndexedDB Store | Sync Strategy | Size Estimate |
|-------|----------------|---------------|---------------|
| `menu_items` + `menu_categories` + `modifier_groups` + `modifiers` | `menu` | Full sync on login, incremental via Realtime | ~500KB for 200-item menu |
| `tables` + `floor_plans` | `tables` | Full sync on login, incremental via Realtime | ~50KB |
| `staff` (active staff for this location) | `staff` | Full sync on login | ~20KB |
| `location_settings` + `tax_rates` + `price_levels` | `settings` | Full sync on login | ~10KB |
| `orders` (open orders only) | `orders` | Full sync on login, incremental via Realtime | ~200KB for 50 open orders |
| `kds_tickets` (active tickets) | `kds_tickets` | Full sync on login, incremental via Realtime | ~100KB |

#### Sync mechanism:
- **Initial load (login):** Fetch all data from Supabase, write to IndexedDB. Show a progress bar: "Preparing offline data... Menu (200 items), Tables (24), Staff (12)"
- **While online:** Supabase Realtime subscriptions push changes. Every change is written to both the Supabase API and IndexedDB simultaneously.
- **While offline:** All reads come from IndexedDB. All writes go to the sync queue (see below).
- **Reconnection:** Sync queue processes pending operations. Then a full re-sync of open orders and KDS tickets to catch anything that changed on other terminals.

#### Files:
- `src/lib/offline/db.ts` — Dexie database schema definition (all stores, indexes, versions)
- `src/lib/offline/cache-manager.ts` — Orchestrates initial cache load, incremental updates, cache invalidation
- `src/lib/offline/menu-cache.ts` — Menu-specific cache logic (categories, items, modifiers, allergens, 86 status)
- `src/lib/offline/tables-cache.ts` — Tables and floor plan cache
- `src/lib/offline/staff-cache.ts` — Staff cache (names, PINs for PIN login, roles)
- `src/lib/offline/settings-cache.ts` — Location settings, tax rates, price levels
- `src/lib/offline/orders-cache.ts` — Open orders cache with real-time sync

### Offline Order Entry

#### How it works:
When the app detects it is offline (via `use-online-status` hook + SW fetch failure detection), the order entry flow switches to IndexedDB mode:

1. Server taps menu items → items come from IndexedDB `menu` store (with correct prices, modifiers, 86 status as of last sync)
2. Server builds the order → order is created in IndexedDB `orders` store with a locally-generated UUIDv7 and `sync_status: 'pending'`
3. Server taps "Send" → order is written to IndexedDB `kds_tickets` store (for local KDS display)
4. If KDS terminals are on the same local network, use BroadcastChannel API to push the ticket to KDS screens
5. When online again, the sync queue pushes the order to Supabase via API, then updates `sync_status: 'synced'`

#### Conflict handling:
- Orders created offline use client-generated UUIDv7 IDs — no server round-trip needed for ID generation
- If the server has a newer version of a menu item (price changed while offline), the offline price is kept for orders already placed (honor the price shown to the server at order time)
- If a table was occupied by another terminal while this terminal was offline, the sync process flags the conflict and asks the server to reassign

#### Files:
- `src/lib/offline/sync-queue.ts` — Core sync queue: enqueue operations, process on reconnect, retry failed ops
- `src/lib/offline/order-sync.ts` — Order-specific sync logic (create, update, item add/remove, void)
- `src/stores/order-store.ts` — MODIFY: add IndexedDB read/write path alongside Supabase calls
- `src/stores/menu-store.ts` — MODIFY: read from IndexedDB when offline
- `src/stores/table-store.ts` — MODIFY: read from IndexedDB when offline

### Offline Cash Payments

#### How it works:
Cash payments can be fully processed offline because no external service is needed:

1. Server taps "Pay" → selects "Cash" → enters amount tendered
2. System calculates change due (all math is client-side)
3. Payment record is created in IndexedDB with `sync_status: 'pending'`
4. Order status is updated to 'closed' in IndexedDB
5. Cash drawer opens (via local printer connection if available)
6. When online, payment syncs to Supabase

#### Files:
- `src/lib/offline/payment-sync.ts` — Payment-specific sync logic (cash, store-and-forward card)

### Store-and-Forward Card Payments

#### How it works:
This is the most critical offline feature. When internet is down but the Valor terminal is reachable on the local network:

1. Server taps "Pay" → selects "Card"
2. System checks: is the Valor terminal reachable on the local network? (Valor terminals connect via Bluetooth or local IP)
3. If YES: process the card through the Valor terminal locally. The terminal stores the authorization. Create a payment record in IndexedDB with `sync_status: 'store_and_forward'` and the Valor transaction reference.
4. If NO (no terminal access either): show a message "Card payments unavailable — cash only while offline" with an option to hold the check open.
5. When internet returns, the sync queue sends the stored authorization to Valor's settlement API and to Supabase.

#### Risk management:
- Store-and-forward transactions have a configurable maximum amount (default $200). Above this, require manager PIN override.
- Store-and-forward transactions must settle within 24 hours or they may be declined by the card network. The sync queue prioritizes these.
- A count of pending store-and-forward transactions is shown in the offline banner.

#### Files:
- `src/lib/offline/valor-store-forward.ts` — Store-and-forward logic for Valor terminal local communication
- `src/lib/offline/payment-sync.ts` — Handles settlement on reconnection

### Offline Clock In/Out

#### How it works:
Staff can clock in and out while offline:

1. Staff member enters their PIN on the clock-in screen
2. PIN is validated against the locally-cached staff data in IndexedDB (PINs are bcrypt hashed — validation happens client-side using a bcrypt WASM module)
3. Time entry is created in IndexedDB with `sync_status: 'pending'` and a precise timestamp
4. When online, time entry syncs to Supabase

#### Important: Time accuracy
- Offline clock entries use `Date.now()` which relies on the device clock. If the device clock is wrong, the time entry will be wrong. On reconnection, compare device time to server time. If the drift is >2 minutes, flag the time entry for manager review.

#### Files:
- `src/lib/offline/clock-sync.ts` — Clock in/out sync logic with time drift detection
- `src/hooks/use-clock.ts` — MODIFY: add offline path

### Sync Queue Engine

#### Architecture:
The sync queue is the core of the offline system. It is a persistent, ordered queue stored in IndexedDB.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUIDv7 | Queue entry ID |
| `operation` | string | `create_order`, `update_order`, `create_payment`, `clock_in`, `clock_out`, etc. |
| `entity_type` | string | `order`, `payment`, `time_entry`, etc. |
| `entity_id` | UUIDv7 | The ID of the entity being synced |
| `payload` | JSON | The full data to send to the server |
| `status` | string | `pending`, `syncing`, `synced`, `failed`, `conflict` |
| `attempts` | number | Retry count |
| `created_at` | ISO string | When the operation was queued |
| `last_attempt_at` | ISO string | Last sync attempt timestamp |
| `error` | string | Error message if failed |

#### Processing rules:
- Queue processes in FIFO order (oldest first)
- Operations for the same entity are processed sequentially (order create before order update)
- Maximum 3 retry attempts per operation. After 3 failures, mark as `failed` and alert the user.
- Store-and-forward card payments are prioritized (processed before orders and clock entries)
- Processing pauses if the connection drops again mid-sync

#### Conflict resolution:
- **Last-write-wins for most operations:** If the server has a newer version of an order (edited on another terminal while this one was offline), the server version wins for fields that conflict, but offline additions (new items) are merged.
- **No-conflict for new entities:** Orders, payments, and time entries created offline have unique UUIDv7 IDs and are always additive — they never conflict with server data.
- **Manual resolution for table assignments:** If two terminals assigned different orders to the same table while offline, flag for manager resolution on reconnect.

#### Files:
- `src/lib/offline/sync-queue.ts` — Queue engine (enqueue, process, retry, status tracking)
- `src/lib/offline/sync-processor.ts` — Processes individual queue entries by calling the appropriate API route
- `src/lib/offline/conflict-resolver.ts` — Handles merge conflicts on reconnection

### Offline Mode Banner & Indicator

#### What the user sees:
- **Online (normal):** Green dot in topbar (already exists in `Topbar.tsx`), no banner
- **Offline (just lost connection):** Amber animated banner slides down from the top: "You're offline — orders and cash payments still work. Card payments require Valor terminal on local network." Banner has a dismiss X but the amber dot stays in the topbar.
- **Offline (working):** Amber dot in topbar replaces green dot. Pulse animation. Tooltip shows: "Offline — 3 orders pending sync, 1 payment pending sync"
- **Reconnecting:** Banner changes to blue: "Connection restored — syncing 4 pending operations..." with a progress indicator
- **Sync complete:** Green banner flashes briefly: "All caught up! 4 operations synced." Then disappears. Green dot returns.
- **Sync conflict:** Red banner: "1 conflict needs attention — a table was assigned to two orders while offline." With "Resolve" button.

#### Files:
- `src/components/offline/OfflineBanner.tsx` — Animated banner component with all states
- `src/components/offline/SyncStatusIndicator.tsx` — Topbar dot replacement with pending count tooltip
- `src/components/offline/SyncProgressBar.tsx` — Progress bar for reconnection sync
- `src/components/offline/ConflictResolutionDialog.tsx` — Modal for manual conflict resolution
- `src/hooks/use-online-status.ts` — MODIFY: upgrade with SW-aware detection, debounce, and sync queue integration
- `src/components/layout/Topbar.tsx` — MODIFY: replace static dot with SyncStatusIndicator

### Automatic Reconnection

#### How it works:
1. `use-online-status` hook detects `navigator.onLine` change AND periodically pings the Supabase health endpoint (every 5 seconds when offline)
2. When connectivity is confirmed (successful ping), the hook triggers the sync queue processor
3. Sync queue processes all pending operations in priority order (card payments first)
4. After queue is empty, a full re-sync of open orders and KDS tickets runs to catch changes from other terminals
5. Supabase Realtime subscriptions are re-established

#### Edge cases:
- **Flaky connection (online/offline/online rapidly):** Debounce with 3-second delay before triggering sync. Don't start processing if the connection might drop again.
- **Long offline period (>4 hours):** Show a warning: "You were offline for 6 hours. Menu prices or availability may have changed. Syncing now..." Full menu re-sync before allowing new orders.
- **Multiple terminals offline simultaneously:** Each terminal has its own sync queue with its own UUIDv7 IDs. No conflicts for new entities. Table assignment conflicts resolved manually.

#### Files:
- `src/lib/offline/reconnection-manager.ts` — Orchestrates reconnection: detect, sync queue, re-sync, re-subscribe
- `src/lib/offline/health-check.ts` — Ping Supabase to verify real connectivity (not just `navigator.onLine`)

### Local Menu Cache Warm on Login

#### How it works:
When a user logs in, before showing the POS screen:
1. Fetch the complete menu (categories, items, modifiers, allergens, 86 status, price levels) from Supabase
2. Write everything to IndexedDB
3. Fetch open orders, active tables, staff roster, location settings, tax rates
4. Write to IndexedDB
5. Show a branded loading screen: "Preparing your station..." with a progress bar showing what's loading
6. Once complete, navigate to the POS screen
7. If the user is already logged in and the cache exists (returning from sleep/background), skip the full load — just do an incremental sync of changes since `last_sync_at`

#### Files:
- `src/lib/offline/cache-warmer.ts` — Orchestrates the full cache warm on login
- `src/components/offline/CacheWarmingScreen.tsx` — Branded loading screen with progress
- `src/app/(pos)/layout.tsx` — MODIFY: add cache warming gate before rendering POS pages

---

## 1.5 Look and feel

Already defined in UI_DESIGN.md. Offline-specific additions:
- **Offline banner:** Amber background (#F59E0B at 10% opacity), amber text, subtle slide-down animation (300ms spring). Not alarming — reassuring.
- **Sync indicator dot:** Replace the existing green connection dot. Amber when offline with pulse animation. Green with brief grow animation when synced.
- **Pending count badge:** Small amber pill badge on the dot showing number of pending operations (like an iOS notification badge)
- **Sync progress:** Thin progress bar at the very top of the viewport (like YouTube/GitHub loading bar), ember orange color
- **Conflict dialog:** Standard shadcn dialog with clear two-column comparison (your version vs server version) and "Keep Mine" / "Keep Server" / "Merge" buttons
- **Cache warming screen:** Full-screen, centered Sear logo with animated progress ring, items loading listed below, warm off-white background
- **Offline order items:** Subtle amber left border on order items that are pending sync (so the server knows which items haven't hit the kitchen server yet)

---

## 1.6 Business rules and special behavior

1. **Offline duration limit:** The system supports up to 8 hours of offline operation. After 8 hours without sync, show a warning that cached data may be stale. Do not block operation — just warn.
2. **Store-and-forward max amount:** Default $200 per transaction. Configurable in location settings. Above this, require manager PIN. This limits the restaurant's financial exposure if a stored card is declined during settlement.
3. **Store-and-forward settlement window:** Card networks require settlement within 24 hours. The sync queue must process card payments within 24 hours of the original authorization or flag them for manual review.
4. **PIN validation offline:** Staff PINs are cached as bcrypt hashes in IndexedDB. Validation uses a bcrypt WASM library (`bcryptjs` or similar). Manager PINs for overrides (voids, comps) also work offline.
5. **86 status:** If an item is 86'd on another terminal while this terminal is offline, the offline terminal will still show the item as available. On reconnection, any orders placed for 86'd items are flagged with a warning (but not automatically voided — the kitchen may have un-86'd it by then).
6. **Price changes:** Menu price changes made while offline do not affect orders already placed offline. The price shown to the server at the time of order is the price that stands.
7. **Order numbering:** Offline orders use a local sequence number (per terminal, per day) for display: e.g., "OFL-001", "OFL-002". On sync, they receive the canonical server order number. The local number is retained in `notes` for reference.
8. **Realtime subscriptions:** On reconnect, all Supabase Realtime channels are torn down and re-established. The app must handle the brief gap where it's online but not yet subscribed.
9. **IndexedDB quota:** Browsers typically allow 50-100MB per origin. Our cache target is <5MB total. Monitor quota usage and warn if approaching 80%.
10. **Multiple tabs:** Only one tab should own the sync queue processor (use a BroadcastChannel or lock). Other tabs read from IndexedDB but delegate writes to the primary tab.
11. **Cash drawer offline:** If the cash drawer is connected via the printer (RJ-11), it will open on offline cash payments. If the drawer is network-connected and the network is down, it won't open — prompt the server to open it manually.
12. **KDS offline:** If the KDS is on the same local network (WiFi), offline orders can be pushed to KDS via BroadcastChannel (same browser) or a local WebSocket server. If the KDS is on a different device on the same LAN, this requires a local relay server (stretch goal — flag as limitation if not implemented).

---

## 1.7 Integrations

- **Workbox:** `workbox-webpack-plugin` for SW generation, `workbox-precaching` for app shell, `workbox-routing` + `workbox-strategies` for runtime caching
- **Dexie.js v4:** Typed IndexedDB wrapper. Provides transactions, versioning, and live queries.
- **Supabase Realtime:** Already integrated. Must handle disconnect/reconnect gracefully.
- **BroadcastChannel API:** For cross-tab communication (sync queue ownership, offline KDS ticket delivery)
- **Valor Terminal:** Local Bluetooth/IP communication for store-and-forward. Uses existing Valor integration code.

---

## 1.8 Modules and features planned but not for this phase

- Local relay server for cross-device KDS communication on LAN (future — complex, requires a small Node server on the network)
- Offline receipt printing (requires direct printer communication — Phase 5: Hardware)
- Offline online-ordering (online orders inherently require internet)
- Offline reporting (reports can be cached but not generated offline)
- Background Sync API for automatic retry (progressive enhancement — use if available, fall back to manual)

---

## 1.9 Anything else

**Existing files to modify:**
- `src/hooks/use-online-status.ts` — Upgrade: add SW-aware detection, debounced state changes, health check pinging, sync queue integration
- `src/hooks/use-clock.ts` — Add offline clock in/out path via IndexedDB
- `src/hooks/use-realtime.ts` — Add reconnection handling: tear down and re-establish channels on reconnect
- `src/stores/order-store.ts` — Add dual-write: Supabase + IndexedDB when online, IndexedDB-only when offline
- `src/stores/menu-store.ts` — Read from IndexedDB cache, subscribe to Realtime for live updates
- `src/stores/table-store.ts` — Read from IndexedDB cache when offline
- `src/stores/kds-store.ts` — Accept offline orders via BroadcastChannel, write to IndexedDB
- `src/stores/auth-store.ts` — Cache authenticated user in IndexedDB for offline session persistence
- `src/components/layout/Topbar.tsx` — Replace connection dot with SyncStatusIndicator
- `src/components/pos/OrderPanel.tsx` — Show amber border on pending-sync items
- `src/app/(pos)/layout.tsx` — Add cache warming gate on initial load
- `next.config.ts` — Add Workbox plugin configuration for Service Worker generation

**New files to create:**

### Service Worker
- `public/sw.js` — Generated Service Worker (Workbox output, do not edit directly)
- `src/lib/offline/sw-register.ts` — Service Worker registration, update detection, message handling
- `src/lib/offline/sw-config.ts` — Workbox configuration: precache manifest, runtime caching routes

### IndexedDB
- `src/lib/offline/db.ts` — Dexie database definition: stores, indexes, schema versions, upgrade logic
- `src/lib/offline/cache-manager.ts` — Orchestrates all cache operations: warm, sync, invalidate, quota check
- `src/lib/offline/menu-cache.ts` — Menu data cache: full load, incremental update, 86 status sync
- `src/lib/offline/tables-cache.ts` — Tables/floor plan cache
- `src/lib/offline/staff-cache.ts` — Staff roster cache with hashed PINs
- `src/lib/offline/settings-cache.ts` — Location settings, tax rates, price levels cache
- `src/lib/offline/orders-cache.ts` — Open orders cache with real-time sync

### Sync Queue
- `src/lib/offline/sync-queue.ts` — Core queue engine: enqueue, dequeue, process, retry, status
- `src/lib/offline/sync-processor.ts` — Processes queue entries by calling API routes
- `src/lib/offline/order-sync.ts` — Order-specific sync: create, update, add items, void items
- `src/lib/offline/payment-sync.ts` — Payment sync: cash payments, store-and-forward card settlements
- `src/lib/offline/clock-sync.ts` — Clock in/out sync with time drift detection
- `src/lib/offline/conflict-resolver.ts` — Conflict detection and resolution logic

### Reconnection
- `src/lib/offline/reconnection-manager.ts` — Orchestrates reconnection: detect, sync, re-sync, re-subscribe
- `src/lib/offline/health-check.ts` — Ping Supabase to verify real connectivity
- `src/lib/offline/valor-store-forward.ts` — Valor terminal local communication for store-and-forward

### UI Components
- `src/components/offline/OfflineBanner.tsx` — Animated status banner (offline/syncing/synced/conflict)
- `src/components/offline/SyncStatusIndicator.tsx` — Topbar dot with pending count badge
- `src/components/offline/SyncProgressBar.tsx` — Top-of-viewport progress bar during sync
- `src/components/offline/ConflictResolutionDialog.tsx` — Dialog for manual conflict resolution
- `src/components/offline/CacheWarmingScreen.tsx` — Full-screen loading during initial cache warm
- `src/components/offline/StoreForwardWarning.tsx` — Warning for store-and-forward limits

### Stores
- `src/stores/offline-store.ts` — Zustand store: online status, sync queue length, pending operations, last sync timestamp, sync progress

### Hooks
- `src/hooks/use-offline-data.ts` — Generic hook: reads from IndexedDB if offline, Supabase if online, with seamless switching
- `src/hooks/use-sync-queue.ts` — Hook exposing sync queue state: pending count, sync progress, conflicts

### Database Migrations
- `supabase/migrations/XXXXXX_sync_metadata.sql` — Add `sync_status` and `client_id` columns to `orders`, `payments`, `time_entries` tables for tracking offline-originated records

---

## Acceptance Criteria

Every checkbox must pass before this phase is complete:

### Service Worker & PWA
- [ ] Service Worker installs on first visit and precaches the app shell (HTML, CSS, JS)
- [ ] Navigating to any POS route while offline serves the cached app shell and the page renders
- [ ] Static assets (images, fonts, icons) load from cache when offline
- [ ] When a new SW version is available, a non-intrusive "Update available" banner appears
- [ ] The app is installable as a PWA (Add to Home Screen on iPad Safari)

### IndexedDB Cache
- [ ] On login, the complete menu (categories, items, modifiers, allergens, 86 status) is cached to IndexedDB
- [ ] On login, open orders, tables, staff roster, and location settings are cached to IndexedDB
- [ ] A progress screen shows during initial cache warm: "Preparing your station..." with item counts
- [ ] While online, Supabase Realtime changes are mirrored to IndexedDB in real time
- [ ] If cache already exists (returning from background), only incremental changes are fetched

### Offline Order Entry
- [ ] With WiFi disabled, server can browse the menu (from IndexedDB cache) and see correct items and prices
- [ ] With WiFi disabled, server can create a new order, add items with modifiers, and tap "Send"
- [ ] Offline orders are stored in IndexedDB with `sync_status: 'pending'`
- [ ] Offline orders receive a local order number (e.g., "OFL-001") displayed to the server
- [ ] On the same device, KDS page shows offline order tickets (via BroadcastChannel)

### Offline Cash Payments
- [ ] With WiFi disabled, server can process a cash payment: enter amount tendered, see change due
- [ ] Cash payment is recorded in IndexedDB with `sync_status: 'pending'`
- [ ] Order status changes to 'closed' in IndexedDB
- [ ] On reconnection, the cash payment syncs to Supabase

### Store-and-Forward Card Payments
- [ ] With WiFi disabled but Valor terminal reachable on local network, server can process a card payment
- [ ] Card authorization is stored locally with Valor transaction reference
- [ ] Payment record in IndexedDB has `sync_status: 'store_and_forward'`
- [ ] On reconnection, store-and-forward payments are prioritized in the sync queue and settled with Valor
- [ ] Transactions over the configured maximum ($200 default) require manager PIN
- [ ] If Valor terminal is also unreachable, the UI shows "Card payments unavailable — cash only while offline"

### Offline Clock In/Out
- [ ] With WiFi disabled, staff member can enter PIN and clock in
- [ ] PIN is validated against cached bcrypt hash in IndexedDB
- [ ] Time entry is stored in IndexedDB with `sync_status: 'pending'` and accurate timestamp
- [ ] On reconnection, time entry syncs. If device clock drift >2 minutes vs server, entry is flagged for manager review

### Sync Queue
- [ ] Pending operations are stored in IndexedDB and persist across browser refreshes
- [ ] On reconnection, sync queue processes in FIFO order with card payments prioritized
- [ ] Operations for the same entity process sequentially (create before update)
- [ ] Failed operations retry up to 3 times; after 3 failures, they are marked as `failed` and the user is alerted
- [ ] Duplicate sync is prevented: synced operations are not re-processed

### Offline Mode Banner & Indicators
- [ ] When connection is lost, an amber banner slides down: "You're offline — orders and cash payments still work"
- [ ] Topbar connection dot changes from green to amber with pulse animation
- [ ] Topbar dot shows a badge with the count of pending sync operations
- [ ] On reconnection, banner changes to blue: "Syncing X operations..." with progress
- [ ] After sync completes, green banner flashes: "All caught up!" then disappears
- [ ] If a sync conflict exists, red banner appears with "Resolve" button

### Reconnection & Sync
- [ ] Reconnection is detected both via `navigator.onLine` and by a successful Supabase health check ping
- [ ] Connection state changes are debounced (3-second delay) to avoid thrashing on flaky connections
- [ ] After sync queue is empty, open orders and KDS tickets are re-synced to catch changes from other terminals
- [ ] Supabase Realtime subscriptions are torn down and re-established on reconnection
- [ ] If offline for >4 hours, a full menu re-sync runs before allowing new orders

---

## Workflow Tests

### Workflow 1: Internet Goes Down During Dinner Rush
1. Server has 3 open tables. Internet drops.
2. Amber banner slides down: "You're offline — orders and cash payments still work"
3. Topbar dot turns amber with pulse
4. Server opens table 4's order → taps menu items from cached menu → adds Wagyu Burger with extra cheese
5. Taps "Send" → order is saved to IndexedDB → KDS shows the ticket (same device or via BroadcastChannel)
6. Server adds a side salad to table 2's existing order → saved to IndexedDB
7. Table 1 pays cash ($47.50, tendered $50) → change $2.50 displayed → payment saved → order closed
8. Amber badge shows: "3 pending" (2 order operations + 1 payment)
9. Internet returns → banner changes to blue "Syncing 3 operations..."
10. All 3 operations sync → green flash "All caught up!" → badge disappears → dot turns green

### Workflow 2: Store-and-Forward Card Payment
1. Internet is down. Customer at table 6 wants to pay by card ($85.50 check).
2. Server taps "Pay" → selects "Card"
3. System detects: internet down, Valor terminal VP800 reachable on local Bluetooth
4. Sends card request to Valor terminal → customer inserts chip → "Approved" on terminal
5. Payment saved to IndexedDB with `store_and_forward` status and Valor reference
6. Order closes. Receipt shows "PAYMENT PENDING SETTLEMENT" notice.
7. Internet returns 45 minutes later → sync queue prioritizes the card payment
8. Valor settlement API confirms the charge → status updates to `synced`
9. Supabase records the payment

### Workflow 3: Staff Clocks In While Offline
1. WiFi router reboots (down for 5 minutes). Server arrives for their shift.
2. Taps clock-in → enters PIN 4821
3. PIN validated against cached bcrypt hash → match → clock-in recorded at 4:02 PM
4. Time entry saved to IndexedDB with `sync_status: 'pending'`
5. WiFi returns → time entry syncs → server time (4:02 PM) matches server clock within 30 seconds → entry accepted

### Workflow 4: Long Offline Period
1. Restaurant loses internet at 6 PM (ISP outage). Continues operating on cached data.
2. Over 4 hours: 35 orders placed, 20 cash payments, 8 store-and-forward card payments
3. At 10 PM, amber badge shows "63 pending"
4. Internet returns at 10:30 PM
5. Banner: "You were offline for 4.5 hours. Syncing 63 operations and refreshing menu data..."
6. Full menu re-sync runs first (in case prices or 86 status changed)
7. Store-and-forward card payments process first (8 payments settle with Valor)
8. Then orders sync (35 orders created in Supabase)
9. Then cash payments sync (20 payments)
10. Progress bar fills as each operation completes
11. All 63 operations sync successfully → "All caught up!"

### Workflow 5: Conflict Resolution
1. Terminal A and Terminal B both go offline simultaneously
2. Terminal A assigns a new order to Table 12
3. Terminal B assigns a different order to Table 12
4. Both terminals come back online
5. Terminal A syncs first → Table 12 gets Terminal A's order
6. Terminal B syncs → conflict detected (Table 12 already has an order from Terminal A)
7. Terminal B shows red banner: "1 conflict: Table 12 was assigned to two orders while offline"
8. Manager taps "Resolve" → sees both orders side by side → moves Terminal B's order to Table 14
9. Conflict resolved → banner clears

### Workflow 6: Login and Cache Warm
1. New shift starts. Server logs in on a cold iPad (no cache).
2. After authentication, full-screen loading: "Preparing your station..."
3. Progress shows: "Menu: 187 items... Tables: 24... Staff: 12... Settings... Open orders: 8..."
4. After ~3 seconds, loading completes → POS screen appears with full menu grid and 8 open orders
5. Server goes offline immediately after → everything works because the cache is warm

### Workflow 7: PWA Installation and Offline Boot
1. Owner installs Sear POS as PWA on iPad (Add to Home Screen)
2. Opens the PWA — app loads from the Service Worker cache instantly
3. Logs in → cache warms
4. Next morning, iPad has been in sleep mode overnight. WiFi is temporarily down.
5. Owner taps the Sear icon → app loads from SW cache (no network needed)
6. Login session is still valid (cached in IndexedDB) → POS loads with yesterday's cached data
7. Amber banner: "You're offline — last synced 10 hours ago"
8. WiFi returns → incremental sync fetches overnight changes → ready to go
