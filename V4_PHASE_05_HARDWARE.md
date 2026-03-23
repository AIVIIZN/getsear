# Sear POS v4 — Phase 5: Printing & Hardware Integration

**Build Brief (MASTER_TEMPLATE Part 1)**
**Date:** 2026-03-23
**Priority:** HIGH — Week 1
**Estimated Sessions:** 2-3

---

## 1.1 What is this?

A production-depth implementation of all hardware integration for the Sear POS system. Currently there is zero hardware connectivity — no receipt printing, no kitchen ticket printing, no cash drawer control, no barcode scanner support. Every restaurant needs physical receipts, kitchen chits, and cash drawer management on day one.

This phase builds the complete printing and hardware stack: ESC/POS thermal printer driver supporting Star Micronics and Epson printers, formatted receipt printing with tip line and dual pricing, kitchen ticket printing with station routing, cash drawer trigger via printer RJ-11/RJ-12 kick cable, barcode scanner support via USB HID, printer configuration UI, print queue with retry on failure, and kitchen printer routing rules.

The architecture uses a local print relay service (Node.js process running on the same LAN as printers) that receives print jobs from the POS web app via HTTP and translates them into ESC/POS binary commands sent over the network to thermal printers. For iPad deployments, Star Micronics CloudPRNT and WebSocket-based printing are the primary paths.

**Read these files BEFORE planning:**
- `CLAUDE.md` — project config, tech stack
- `SEAR_POS_ARCHITECTURE.md` sections: Hardware Integration Requirements (line 4331), Kitchen Printer vs KDS (line 4172), Print Handling (line 8339), Receipt Printing (line 11812), Hardware Compatibility Guide (Appendix D, line 17629), End-of-Day Settlement Flow (line 8507), receipt printer code examples (line 8345)
- `UI_DESIGN.md` — design system tokens
- `SCHEMA.md` — orders, order_items, payments tables


## 1.2 Tech stack

Already built. Do not change:
- **Framework:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4
- **Components:** shadcn/ui (heavily customized)
- **Print Protocol:** ESC/POS binary commands over TCP/IP (network printers) and WebSocket (CloudPRNT)
- **Supported Printers:** Star Micronics (TSP143IV, TSP143III, mC-Print3, mPOP, SM-L200), Epson (TM-T88VII, TM-82II)
- **Cash Drawer:** RJ-12 cable driven by printer kick command (12V pulse)
- **Barcode Scanner:** USB HID (keyboard wedge mode — scanner sends keystrokes)
- **Print Relay:** Node.js service on local network (for network TCP printers)
- **Icons:** Lucide React


## 1.3 User roles

Relevant roles for hardware:
- **Owner**: full printer configuration — add/remove printers, assign to stations, configure routing rules, set receipt footer/header
- **General Manager**: same as owner for their location
- **Shift Manager**: test print, cash drawer open (logged), troubleshoot printer issues
- **Server**: implicit — receipts print when payment processes. Can request reprint. Cash drawer opens on cash payment.
- **Bartender**: same as server plus bar printer receipt
- **Kitchen Manager**: kitchen printer configuration, test print
- **Kitchen staff**: no direct interaction — kitchen tickets print automatically


## 1.4 Pages and features

### Feature: ESC/POS Printer Driver
- **Core engine:** TypeScript library that generates ESC/POS binary command sequences
- **Supported commands:**
  - Text: align (left/center/right), bold, underline, double height, double width, font A/B
  - Formatting: line feed, horizontal tab, line spacing
  - Graphics: print stored logo (bitmap), QR code (for digital receipts link)
  - Cut: full cut, partial cut (leaves tab connected)
  - Cash drawer: kick pulse on pin 2 or pin 5, configurable pulse duration
  - Barcode: Code 128, EAN-13 (for PLU printing on labels)
  - Character encoding: UTF-8 → codepage translation for international characters
- **Printer abstraction layer:** Common interface with vendor-specific adapters:
  - `StarMicronicsAdapter` — handles Star-specific initialization, status polling, CloudPRNT protocol
  - `EpsonAdapter` — handles Epson-specific initialization, status commands
- **Connection methods:**
  - TCP/IP (network printers on LAN) — primary for kitchen printers and fixed receipt printers
  - WebSocket (Star CloudPRNT) — primary for iPad-to-printer communication
  - USB (via local relay service) — fallback for direct-connect setups
  - Bluetooth (via Star Web SDK for mPOP / SM-L200) — tableside mobile receipt printing
