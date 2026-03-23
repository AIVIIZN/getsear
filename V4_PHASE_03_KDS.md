# V4 Phase 3: Kitchen Display System — Production Depth

Paste this ENTIRE file + MASTER_TEMPLATE.md into a fresh Claude Code session.
Then say: "Follow the MASTER_TEMPLATE. Start at Phase 1."

---

## 1.1 What is this?

A production-depth rebuild of the Sear POS Kitchen Display System. The current KDS has basic functionality — stations, ticket display, whole-ticket bump, recall, all-day counts, aging timers, and realtime sync. But it lacks the features that make a KDS usable during a real dinner rush: expo coordination across multiple stations, individual item bumping within a ticket, re-fire workflows with reason codes, allergen alerts that cannot be dismissed, configurable time thresholds per item category, kitchen capacity indicators, printer failover, kitchen close mode, station-to-expo messaging, a proper priority system (RE-FIRE > RUSH > VIP > Normal), and escalating audio alerts that get louder and more urgent as tickets age.

This phase takes KDS from "tickets appear and can be bumped" to "an expo can coordinate a 200-cover dinner rush across 5 stations without a single missed plate." Every feature works through the full stack. Every edge case (station goes offline, two stations bump simultaneously, re-fire on an already-plated item) is handled.

**This is NOT a greenfield build.** The existing codebase at /Users/ianrakow/Desktop/getsear already has:
- `src/app/(fullscreen)/kds/page.tsx` — KDS page with station tabs, ticket grid, bump, recall, all-day, sound toggle
- `src/components/kds/KdsTicket.tsx` — ticket card with aging colors, course grouping, RUSH banner, ADD badge, void overlay
- `src/components/kds/KdsTimer.tsx` — elapsed time display
- `src/components/kds/KdsAllDay.tsx` — all-day count overlay
- `src/components/kds/KdsRecallDrawer.tsx` — recall drawer
- `src/components/kds/KdsStationTabs.tsx` — station tab bar
- `src/stores/kds-store.ts` — Zustand store with hardcoded aging thresholds (5/10/15 min), no per-item-category support
- `src/app/api/kds/tickets/route.ts` — ticket aggregation (orders + items + bump events)
- `src/app/api/kds/tickets/[id]/bump/route.ts` — whole-ticket bump
- `src/app/api/kds/tickets/[id]/recall/route.ts` — recall
- `src/app/api/kds/tickets/bump-all/route.ts` — bump all tickets at station
- `src/app/api/kds/stations/route.ts` — list/create stations
- `src/app/api/kds/stations/[id]/route.ts` — update/delete station
- `src/hooks/use-realtime.ts` — Supabase Realtime hooks

**Read these files BEFORE planning:**
- CLAUDE.md — project config, tech stack, coding rules
- SCHEMA.md — `kds_stations`, `kds_ticket_events`, `order_items`, `orders` tables
- MODULE_SPECS/06_kds.md — full KDS module specification
- SEAR_POS_ARCHITECTURE.md — "Kitchen Workflow", "KDS Order Routing", "Kitchen Display Hardware", "Kitchen Station Types", "Coursing (Fine Dining)", dinner rush scenarios, allergen warnings
- UI_DESIGN.md — design system tokens
- BUSINESS_RULES.md — operational logic and state machines

---

## 1.2 Tech stack