- **Status monitoring:** Poll printer status (paper out, cover open, offline, error) every 30 seconds

### Feature: Receipt Printing
- **Trigger:** Automatically on payment completion, or manual "Print Receipt" button
- **Receipt format (80mm thermal, 42 char columns):**
  ```
  ═══════════════════════════════════════════
           SEAR RESTAURANT
       123 Main Street, Suite 100
        New York, NY 10001
           (212) 555-0100
  ═══════════════════════════════════════════
  Order: #1047          Server: Maria
  Table: T5             Guests: 4
  Date: 03/23/2026      Time: 7:42 PM
  ───────────────────────────────────────────
  1x Wagyu Burger                     $28.00
     - Medium Rare
     - Cheddar
     - Bacon                          +$2.50
  2x Caesar Salad                     $24.00
     - Add Chicken                    +$8.00
  1x Kids Mac & Cheese                 $8.00
  1x IPA Draft                         $7.00
  ───────────────────────────────────────────
  Subtotal:                           $77.50
  Tax (8.875%):                        $6.88
  ───────────────────────────────────────────
  TOTAL:                              $84.38

  ═══════════════════════════════════════════
  Card Price (4% surcharge):          $87.76
  Cash Price:                         $84.38
  ═══════════════════════════════════════════

  VISA ending 4242
  Auth: 847291

  Tip: ____________

  Total: ____________

  Signature: ________________________


  Thank you for dining with us!
  www.searrestaurant.com
  ═══════════════════════════════════════════
  ```
- **Dual Pricing display:** Both cash and card prices shown clearly (Valor requirement)
- **Tip line:** Blank line for customer to write tip (for "tip on receipt" model)
- **Digital receipt option:** QR code printed on receipt linking to digital copy
- **Email/SMS receipt:** Alternative to printing — sends formatted receipt via SendGrid/Twilio
- **Reprint:** Server can request receipt reprint from closed order detail view
- **Configurable elements:** Header (location name, address, phone), footer (custom message), logo (bitmap)

### Feature: Kitchen Ticket Printing
- **Trigger:** Automatically when order is sent to kitchen (status → 'open')
- **Route to correct printer:** Based on item's `prep_station` field → maps to station's assigned printer
- **Kitchen ticket format (80mm, NO prices, LARGE font):**
  ```
  ═══════════════════════════════════════
  ** NEW ORDER **     GRILL STATION
  ═══════════════════════════════════════
  Order: #1047    Table: T5
  Server: Maria   Guests: 4
  Time: 7:42 PM
  ───────────────────────────────────────
  COURSE 1 — FIRE

  1x WAGYU BURGER
     ** MEDIUM RARE **
     Cheddar, Bacon

  ───────────────────────────────────────
  COURSE 2 — HOLD

  2x CAESAR SALAD
     Add Chicken

  ═══════════════════════════════════════
  *** PEANUT ALLERGY — SEAT 3 ***
  ═══════════════════════════════════════
  ```
- **Formatting rules:**
  - Item names in BOLD, DOUBLE HEIGHT
  - Modifiers indented, normal size
  - Temperature/cook preferences in **BOLD** with `**` stars
  - Allergen warnings: BOLD, DOUBLE HEIGHT, full-width banner, cannot be missed
  - Course headers: BOLD with FIRE/HOLD status
  - Special instructions: italic or underlined
  - RUSH/VIP flags: printed at top in large bold text
  - Seat numbers when coursing is active
- **Multi-station routing:** Single order with items at different stations → separate ticket to each station's printer. Expo station gets complete ticket with all items.
- **Re-fire ticket:** Visually distinct — "** RE-FIRE **" header, different border style, reason code printed
- **Void ticket:** When item is voided after being sent to kitchen — "** VOID **" ticket sent to station
- **Modification ticket:** When modifier changes after initial send — "** MODIFIED **" ticket with changes highlighted

### Feature: Cash Drawer Control
- **Trigger:** Automatic on cash payment completion, manual "Open Drawer" button (shift manager+ only)
- **Mechanism:** ESC/POS command to printer's RJ-12 port (pin 2 or pin 5, configurable). Sends 12V kick pulse, configurable pulse duration (100-800ms).
- **Cash drawer requires a receipt printer** — there is no direct iPad-to-drawer connection
- **No-sale tracking:** Every "Open Drawer" without a transaction logged with: employee ID, timestamp, terminal ID, reason (prompted)
- **No-sale alert:** More than 3 no-sales per shift triggers manager alert
- **Drawer assignment:** Each terminal can be assigned a specific cash drawer (via specific printer)

### Feature: Barcode Scanner Support
- **Connection:** USB HID (keyboard wedge) — scanner sends keystrokes as if typed
- **Input handling:** Global keyboard event listener detects rapid keystroke sequence (< 50ms between keystrokes) followed by Enter → interprets as barcode scan
- **Lookup:** Scanned value matched against `plu` or `barcode` field in menu_items table
- **Action on scan:** If on POS order screen → add item to current order. If on inventory screen → look up inventory item.
- **Scanner configuration:** Prefix/suffix settings to distinguish scanner input from keyboard input
- **Visual feedback:** Brief flash/pulse animation on the added item in order panel
- **Error handling:** Unknown barcode → toast notification "Item not found for barcode [value]"

### Page: Printer Configuration
- **Who:** Owner, GM
- **Route:** `/settings/printers`
- **Layout:** List of configured printers + "Add Printer" button
- **Add Printer flow:**
  1. Select connection type: Network (IP address), CloudPRNT (Star), Bluetooth (Star mPOP/SM-L200)
  2. Enter connection details (IP:port for network, device name for Bluetooth)
  3. Select printer model from supported list (Star TSP143IV, Star TSP143III, Star mC-Print3, Star mPOP, Epson TM-T88VII, Epson TM-82II)
  4. Select printer role: Receipt Printer, Kitchen Printer, Bar Printer, Label Printer
  5. Assign to station (for kitchen printers): Grill, Sauté, Fry, Salad, Pizza, Dessert, Expo, Bar
  6. Cash drawer: Enable/disable, pin selection (2 or 5), pulse duration
  7. Test Print button — sends formatted test page
  8. Save
- **Printer list:** Each printer shows: Name, Model, IP/Connection, Role, Station, Status (Online/Offline/Error), Last Print time
- **Status indicators:** Green dot = online, Red dot = offline/error, Yellow dot = paper low
- **Auto-discovery:** "Scan Network" button discovers Star/Epson printers on LAN via SNMP or Star CloudPRNT polling
- **Receipt configuration:** Header text, footer text, logo upload (BMP, max 256px wide), dual pricing toggle, QR code toggle
- **Empty state:** "No printers configured — add your first printer to enable receipt and kitchen ticket printing" with setup guide link

### Feature: Print Queue with Retry
- **Queue:** All print jobs go through a queue (Zustand store + IndexedDB for persistence)
- **Retry logic:** If print fails (printer offline, paper out, network error):
  1. Retry immediately (1 attempt)
  2. Retry after 5 seconds
  3. Retry after 15 seconds
  4. After 3 failures: show persistent error banner "Print job failed — [Printer Name] offline" with "Retry" and "Cancel" buttons
- **Queue visibility:** Print queue icon in topbar showing pending count badge
- **Queue management:** Click queue icon → see all pending/failed jobs with status, printer, timestamp
- **Offline behavior:** Print jobs queued in IndexedDB when printer is unreachable, auto-sent when connection restored
- **KDS failover:** If KDS goes down, auto-route orders to backup kitchen printer (configurable fallback printer per station)

### Feature: Kitchen Printer Routing Rules
- **Configuration:** Each menu item has a `prep_station` field. Each station maps to a specific kitchen printer.
- **Routing table:** Settings > Printers > Kitchen Routing
  - Table showing: Station Name → Assigned Printer → Fallback Printer
  - Example: Grill Station → Kitchen Printer 1 (192.168.1.50) → Kitchen Printer 2 (fallback)
- **Multi-station items:** Items that require multiple stations (e.g., "Steak Frites" = Grill + Fry) → ticket prints at both assigned printers
- **Expo printer:** Separate printer that always gets the complete order ticket (all items, all stations)
- **Bar printer:** Drink items route to bar printer only
- **Modification routing:** When an item is modified after being sent → modification ticket prints at the same station printer


## 1.5 Look and feel