Already built. Do not change:
- **Framework:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4
- **Components:** shadcn/ui (heavily customized for dark KDS theme)
- **State:** Zustand v5 + Immer
- **Database:** Supabase (PostgreSQL) — existing `kds_stations`, `kds_ticket_events`, `orders`, `order_items` tables
- **Auth:** Supabase Auth + cookie-based SSR
- **Real-time:** Supabase Realtime for ticket sync across all KDS screens
- **Audio:** Web Audio API for escalating alert system
- **Icons:** Lucide React (every icon MUST have a text label on KDS — cooks don't have time to guess icons)

---

## 1.3 User roles

- **Line Cook** (primary user): Sees tickets at their station (grill, fry, cold, etc.). Bumps individual items or whole tickets when prep is done. Sends messages to expo. Initiates re-fire requests.
- **Expo / Expeditor** (coordinator): Sees ALL stations' tickets. Coordinates plating — holds orders until all stations are ready. Bumps entire orders when plated. Sends messages to individual stations. Manages re-fire queue. Monitors aging tickets.
- **Manager**: Everything expo can do PLUS: configures stations, sets aging thresholds, enables/disables kitchen close mode, views kitchen capacity metrics, configures printer failover.
- **Server** (read-only for this phase): Sees ticket status on POS. Fires courses. Marks orders as RUSH or VIP. Does not interact with KDS directly.

---

## 1.4 Pages and features

### Page: KDS Station View — `/kds` or `/kds?station={station_id}`

- **Who:** Line Cook, Expo, Manager
- **Layout:** Full-screen, dark theme, landscape orientation. No chrome except top toolbar (48px). Entire remaining space is ticket columns.
- **What's on it:**

#### Top Toolbar (48px)
- **Station selector:** Horizontal tabs showing station names. Active station highlighted with brand color underline. Expo station shows a distinct icon/badge. If accessed via `?station=` URL param, that station is pre-selected and tabs may be hidden (dedicated device mode).
- **Kitchen capacity indicator:** Live badge showing `{active_tickets} tickets | {total_items} items | {utilization}%`. Color-coded: green (<60%), yellow (60-80%), red (>80%). Utilization calculated as active items / configurable max capacity per station.
- **Priority queue count:** Badge showing count of RE-FIRE + RUSH + VIP tickets currently active. Pulses if count > 0.
- **Kitchen Close toggle:** (Manager only) Button to enable/disable kitchen close mode. When active, shows red "KITCHEN CLOSED" banner below toolbar. Syncs with POS — when kitchen is closed, POS disables food ordering (drinks-only mode).
- **All-Day button:** Opens all-day count overlay (already exists, enhance with category grouping).
- **Recall button:** Opens recall drawer (already exists, enhance with reason display).
- **Messages button:** Opens station-to-expo message panel. Badge shows unread message count.
- **Sound toggle:** Mute/unmute (already exists).
- **Bump All button:** (already exists) Red, appears only when tickets are present.

#### Ticket Grid (main area)
- **Layout:** Horizontal scrolling row of ticket cards. 2-6 columns configurable per station (stored in `kds_stations.display_settings`). Each card takes full grid-row height.
- **Sort order (priority system):** Tickets sorted by priority tier, then by age within tier:
  1. **RE-FIRE** — bright red header banner, pulsing border, moved to position 1
  2. **RUSH** — red RUSH banner (already exists), position after re-fires
  3. **VIP** — gold VIP banner with star icon, position after rush
  4. **Normal** — standard tickets, sorted oldest-first
- **Re-fire tickets:** Show "RE-FIRE" banner in bright red with reason code displayed (e.g., "RE-FIRE: dropped plate"). Original ticket time shown crossed out, new re-fire timer running. Re-fire count badge if item has been re-fired more than once.

#### Individual Ticket Card (enhanced from existing)
Everything the current `KdsTicket.tsx` does, PLUS:

- **Allergen alert banner:** If ANY item on the ticket has allergens flagged for the guest (from `order_items.special_instructions` containing allergy keywords or from guest allergen profile via `customers.allergens`), display a FULL-WIDTH RED BANNER at the top of the ticket. Banner text: "ALLERGY: {allergen_list}" in white bold uppercase. This banner CANNOT be dismissed, tapped through, or hidden. It persists for the entire life of the ticket. The ticket card border also becomes red regardless of aging state.
- **Individual item bump:** Each item row has a small bump checkbox/button on the right side (44px+ touch target). Tapping it marks that specific item as done at this station. A green checkmark replaces the bump button. The item text dims slightly. When ALL items on the ticket are individually bumped, the whole ticket auto-bumps with slide-off animation.
- **Item status indicators:** Each item shows its status:
  - Pending: default appearance
  - In-progress: subtle highlight (cook has started)
  - Completed (bumped): green checkmark, dimmed text
  - Voided: strikethrough + red "(VOIDED)" (already exists)
  - Held (course not yet fired): grayed out with "HOLD" badge (already exists)
- **Re-fire via long-press:** Long-press on a bumped/completed item opens re-fire dialog. User selects reason code (Dropped, Wrong Temp, Wrong Item, Contamination, Customer Complaint, Expo Quality, Other). Re-fired item reappears on the ticket with RE-FIRE banner. Creates new `kds_ticket_events` record of type `refire`.
- **Aging timer per item category:** Different item types have different expected prep times. Appetizers might be 8 min, entrees 15 min, desserts 10 min. The aging color for each item (not just the ticket) is based on the item's `menu_category` threshold. The ticket-level aging color is the WORST (most urgent) of any item on the ticket.
- **Station origin label (expo only):** On expo view, each item shows a small badge indicating which station it routes to (e.g., "GRILL", "FRY"). Completed items from other stations show a green checkmark next to the station badge.

#### Expo-Specific Features (when `station_type = 'expo'`)
- **Multi-station coordination:** Expo sees all items across all stations for each order. When a prep station bumps an item, the expo ticket updates in real-time — that item gets a green checkmark and the originating station badge turns green.
- **"Ready to Run" state:** When ALL items for an order have been bumped at their respective prep stations, the expo ticket transitions to "READY TO RUN" state: green glow border, "READY TO RUN" banner replaces the aging timer, distinct chime sound plays.
- **Expo bump (final):** Expo taps "BUMP" on a ready-to-run ticket. This triggers `order.all_ready` — the order status changes to `ready`, server is notified on POS. Only expo can do the final bump that makes order status = ready.
- **Partial hold:** Expo can see that e.g., fries are done at fry station but steak is still on the grill. Expo knows not to plate fries yet. The ticket visually separates done vs. pending items per station.
- **Fire course from expo:** Expo can fire the next course directly from the KDS (same as server firing from POS). Useful when expo is coordinating timing.
- **Station messaging from expo:** Expo can tap a station badge on any item and send a quick message to that station (e.g., "How long on the salmon?" or "Need plates for 42"). Message appears as a banner on the target station's KDS.

#### Station-to-Expo Messaging
- **Quick message panel:** Slide-out panel from the right edge. Shows conversation thread between this station and expo.
- **Pre-built quick messages:** "86 {item} in {X} minutes", "Need re-fire on ticket #{N}", "Behind — add {X} min to all tickets", "Ready for pickup". Tapping sends immediately.
- **Free-text input:** Text input at bottom for custom messages. On-screen keyboard for touch.
- **Message display:** Incoming messages from other stations appear as a temporary banner at the top of the KDS (auto-dismiss after 10 seconds, or tap to dismiss). Unread messages badge on Messages button.
- **Message persistence:** Messages stored in a new `kds_messages` table. Cleared at end of day or manually.

#### Escalating Audio Alerts
- **New ticket:** Single beep (800Hz, 150ms) — already exists.
- **RUSH ticket:** Double beep (800Hz then 1000Hz) — already exists but basic.
- **VIP ticket:** Triple ascending chime (600Hz, 800Hz, 1000Hz).
- **RE-FIRE ticket:** Urgent rapid triple beep (1200Hz, 3x at 100ms intervals).
- **Aging escalation:**
  - Ticket enters "aging" (yellow): No additional sound.
  - Ticket enters "late" (orange): Single low tone (400Hz, 300ms) every 60 seconds.
  - Ticket enters "critical" (red): Repeating alarm pattern (800Hz-1200Hz alternating, 200ms each, 3 cycles) every 30 seconds. Gets louder (gain increases from 0.3 to 0.5 to 0.7) each successive alarm.
- **"Ready to Run" chime (expo):** Pleasant ascending 3-note chime indicating all items complete.
- **Sound is per-station configurable:** Each station can independently mute, set volume, choose which alert types are active.
- **Sounds do NOT repeat on page reload** — only fire on live state transitions.

#### Printer Failover
- **Primary display:** KDS screen is the primary ticket destination.
- **Heartbeat:** KDS page sends heartbeat to `/api/kds/heartbeat` every 30 seconds with `{ station_id, terminal_id }`. Server stores `last_heartbeat_at` on the station record.
- **Failover trigger:** If a station's heartbeat is >60 seconds stale (configurable), it is considered offline.
- **Auto-print:** When KDS is offline, new tickets for that station auto-print to the station's assigned backup printer (configured in `kds_stations.display_settings.failover_printer_id`).
- **Failover banner:** All other KDS stations and the POS show a persistent yellow banner: "KDS Station {name} OFFLINE — printing to backup".
- **Recovery:** When the KDS station comes back online, the banner clears. Any tickets that were printed (not bumped) during the outage appear on the KDS with a "PRINTED" badge so the cook knows they were already seen on paper.
- **Manual print:** Any ticket can be manually printed to any configured printer by long-pressing the ticket header and selecting "Print Ticket".

#### Kitchen Close Function
- **Trigger:** Manager taps "Kitchen Close" button in KDS toolbar. Requires manager PIN.
- **Effect on KDS:** Red "KITCHEN CLOSED" banner appears below toolbar on ALL KDS stations at that location. Existing tickets continue processing normally. No new food tickets arrive.
- **Effect on POS:** Food categories are hidden/disabled on the POS menu grid. Only beverage and non-food items remain orderable. A banner shows "Kitchen Closed — Drinks Only" on the POS.
- **Sync mechanism:** Kitchen close state stored in `locations` table (`is_kitchen_closed` boolean). Broadcast via Supabase Realtime to all POS and KDS screens at that location.
- **Re-open:** Manager taps again, enters PIN, kitchen re-opens. POS menu restores. KDS banner clears.

#### Configurable Time Thresholds Per Item Category
- **Station-level defaults:** Each station has default aging thresholds in `display_settings`: `{ fresh_max: 300, aging_max: 600, late_max: 900 }` (seconds).
- **Category-level overrides:** New table `kds_category_thresholds` maps `(station_id, menu_category_id)` to custom thresholds. Example: appetizers at 480/600/720 seconds, entrees at 600/900/1200 seconds.
- **Per-item aging:** Each item on a ticket ages according to its category's thresholds (falling back to station defaults). The ticket-level color is the worst of any item.
- **Configuration UI:** In station settings, a table showing each menu category with editable threshold fields (minutes, not seconds).

### Page: KDS Station Configuration — Settings > KDS section
- **Who:** Manager, Owner
- **What's on it:**
  - List of KDS stations with name, type (prep/expo), status (active/inactive), ticket count
  - Add/edit station form:
    - Station name
    - Station type (prep or expo)
    - Prep station routing (multi-select checkboxes: grill, fry, cold, saute, pastry, bar)
    - Display settings: font size (S/M/L/XL), columns (2-6), sound enabled, sound volume
    - Aging thresholds: 3 fields (fresh->aging minutes, aging->late minutes, late->critical minutes)
    - Category-specific thresholds: expandable table with per-category override
    - Failover printer: dropdown of configured printers at this location
    - Terminal assignment: dropdown of registered terminals
    - Max capacity (items): for utilization calculation
  - Delete/deactivate station

---

## 1.5 Look and feel

- **Mode:** Dark theme only (KDS-specific, does not affect rest of Sear)
- **Vibe:** Industrial, high-contrast, functional, zero-nonsense
- **Background:** Near-black (#0a0a0a), not pure black (easier on eyes under kitchen heat lamps)
- **Card backgrounds:** Dark gray (#1a1a1a) with subtle border (#2a2a2a)
- **Text:** White (#ffffff) primary, gray (#888888) secondary. Item names MUST be minimum 16px semibold. Modifier text minimum 14px.
- **Aging colors (vivid on dark):**
  - Fresh: iOS green (#34C759) — green accent border/header
  - Aging: iOS yellow (#FFCC00) — yellow accent border/header, warm dark card bg (#1a1a00)
  - Late: iOS orange (#FF9500) — orange accent border/header, warm dark card bg (#1a0d00)
  - Critical: iOS red (#FF3B30) — red accent border/header, dark red card bg (#1a0000), flashing animation
- **Priority banners:**
  - RE-FIRE: #FF2D55 (iOS pink-red), pulsing animation, white bold text
  - RUSH: #FF3B30 (iOS red), pulsing animation, white bold text (already exists)
  - VIP: #FFD700 (gold), subtle shimmer, dark text
  - ALLERGY: #FF0000 (pure red), static (no animation — must be always readable), white bold text
- **Animations:**
  - Ticket slide-in from left on arrival (already exists)
  - Ticket slide-out to right on bump (already exists)
  - Individual item checkmark fade-in on item bump
  - "Ready to Run" green glow pulse on expo tickets
  - Critical ticket flash (alternating border opacity, already exists)
  - Re-fire ticket entrance: slide-in from top with bounce
- **Touch targets:** 56px minimum for bump buttons. 44px minimum for item bump checkboxes. Generous spacing between touch targets — greasy fingers in a hot kitchen.
- **Font sizes:** Configurable per station (S=14/12px, M=16/14px, L=18/16px, XL=22/18px for item/modifier text)
- **Quality bar:** Must look and feel like QSR Automations or Toast KDS. Industrial, not pretty.

---

## 1.6 Business rules and special behavior

1. **Item routing:** When order is sent, each `order_item` routes to KDS stations whose `prep_stations[]` array contains the item's `prep_station` value. An item can appear on multiple stations (e.g., burger on grill AND expo).

2. **Expo coordination rule:** Expo does NOT bump individual items from other stations. Expo bumps the entire order. Expo bump is ONLY available when all items from all prep stations are marked complete (green checkmarks). If even one item is pending, expo bump button is disabled with a tooltip showing which station(s) still have pending items.

3. **Re-fire creates a new ticket event:** `kds_ticket_events` with `event_type = 'refire'` and `metadata = { reason_code, original_item_id }`. The item's `is_ready` is reset to false. The item reappears on the prep station AND expo. Re-fired items automatically get RUSH priority escalation if not already higher priority.

4. **Re-fire reason codes:** `dropped`, `wrong_temp`, `wrong_item`, `contamination`, `customer_complaint`, `expo_quality`, `other`.

5. **Allergen detection:** Check `order_items.special_instructions` for keywords (allergy, allergic, allergen, celiac, anaphylaxis, epipen, nut, gluten, dairy, shellfish, soy, egg). Also check if the order's customer has allergens on their profile (`customers.allergens` jsonb field). If either match, the allergen banner fires. False positives are acceptable; false negatives are not — this is a safety feature.

6. **Kitchen close sync:** `locations.is_kitchen_closed` boolean. POS checks this before allowing food items to be added to orders. KDS subscribes to realtime changes on `locations` table. Both POS and KDS react within 1 second of the toggle.

7. **Printer failover heartbeat:** KDS page sends heartbeat to `/api/kds/heartbeat` every 30 seconds with `{ station_id, terminal_id }`. Server stores `last_heartbeat_at` on the station record. If stale >60 seconds, failover triggers.

8. **Message lifecycle:** Messages auto-expire after 4 hours. Manager can clear all messages manually. Messages are location-scoped, not org-scoped.

9. **Capacity calculation:** `utilization = (active_unbumped_items / station.max_capacity) * 100`. Default max_capacity = 30 items. Configurable per station.

10. **Priority sort order:** RE-FIRE (priority 1) > RUSH (priority 2) > VIP (priority 3) > Normal (priority 4). Within same priority, oldest first. This sort applies on every render — tickets physically move position when priority changes.

11. **Sound escalation state:** Stored in Zustand (client-side only). Each ticket tracks its last alert level. When a ticket transitions to a new aging tier, the appropriate sound fires. Sounds do NOT repeat on page reload — only on live transitions.

12. **Concurrent bump safety:** If two KDS screens bump the same item simultaneously, the second bump is a no-op (idempotent). The API checks if a `bumped` event already exists for that item+station before creating a new one.

13. **Item-level bump creates event:** Each individual item bump creates a `kds_ticket_events` record with `event_type = 'bumped'` and the specific `order_item_id`. When all items for that order at that station are bumped, a station-level `kds_ticket_events` record with `event_type = 'station_complete'` is also created.

14. **Recall window:** Items can be recalled within 5 minutes of bump (configurable in `display_settings.recall_window_seconds`). After that window, only re-fire is available.

15. **Course management on KDS:** Items with `course > 1` show "HOLD" on KDS until the course is fired by the server (via `POST /orders/:id/fire-course`) or by expo directly. When fired, the HOLD badge is removed and the aging timer starts from fire time, not order creation time.

16. **Voided items:** When an item is voided after being sent, it appears with "(VOIDED)" overlay and strikethrough. The cook stops prepping. It does not need to be bumped.

17. **ADD items:** When a server adds items to an already-sent order and sends again, only the new items appear as a new ticket on KDS with "ADD" badge, referencing the original order number.

---

## 1.7 Integrations

- **Supabase Realtime:** All KDS events (new tickets, bumps, recalls, re-fires, messages, kitchen close) broadcast in real-time. Every KDS screen at a location sees updates within 1 second.
- **ESC/POS Printing (failover):** When KDS is offline, tickets auto-print via existing printer infrastructure. Formatted as kitchen tickets: large order number, table, items with mods, ALLERGY banner in double-height text.
- **POS sync:** Kitchen close state syncs to POS. Bump events update `order_items.is_ready` which the POS reads for order status display. Expo bump changes `orders.status` to `ready`.

---

## 1.8 Modules and features planned but not for this phase

- **KDS metrics dashboard** (Phase 7 Reports) — speed-of-service charts, station efficiency graphs
- **KDS admin back-office redesign** (Phase 10 Settings) — full station config management with drag-and-drop reorder
- **Bump bar hardware support** — physical bump bar keypads connected via USB/Bluetooth (Phase 5 Hardware)
- **Multi-language KDS** — Spanish/English toggle for kitchen staff (future)
- **KDS historical playback** — replay a shift's tickets for training purposes (future)
- **Predictive prep alerts** — "Table 12 will order dessert in ~10 min based on course timing" (future)
- **AI ticket time prediction** — ML model predicting completion time based on current load (future)

---

## 1.9 Anything else

**This KDS must survive a Friday night dinner rush.** That means:
- 50+ active tickets across 5 stations simultaneously
- Expo coordinating 10+ multi-station orders at once
- Re-fires happening mid-rush without losing track
- Allergen tickets NEVER getting lost in the noise
- Audio alerts that actually get attention without being annoying during calm periods
- If a KDS screen crashes, tickets print to backup immediately — zero tickets lost

**Performance requirement:** Ticket list must render at 60fps even with 50+ tickets. No jank on scroll. Use `React.memo` on ticket components with stable keys. Zustand store updates must be O(1) for bump operations, not O(n) filtering. Priority sorting should happen in a Zustand selector (computed), not on every render.

**The expo screen is the most important screen in this phase.** A good expo can run a kitchen. A bad expo screen forces the expo to walk to every station and look at their screens. The expo view must show EVERYTHING — which items are done, which are pending, which station is behind, which order is ready to run — in a single glance.

**Allergy is non-negotiable.** Someone could die. The allergen banner must be impossible to miss, impossible to dismiss, and impossible to confuse with other alerts. Pure red, white text, full-width, always visible. No exceptions.

**Dark theme CSS must be scoped to KDS only.** The rest of Sear is light theme. KDS applies `dark` class to `<html>` on mount and removes it on unmount (already implemented). All KDS-specific dark styles must not leak to other pages.

---

## Files to Create

| # | File | Purpose |
|---|------|---------|
| 1 | `src/components/kds/KdsExpoTicket.tsx` | Expo-specific ticket card with multi-station item status, station badges, ready-to-run state |
| 2 | `src/components/kds/KdsItemBump.tsx` | Individual item bump checkbox/button component (44px+ touch target) |
| 3 | `src/components/kds/KdsAllergenBanner.tsx` | Full-width red allergen alert banner (non-dismissable, `role="alert"`) |
| 4 | `src/components/kds/KdsRefireDialog.tsx` | Re-fire reason code picker dialog with 7 reason options |
| 5 | `src/components/kds/KdsMessagePanel.tsx` | Station-to-expo message slide-out panel with quick messages and free text |
| 6 | `src/components/kds/KdsMessageBanner.tsx` | Incoming message display banner (auto-dismiss after 10s) |
| 7 | `src/components/kds/KdsCapacityIndicator.tsx` | Kitchen capacity badge (tickets/items/utilization %) |
| 8 | `src/components/kds/KdsPriorityBanner.tsx` | RE-FIRE / RUSH / VIP banner component with distinct colors and animations |
| 9 | `src/components/kds/KdsKitchenCloseBanner.tsx` | "KITCHEN CLOSED" full-width red banner |
| 10 | `src/components/kds/KdsFailoverBanner.tsx` | "Station X OFFLINE — printing to backup" yellow banner |
| 11 | `src/components/kds/KdsStationConfig.tsx` | Station configuration form for settings page |
| 12 | `src/components/kds/KdsCategoryThresholds.tsx` | Per-category aging threshold editor table |
| 13 | `src/app/api/kds/tickets/[id]/refire/route.ts` | Re-fire item API (reset is_ready, create refire event, escalate priority) |
| 14 | `src/app/api/kds/tickets/[id]/bump-item/route.ts` | Individual item bump API (idempotent, creates bumped event per item) |
| 15 | `src/app/api/kds/messages/route.ts` | GET messages for station, POST new message |
| 16 | `src/app/api/kds/messages/[id]/route.ts` | Mark message read, delete message |
| 17 | `src/app/api/kds/heartbeat/route.ts` | POST station heartbeat (update last_heartbeat_at) |
| 18 | `src/app/api/kds/kitchen-close/route.ts` | POST toggle kitchen close state (requires manager PIN) |
| 19 | `src/app/api/kds/capacity/route.ts` | GET kitchen capacity metrics for station |
| 20 | `src/app/api/kds/category-thresholds/route.ts` | GET/POST category-specific aging thresholds |
| 21 | `src/lib/kds/audio-alerts.ts` | Escalating audio alert system (Web Audio API, all sound patterns and volume escalation) |
| 22 | `src/lib/kds/allergen-detector.ts` | Allergen keyword detection utility (special_instructions + customer profile) |
| 23 | `src/lib/kds/printer-failover.ts` | Failover logic (heartbeat staleness check, auto-print trigger) |
| 24 | `src/lib/kds/priority-sort.ts` | Priority sorting utility (RE-FIRE > RUSH > VIP > Normal, then age) |

## Files to Modify

| # | File | Changes |
|---|------|---------|
| 1 | `src/app/(fullscreen)/kds/page.tsx` | Add expo mode detection, message panel, capacity indicator, kitchen close banner, failover banner, priority sorting, escalating audio, per-category aging, heartbeat interval |
| 2 | `src/components/kds/KdsTicket.tsx` | Add individual item bump, allergen banner, re-fire long-press, per-item aging colors, VIP banner, station origin labels (expo mode) |
| 3 | `src/stores/kds-store.ts` | Add messages state, capacity state, kitchen close state, per-category thresholds, item-level bump tracking, re-fire state, sound escalation tracking, priority enum |
| 4 | `src/components/kds/KdsStationTabs.tsx` | Add capacity badge per station, offline indicator for failed heartbeat, expo tab distinction |
| 5 | `src/components/kds/KdsAllDay.tsx` | Group counts by menu category, show re-fire counts separately |
| 6 | `src/components/kds/KdsRecallDrawer.tsx` | Show re-fire reason on recalled tickets, filter by recall time window |
| 7 | `src/app/api/kds/tickets/route.ts` | Add allergen detection, priority field, per-item category thresholds, VIP flag from customer profile, re-fire status |
| 8 | `src/app/api/kds/tickets/[id]/bump/route.ts` | Support item-level bump via `item_id` param, idempotency check, station_complete event |
| 9 | `src/app/api/kds/stations/route.ts` | Add heartbeat tracking fields, failover config, capacity config |
| 10 | `src/app/api/kds/stations/[id]/route.ts` | Add category threshold config, failover printer assignment |
| 11 | `src/hooks/use-realtime.ts` | Add `useRealtimeKdsMessages` and `useRealtimeKitchenClose` hooks |
| 12 | `src/components/pos/MenuGrid.tsx` | Respect kitchen close state — hide food categories when `is_kitchen_closed = true` |
| 13 | `src/components/pos/OrderPanel.tsx` | Show "Kitchen Closed — Drinks Only" banner when kitchen is closed |

## Database Changes

| # | Change | Description |
|---|--------|-------------|
| 1 | New table: `kds_messages` | `id` (uuid PK), `org_id`, `location_id`, `from_station_id` (FK kds_stations), `to_station_id` (FK kds_stations, nullable = broadcast), `message_text`, `is_read` (boolean default false), `created_at` (timestamptz), `expires_at` (timestamptz). RLS on org_id. |
| 2 | New table: `kds_category_thresholds` | `id` (uuid PK), `org_id`, `station_id` (FK kds_stations), `menu_category_id` (FK menu_categories), `fresh_max_seconds` (int), `aging_max_seconds` (int), `late_max_seconds` (int). Unique on `(station_id, menu_category_id)`. RLS on org_id. |
| 3 | Alter `kds_stations` | Add columns: `last_heartbeat_at` (timestamptz), `max_capacity` (int default 30), `is_online` (boolean default true). |
| 4 | Alter `locations` | Add column: `is_kitchen_closed` (boolean default false). |
| 5 | Alter `orders` | Add column: `priority` (text default 'normal'). Values: 'refire', 'rush', 'vip', 'normal'. |
| 6 | Alter `kds_ticket_events` | Add column: `metadata` (jsonb default '{}'). Used for re-fire reason codes, failover printer info, etc. |

---

## Acceptance Criteria

### Expo Coordination
- [ ] Expo screen shows ALL items for each order, grouped by originating station with station badge labels
- [ ] When a prep station bumps an item, the expo ticket shows a green checkmark next to that item within 1 second
- [ ] When ALL items for an order are bumped at their prep stations, the expo ticket transitions to "READY TO RUN" with green glow and chime
- [ ] Expo bump button is DISABLED until all items are complete — tooltip shows which station(s) are still pending
- [ ] Expo bump sets `orders.status = 'ready'` and notifies the POS server via Realtime

### Individual Item Bumping
- [ ] Each item on a ticket has a bump checkbox/button (44px+ touch target)
- [ ] Tapping item bump marks that specific item as done — green checkmark, dimmed text
- [ ] Item bump creates `kds_ticket_events` record with `event_type = 'bumped'` and specific `order_item_id`
- [ ] When all items on a ticket are individually bumped, the ticket auto-slides off with animation
- [ ] Concurrent bumps on the same item from two screens are idempotent — no duplicate events

### Re-Fire Workflow
- [ ] Long-press on a completed/bumped item opens re-fire dialog with 7 reason codes
- [ ] Selecting a reason creates `refire` event with reason in metadata, resets `is_ready = false`
- [ ] Re-fired item reappears on the prep station AND expo with "RE-FIRE: {reason}" banner
- [ ] Re-fired items automatically escalate to highest priority position (above RUSH)
- [ ] Re-fire count badge shows if an item has been re-fired more than once

### Allergen Alerts
- [ ] If any item's special_instructions contain allergy keywords, a full-width red ALLERGY banner appears at top of ticket
- [ ] If the order's customer has allergens on their profile, the banner includes those specific allergens by name
- [ ] The allergen banner CANNOT be dismissed, tapped through, or hidden — persists for entire ticket lifecycle
- [ ] Allergen banner appears on BOTH prep station ticket AND expo ticket
- [ ] Allergen text is specific: "ALLERGY: Peanuts, Shellfish" not just "ALLERGY"

### Configurable Time Thresholds
- [ ] Each station has configurable default aging thresholds (fresh/aging/late/critical minutes)
- [ ] Menu categories can have per-station threshold overrides via `kds_category_thresholds` table
- [ ] Each item on a ticket ages according to its category's thresholds (falling back to station defaults)
- [ ] Ticket-level aging color is the worst (most urgent) of any item's aging state

### Kitchen Capacity
- [ ] Capacity indicator in toolbar shows active tickets, total items, and utilization percentage
- [ ] Indicator color-codes: green (<60%), yellow (60-80%), red (>80%)
- [ ] Max capacity is configurable per station in station settings
- [ ] Capacity updates in real-time as tickets arrive and are bumped

### Printer Failover
- [ ] KDS page sends heartbeat POST every 30 seconds
- [ ] If heartbeat is stale >60 seconds, other stations and POS show yellow offline banner
- [ ] New tickets for offline station auto-print to configured failover printer
- [ ] When station comes back online, banner clears; printed tickets show "PRINTED" badge on KDS

### Kitchen Close
- [ ] Manager toggles kitchen close from KDS toolbar (requires manager PIN)
- [ ] "KITCHEN CLOSED" red banner appears on ALL KDS stations at that location via Realtime
- [ ] POS hides food categories and shows "Kitchen Closed — Drinks Only" banner
- [ ] Existing tickets continue processing normally; only new food tickets are blocked
- [ ] Manager can re-open kitchen (PIN required), all banners clear, POS menu fully restores

### Station Messaging
- [ ] Station can send message to expo via quick-message panel with pre-built and free-text options
- [ ] Expo can send message to any individual station by tapping the station badge
- [ ] Incoming messages appear as temporary banner (auto-dismiss 10 seconds)
- [ ] Unread message count badge appears on Messages button

### Priority System
- [ ] Tickets sort by priority: RE-FIRE (1) > RUSH (2) > VIP (3) > Normal (4)
- [ ] Within same priority tier, oldest tickets appear first (left-most)
- [ ] Tickets physically reposition when priority changes
- [ ] Each priority tier has a distinct visual banner with unique color and animation

### Escalating Audio
- [ ] Different sounds for: new ticket, RUSH, VIP, RE-FIRE, ready-to-run
- [ ] Critical tickets trigger repeating alarm every 30 seconds with increasing volume
- [ ] Sound is configurable per station (mute, volume, which alert types are active)
- [ ] Sounds do not repeat on page reload — only fire on live state transitions

---

## Workflow Tests

### Test 1: Full Dinner Rush — Multi-Station Coordination
1. Create a dine-in order with: 1x Ribeye (grill station), 1x Caesar Salad (cold station), 1x French Fries (fry station)
2. Send order to kitchen
3. Verify: Ribeye appears on Grill KDS, Caesar appears on Cold KDS, Fries appear on Fry KDS, ALL three appear on Expo KDS with station badges
4. Bump Caesar on Cold station — verify expo shows green checkmark on Caesar, station badge turns green
5. Bump Fries on Fry station — verify expo shows green checkmark on Fries
6. Verify expo ticket is NOT ready to run (Ribeye still pending on Grill)
7. Bump Ribeye on Grill station — verify expo ticket transitions to "READY TO RUN" with green glow and chime
8. Bump order on Expo — verify `orders.status` changes to `ready`, POS shows order ready notification
9. Verify all `kds_ticket_events` records created correctly: received, bumped (per item per station), station_complete, expo bumped
10. **Verify:** End-to-end time tracked from first item received to expo bump

### Test 2: Re-Fire with Priority Escalation
1. Create and send order with 1x Burger (grill) + 1x Fries (fry)
2. Bump both items at their stations, bump at expo — order status = ready
3. Expo realizes burger was wrong temp — long-press Burger on expo, select "Wrong Temp" reason
4. Verify: Burger reappears on Grill KDS with "RE-FIRE: Wrong Temp" banner at priority position 1 (above any RUSH tickets)
5. Verify: Burger reappears on Expo KDS with RE-FIRE banner, `is_ready` reset to false
6. Verify: Urgent RE-FIRE audio alert plays on Grill station
7. Cook bumps re-fired Burger on Grill — Expo shows green checkmark — Expo bumps — done
8. Verify `kds_ticket_events` has refire event with `{ reason_code: 'wrong_temp' }` in metadata
9. **Verify:** Re-fire did not create duplicate tickets, original bump events preserved in history

### Test 3: Allergen Safety Critical Path
1. Create order for a customer who has "Peanuts, Tree Nuts" in their `customers.allergens` profile
2. Add 1x Pad Thai (which contains peanuts) to the order
3. Send to kitchen
4. Verify: KDS ticket shows full-width red ALLERGY banner reading "ALLERGY: Peanuts, Tree Nuts"
5. Verify: Banner is present on BOTH the prep station ticket AND the expo ticket
6. Verify: Banner cannot be dismissed by tapping, swiping, or any other interaction
7. Bump all items at prep station — verify allergen banner still visible on expo ticket
8. On a separate order, add special_instructions "SEVERE SHELLFISH ALLERGY" to an item
9. Verify: That ticket also gets allergen banner reading "ALLERGY: SHELLFISH"
10. **Verify:** Allergen banner visible from 6 feet away on a 15" KDS screen (text size, contrast)

### Test 4: KDS Failover to Printer
1. Configure Grill station with a failover printer in station settings
2. Grill KDS is active and sending heartbeats every 30 seconds
3. Simulate Grill KDS crash (close the browser tab — heartbeats stop)
4. Wait 60+ seconds for heartbeat to go stale
5. Create and send a new order with a grill item
6. Verify: Grill ticket auto-prints to the configured failover printer
7. Verify: Other KDS stations (Fry, Cold, Expo) show yellow banner "Grill Station OFFLINE — printing to backup"
8. Re-open Grill KDS — verify heartbeat resumes, offline banner clears on all screens
9. Verify: The printed ticket appears on Grill KDS with "PRINTED" badge (cook already has paper copy)
10. **Verify:** No tickets were lost during the outage, print format includes order number, table, items, mods, and ALLERGY banner

### Test 5: Kitchen Close Flow
1. Manager taps Kitchen Close on KDS toolbar — enters manager PIN — confirms
2. Verify: Red "KITCHEN CLOSED" banner on ALL KDS stations at that location
3. Switch to POS — verify food categories are hidden, "Kitchen Closed — Drinks Only" banner shown
4. Attempt to add a Burger to an order — verify food items are not visible/orderable
5. Add a Beer to an order — verify it works (beverages still orderable, routes to bar station on KDS)
6. Existing open KDS tickets can still be bumped and processed normally
7. Manager re-opens kitchen from KDS — enters PIN — confirms
8. Verify: All "KITCHEN CLOSED" banners clear from KDS and POS, food categories reappear
9. Create and send a new food order — verify it appears on KDS normally
10. **Verify:** Kitchen close state persists across page refreshes (stored in `locations` table, not client-side)

### Test 6: Priority Sorting Under Load
1. Create and send 5 normal orders to kitchen (tickets 1-5 appear in age order)
2. Mark order 3 as RUSH from POS — verify ticket 3 moves to position 1 on KDS
3. Mark order 5 as VIP from POS — verify ticket 5 moves to position 2 (after RUSH, before normals)
4. Re-fire an item on order 1 — verify order 1 moves to position 1 (RE-FIRE > RUSH)
5. Verify final sort order: Order 1 (RE-FIRE), Order 3 (RUSH), Order 5 (VIP), Order 2 (Normal), Order 4 (Normal)
6. Verify each priority tier has its distinct visual banner (RE-FIRE=red pulsing, RUSH=red, VIP=gold, Normal=none)
7. Bump order 1 (RE-FIRE) — verify remaining tickets shift: Order 3 now at position 1
8. **Verify:** Priority changes are reflected on ALL KDS screens within 1 second via Realtime

### Test 7: Escalating Audio During Aging
1. Create and send an order. Station has thresholds: fresh 0-5min, aging 5-10min, late 10-15min, critical 15min+
2. New ticket beep plays on arrival (800Hz, 150ms)
3. At 5 minutes: ticket turns yellow (aging) — no additional sound
4. At 10 minutes: ticket turns orange (late) — single low tone (400Hz) plays, repeats every 60 seconds
5. At 15 minutes: ticket turns red (critical) — alarm pattern plays, repeats every 30 seconds
6. At 15:30: alarm repeats — verify it is louder than the first alarm (gain 0.5 vs 0.3)
7. At 16:00: alarm repeats again — verify louder still (gain 0.7)
8. Bump the ticket — verify all alerts immediately stop, ticket slides off
9. **Verify:** Muting sound stops all alerts; unmuting resumes them for any currently critical tickets