- **Mode:** Light-first (matches overall POS design system)
- **Printer Configuration page:** Clean back-office form layout. Card per printer showing status indicator, model icon, connection info.
- **Status indicators:** Large colored dots (12px) with pulse animation for "Online" status. Green = online, Red = offline, Yellow = warning (paper low).
- **Test Print button:** Ember-orange primary button, shows spinner during print, checkmark on success, red X on failure.
- **Print Queue dropdown:** Slide-down panel from topbar icon. Each job shows: document type icon, printer name, status (pending/printing/failed/complete), timestamp. Failed jobs highlighted with red left border and "Retry" button.
- **Add Printer wizard:** Step-by-step flow with connection type cards (Network, CloudPRNT, Bluetooth) as large selectable tiles. Printer model dropdown with small product image per model.
- **Receipt preview:** Live preview of receipt format as text in a monospace font container styled to look like a receipt (off-white background, slight drop shadow, torn-edge bottom).
- **Touch targets:** 48px minimum for all buttons and interactive elements.


## 1.6 Business rules

- **Cash drawer requires printer:** Cash drawers connect via RJ-12 to receipt printer. No printer = no cash drawer. System enforces this — cannot configure cash drawer without an assigned receipt printer.
- **No-sale logging:** Every cash drawer open without an associated transaction is logged: employee_id, terminal_id, timestamp, reason (prompted). 3+ no-sales per shift triggers manager notification.
- **Kitchen ticket timing:** Kitchen tickets print within 1 second of order being sent. Any delay > 3 seconds shows warning.
- **Print failover:** If primary kitchen printer for a station is offline, auto-route to configured fallback printer. If no fallback, route to expo printer. Log the failover event.
- **Receipt is mandatory for cash payments:** System auto-prints receipt on cash payment (cash drawer kick happens simultaneously via same print command).
- **Card payment receipts:** Optional — prompt "Print Receipt?" after card payment completes. Default to digital receipt preference if customer has it set.
- **Re-fire ticket priority:** RE-FIRE tickets print with "** RE-FIRE **" header and print before normal tickets in queue.
- **Void ticket after send:** When a sent item is voided, a VOID ticket prints at the kitchen station so cooks know to stop preparing it.
- **Dual pricing on receipt:** Both cash price and card price must be displayed on every receipt (Valor Dual Pricing compliance).
- **Receipt data retention:** Receipt data stored in database (not just printed). Can be reprinted from order history indefinitely.
- **Printer paper width:** All formatting assumes 80mm (42 char) thermal paper. 58mm support is out of scope for now.


## 1.7 Integrations

- **Valor PayTech:** Receipt prints after Valor terminal confirms payment. Dual pricing amounts from Valor transaction data.
- **Supabase Realtime:** Kitchen ticket printing triggered by order status change events
- **KDS module:** KDS failover triggers kitchen printer routing when display goes offline
- **Order module:** Receipt printing hooks into payment completion flow
- **Menu module:** Station routing configuration from menu item `prep_station` field
- **Staff module:** No-sale events linked to staff time clock entries for shift context


## 1.8 Modules planned but not for this phase

- Label printing for to-go orders (adhesive labels on containers) — Phase 11
- Customer-facing display integration (second screen showing order) — Phase 11
- Scale integration for weight-based pricing — Phase 11 with Inventory
- Bluetooth receipt printing for tableside checkout (Star SM-L200 / RCKT) — Phase 9 offline mode
- AirPrint fallback for office-type printers — not planned (not suitable for POS)


## 1.9 Files to create or modify

### New Files
| File | Purpose |
|------|---------|
| `src/lib/printing/escpos.ts` | Core ESC/POS command builder — generates binary command sequences |
| `src/lib/printing/escpos-commands.ts` | ESC/POS command constants (hex codes for all supported commands) |
| `src/lib/printing/star-adapter.ts` | Star Micronics printer adapter (CloudPRNT, status polling, star-specific init) |
| `src/lib/printing/epson-adapter.ts` | Epson printer adapter (Epson-specific init, status commands) |
| `src/lib/printing/printer-interface.ts` | Common printer interface type definitions |
| `src/lib/printing/receipt-formatter.ts` | Receipt layout formatter — takes order data, returns ESC/POS commands |
| `src/lib/printing/kitchen-ticket-formatter.ts` | Kitchen ticket layout formatter — large text, no prices, allergen banners |
| `src/lib/printing/cash-drawer.ts` | Cash drawer kick command generator (pin 2/5, pulse duration) |
| `src/lib/printing/print-queue.ts` | Print queue manager — queue, retry, persist to IndexedDB |
| `src/lib/printing/printer-discovery.ts` | Network printer auto-discovery (Star CloudPRNT polling, broadcast) |
| `src/lib/printing/barcode-scanner.ts` | USB HID barcode scanner input handler (global keyboard listener) |
| `src/lib/printing/print-relay-client.ts` | HTTP client for local print relay service |
| `src/components/printing/PrinterConfigPage.tsx` | Main printer configuration page |
| `src/components/printing/PrinterCard.tsx` | Individual printer card showing status, model, connection info |
| `src/components/printing/AddPrinterWizard.tsx` | Step-by-step printer setup wizard |
| `src/components/printing/PrintQueueDropdown.tsx` | Topbar print queue dropdown with pending/failed jobs |
| `src/components/printing/PrintQueueItem.tsx` | Single print job in queue (status, retry, cancel) |
| `src/components/printing/ReceiptPreview.tsx` | Live receipt preview (monospace styled container) |
| `src/components/printing/KitchenRoutingConfig.tsx` | Station → Printer routing table configuration |
| `src/components/printing/ReceiptConfigForm.tsx` | Receipt header/footer/logo configuration form |
| `src/components/printing/TestPrintButton.tsx` | Test print button with loading/success/fail states |
| `src/components/printing/PrinterStatusBadge.tsx` | Colored status dot (green/red/yellow) with label |
| `src/components/printing/CashDrawerConfig.tsx` | Cash drawer enable/pin/pulse configuration |
| `src/components/printing/NoSaleDialog.tsx` | Reason prompt when opening cash drawer without transaction |
| `src/app/(backoffice)/settings/printers/page.tsx` | Printer settings page (back-office route) |
| `src/app/api/printing/print/route.ts` | Print job submission endpoint |
| `src/app/api/printing/printers/route.ts` | CRUD for printer configurations |
| `src/app/api/printing/printers/[id]/route.ts` | Individual printer CRUD |
| `src/app/api/printing/printers/[id]/test/route.ts` | Test print endpoint |
| `src/app/api/printing/printers/discover/route.ts` | Network printer discovery endpoint |
| `src/app/api/printing/queue/route.ts` | Print queue status and management |
| `src/app/api/printing/routing/route.ts` | Kitchen printer routing rules CRUD |
| `src/app/api/printing/cash-drawer/open/route.ts` | Cash drawer open (with no-sale logging) |
| `src/app/api/printing/receipts/[orderId]/route.ts` | Receipt data retrieval for reprint |
| `src/stores/print-queue-store.ts` | Zustand store for print queue UI state |
| `src/stores/barcode-scanner-store.ts` | Zustand store for barcode scanner state |
| `src/hooks/use-barcode-scanner.ts` | React hook for barcode scanner keyboard event listener |
| `src/hooks/use-printer-status.ts` | React hook for printer status polling |
| `scripts/print-relay/index.ts` | Local print relay Node.js service (runs on restaurant LAN) |
| `scripts/print-relay/tcp-printer.ts` | TCP connection manager for network printers |
| `scripts/print-relay/package.json` | Print relay service dependencies |

### Modified Files
| File | Changes |
|------|---------|
| `src/components/layout/Topbar.tsx` | Add print queue icon with pending count badge |
| `src/components/pos/OrderPanel.tsx` | Add "Print Check" button, barcode scanner integration for item add |
| `src/app/(pos)/payments/page.tsx` | Trigger receipt print on payment completion, cash drawer open on cash payment |
| `src/app/(pos)/orders/page.tsx` | Trigger kitchen ticket print on "Send" action, barcode scanner hook |
| `src/app/api/orders/[id]/send/route.ts` | Add kitchen ticket print trigger after order status update |
| `src/app/api/payments/route.ts` | Add receipt print trigger and cash drawer kick after payment |
| `src/hooks/use-realtime.ts` | Add listener for print failover notifications |

### Database Migrations
| Migration | Changes |
|-----------|---------|
| `add_printers` | Create `printers` table (id, location_id, name, model, connection_type, ip_address, port, role, station_id, cash_drawer_enabled, cash_drawer_pin, pulse_duration, is_active, status, last_print_at) |
| `add_printer_routing` | Create `printer_routing_rules` table (id, location_id, station_name, primary_printer_id, fallback_printer_id) |
| `add_print_jobs` | Create `print_jobs` table (id, location_id, printer_id, job_type, document_data, status, attempts, error_message, created_at, completed_at) |
| `add_cash_drawer_events` | Create `cash_drawer_events` table (id, location_id, printer_id, staff_id, terminal_id, event_type, reason, amount, created_at) |
| `add_receipt_config` | Create `receipt_config` table (id, location_id, header_text, footer_text, logo_path, show_dual_pricing, show_qr_code) |


## Acceptance Criteria

### ESC/POS Printer Driver
- [ ] ESC/POS command builder generates correct binary sequences for: text alignment, bold, double height, double width, line feed, cut, cash drawer kick
- [ ] Star Micronics adapter initializes printer correctly (TSP143IV, mPOP tested)
- [ ] Epson adapter initializes printer correctly (TM-T88VII tested)
- [ ] Printer status polling detects: online, offline, paper out, cover open — status shown in UI
- [ ] Character encoding handles standard ASCII + common special characters (accents, currency symbols)

### Receipt Printing
- [ ] Receipt prints automatically when payment is completed (card or cash)
- [ ] Receipt format shows: restaurant header (name, address, phone), order details (number, server, table, date/time), itemized list with modifiers and prices, subtotal, tax, total, dual pricing (card price + cash price), payment method, auth code, tip line (blank), signature line, footer
- [ ] Dual pricing section clearly shows both cash and card totals per Valor requirements
- [ ] Tip line and signature line print blank for "tip on receipt" model
- [ ] Configurable header (location name, address, phone), footer (custom message), and logo (bitmap)
- [ ] "Print Receipt" button available on closed order detail view for reprints
- [ ] Digital receipt option: sends formatted text via email (SendGrid) or SMS (Twilio) instead of printing

### Kitchen Ticket Printing
- [ ] Kitchen ticket prints automatically within 1 second of order being sent to kitchen
- [ ] Items route to correct station printer based on item's `prep_station` field
- [ ] Kitchen ticket format: large bold item names (double height), modifiers indented below, NO prices, course headers (FIRE/HOLD), allergen banners in BOLD DOUBLE HEIGHT
- [ ] Multi-station orders produce separate tickets at each station's printer
- [ ] Expo station printer receives complete ticket with all items from all stations
- [ ] RE-FIRE tickets print with "** RE-FIRE **" header and reason code
- [ ] VOID tickets print at station when sent item is voided — cooks stop preparing
- [ ] MODIFICATION tickets print when modifiers change after initial send

### Cash Drawer Control
- [ ] Cash drawer kicks open automatically when cash payment is processed (via printer RJ-12 kick command)
- [ ] "Open Drawer" button available for shift managers+ — prompts for reason before opening
- [ ] Every no-sale (drawer open without transaction) logged: employee, terminal, timestamp, reason
- [ ] 3+ no-sales per shift triggers manager notification
- [ ] Cash drawer configuration: enable/disable, pin selection (2 or 5), pulse duration (100-800ms)
- [ ] Cash drawer only works when assigned to a receipt printer — UI prevents orphan configuration

### Barcode Scanner Support
- [ ] Global keyboard listener detects rapid keystroke sequences (< 50ms gap) as barcode scan
- [ ] Scanned barcode/PLU matched against menu_items.plu and menu_items.barcode fields
- [ ] On POS order screen: successful scan adds item to current order with brief flash animation
- [ ] Unknown barcode shows toast: "Item not found for barcode [value]"
- [ ] Scanner input distinguished from normal keyboard typing by speed threshold

### Printer Configuration UI
- [ ] Settings > Printers page shows list of configured printers as cards
- [ ] Each printer card shows: name, model, IP/connection, role, station, status dot (green/red/yellow), last print time
- [ ] "Add Printer" wizard: step 1 (connection type), step 2 (connection details), step 3 (model selection), step 4 (role/station), step 5 (cash drawer), step 6 (test print)
- [ ] "Test Print" sends formatted test page to printer — shows success checkmark or failure X with error message
- [ ] "Scan Network" discovers printers on LAN and offers to add them
- [ ] Receipt configuration: editable header, footer, logo upload with live preview
- [ ] Kitchen routing configuration: table showing Station → Primary Printer → Fallback Printer
- [ ] Empty state: "No printers configured" with setup guide and "Add Printer" CTA

### Print Queue with Retry
- [ ] All print jobs pass through queue (Zustand store + IndexedDB persistence)
- [ ] Failed print retries: immediately, then 5s, then 15s, then shows error banner
- [ ] Print queue icon in topbar shows pending count badge (red for failures)
- [ ] Click queue icon → dropdown shows all pending/failed/recent jobs with status
- [ ] Failed jobs show "Retry" and "Cancel" buttons
- [ ] Offline: print jobs queue in IndexedDB, auto-send when printer reconnects
- [ ] KDS failover: when KDS goes down, orders auto-route to backup kitchen printer


## Workflow Tests

### Workflow 1: Complete Cash Payment with Receipt and Drawer
1. Manager configures receipt printer in Settings > Printers (Star TSP143IV at 192.168.1.50)
2. Enables cash drawer on pin 2, 200ms pulse
3. Tests print — receipt printer outputs test page
4. Server creates order for Table 5 → adds 3 items → sends to kitchen
5. Server processes cash payment ($50 tendered on $42.38 check)
6. Receipt auto-prints with all items, dual pricing, tax, total
7. Cash drawer kicks open simultaneously
8. Change displayed on screen: $7.62
9. Server closes drawer → order marked complete

### Workflow 2: Kitchen Ticket Routing — Multi-Station Order
1. Manager configures 3 kitchen printers: Grill (192.168.1.51), Sauté (192.168.1.52), Bar (192.168.1.53)
2. Sets routing: Grill Station → Grill printer, Sauté Station → Sauté printer, Bar → Bar printer
3. Sets Expo fallback printer: Grill printer
4. Server enters order: Ribeye (Grill), Pasta Carbonara (Sauté), IPA Draft (Bar)
5. Server taps "Send"
6. Within 1 second: Grill printer prints ticket with "Ribeye MR" (large, bold, no price). Sauté printer prints "Pasta Carbonara". Bar printer prints "IPA Draft".
7. Expo printer (if configured) prints complete ticket with all 3 items.
8. All tickets show: order number, table, server, time, allergen warnings if applicable.

### Workflow 3: Printer Offline — Failover and Retry
1. Kitchen has Grill printer (primary) and Sauté printer (fallback for Grill)
2. Grill printer goes offline (unplugged)
3. Server sends order with grill items
4. Print queue attempts Grill printer → fails → retries at 5s → fails → retries at 15s → fails
5. Failover: job routes to Sauté printer (configured fallback) → prints successfully
6. Error banner shows: "Grill Printer offline — jobs routed to Sauté Printer"
7. Manager reconnects Grill printer → status dot turns green → subsequent jobs route normally

### Workflow 4: Barcode Scanner Adds Item to Order
1. Manager configures barcode scanner (USB HID, no special setup needed)
2. Server starts new order on POS
3. Scans barcode on a retail item (bottled hot sauce, PLU 8847)
4. System matches PLU 8847 → "Sear House Hot Sauce" ($12.99) → adds to order with flash animation
5. Scans unknown barcode → toast appears: "Item not found for barcode 9900123"
6. Server continues building order normally via touch

### Workflow 5: No-Sale Cash Drawer Audit
1. Server taps "Open Drawer" button (visible for shift manager+ only)
2. Dialog prompts: "Reason for opening drawer?" with options: Making Change, Manager Override, Other (free text)
3. Server selects "Making Change" → drawer opens → event logged
4. Server opens drawer 2 more times in same shift (3 total no-sales)
5. Manager receives notification: "[Server Name] has 3 no-sale drawer opens this shift"
6. End-of-shift report shows all no-sale events with timestamps and reasons

### Workflow 6: Receipt Reprint and Digital Receipt
1. Guest asks for another copy of receipt from last night
2. Manager opens order history → finds Order #1032 → taps "Reprint Receipt"
3. Receipt reprints with original data (same items, prices, payment info, timestamp)
4. Different guest prefers email receipt → server taps "Email Receipt" on payment complete screen
5. Guest enters email → receipt sent via SendGrid with formatted HTML version
6. Guest receives email with itemized receipt matching printed format
