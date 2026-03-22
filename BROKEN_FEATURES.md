# Sear POS v2 -- Broken / Stub / Non-Functional Feature Audit

Audited: 2026-03-22
Scope: Every page, component, button, form, toggle, and interaction in `src/`

---

## Legend

| Status | Meaning |
|--------|---------|
| WORKS | Feature has full frontend wiring (API calls, state management, UI feedback) |
| STUB | UI exists but the action does nothing, shows "coming soon", or lacks API integration |
| BROKEN | Code exists but will error or produce incorrect behavior |
| MISSING | Feature is referenced or expected but has no implementation at all |

---

## POS Pages (`src/app/(pos)/`)

### Orders Page (`/orders`)

| Page | Feature | Status | Details |
|------|---------|--------|---------|
| Orders | Menu loads from API | WORKS | Fetches `/api/menu/categories` and `/api/menu/items` on mount |
| Orders | Add item to order (no modifiers) | WORKS | Calls `addItem()` in zustand store |
| Orders | Add item with modifiers | WORKS | Opens ModifierSheet, loads modifier groups from API, adds with selections |
| Orders | Special instructions (e.g. "no onions") | WORKS | ModifierSheet has a textarea for special instructions, stored on the order item, displayed in OrderPanel |
| Orders | Quantity +/- on order items | WORKS | OrderPanel has stepper buttons that call `updateItemQuantity` / `removeItem` |
| Orders | Send to Kitchen | WORKS | Creates order via POST `/api/orders`, adds items via POST `/api/orders/{id}/items`, then POST `/api/orders/{id}/send` |
| Orders | Order type chips (dine-in/takeout/bar) | WORKS | OrderTypeChips component updates zustand store |
| Orders | Guest count picker | WORKS | GuestCountPicker component updates store |
| Orders | Seat selector | WORKS | SeatSelector component filters items by seat |
| Orders | Hold button | WORKS | Calls POST `/api/orders/{id}/hold`, shows toast |
| Orders | Fire Course button | WORKS | Calls POST `/api/orders/{id}/fire-course` with active course number |
| Orders | Rush button | STUB | Only shows `toast.info('Rush flag set - kitchen notified')` -- no API call, no actual KDS flag |
| Orders | Discount button | STUB | Only shows `toast.info('Discount - coming soon')` -- no discount dialog, no API call |
| Orders | Print button | STUB | Only shows `toast.info('Print - coming soon')` -- no print integration |
| Orders | Void button | WORKS | Calls DELETE `/api/orders/{id}` with void_reason, clears order |
| Orders | Auto-create draft order | WORKS | Creates new order in store if none exists |
| Orders | `server_id: 'current-user'` placeholder | BROKEN | Draft orders use literal string 'current-user' as server_id instead of actual user ID from auth store |

### Tables Page (`/tables`)

| Page | Feature | Status | Details |
|------|---------|--------|---------|
| Tables | Load floor plans | WORKS | Fetches `/api/tables/floor-plans` |
| Tables | Switch floor plan tabs | WORKS | Tabs are wired to `setActiveFloorPlanId` |
| Tables | Load tables for floor plan | WORKS | Fetches `/api/tables/floor-plans/{id}` |
| Tables | Status summary bar | WORKS | Fetches `/api/tables/status-summary` |
| Tables | Section filter | WORKS | Derived from table data, filters displayed tables |
| Tables | Table color by status | WORKS | FloorPlanCanvas renders via TableShape with status colors |
| Tables | Seat guests dialog | WORKS | Opens dialog, calls POST `/api/tables/{id}/seat` |
| Tables | Clear table | WORKS | Calls POST `/api/tables/{id}/clear` |
| Tables | New order for table | WORKS | Navigates to `/orders?table_id={id}` |
| Tables | View existing order | WORKS | Navigates to `/orders?order_id={id}` |
| Tables | Edit mode (drag tables) | WORKS | Tracks position changes, bulk-saves via PATCH `/api/tables/bulk-update` |
| Tables | Add table in edit mode | WORKS | Dialog with name/capacity/shape, POST `/api/tables` |
| Tables | Delete table in edit mode | WORKS | Confirm dialog, DELETE `/api/tables/{id}` |
| Tables | Create floor plan (empty state) | WORKS | POST `/api/tables/floor-plans` with name |
| Tables | Real-time table updates | WORKS | `useRealtimeTables` hook subscribes to Supabase realtime |
| Tables | Table popover (hover details) | WORKS | TablePopover shows server, guest count, seated time |

### Payments Page (`/payments`)

| Page | Feature | Status | Details |
|------|---------|--------|---------|
| Payments | Payment method selection | WORKS | Grid with card/cash/gift card/split/house account |
| Payments | Card processing | WORKS | Calls POST `/api/payments/process`, handles approved/declined states |
| Payments | Cash tender | WORKS | CashTender component with numpad, calculates change, calls API |
| Payments | Tip selection (card) | WORKS | TipSelector with percentage buttons and custom amount, calls POST `/api/payments/tip-adjust` |
| Payments | Receipt options | STUB | Shows Print/Email/Text/None buttons but `handleReceiptChoice` does nothing -- comment says "In production: trigger print/email/SMS here" |
| Payments | Gift card payment | STUB | Goes directly to receipt prompt without actually calling any gift card API (no balance check, no redemption) |
| Payments | House account payment | STUB | Goes to receipt prompt without calling house account charge API |
| Payments | Split payment | STUB | Redirects to `/checks` -- no actual split payment flow |
| Payments | Payment complete auto-redirect | WORKS | 3-second auto-redirect back to orders |

### Checks Page (`/checks`)

| Page | Feature | Status | Details |
|------|---------|--------|---------|
| Checks | Load open orders | WORKS | Fetches `/api/orders?status=open,fired,ready,served` |
| Checks | Select order from list | WORKS | Sets `selectedOrder` state, highlights card |
| Checks | Equal split buttons (2-8) | STUB | Buttons render but have **no onClick handler** -- clicking does nothing |
| Checks | Split by Seat button | STUB | Button renders but has **no onClick handler** -- no API call to `/api/orders/{id}/split` |
| Checks | Start Custom Split button | STUB | Button renders but has **no onClick handler** -- no drag-and-drop implementation |
| Checks | Print Check button | STUB | Button renders but has **no onClick handler** -- no print integration |
| Checks | Process Payment button | STUB | Button renders but has **no onClick handler** -- doesn't navigate to payments page |

---

## Backoffice Pages (`src/app/(backoffice)/`)

### Menu Manager (`/menu`)

| Page | Feature | Status | Details |
|------|---------|--------|---------|
| Menu | Load categories | WORKS | Fetches `/api/menu/categories` |
| Menu | Create category | WORKS | POST `/api/menu/categories` |
| Menu | Delete category | WORKS | DELETE `/api/menu/categories/{id}` |
| Menu | Reorder categories | WORKS | PATCH `/api/menu/categories/reorder` with optimistic update |
| Menu | Load items | WORKS | Fetches `/api/menu/items` |
| Menu | Add item (sheet) | WORKS | POST `/api/menu/items` with full form data |
| Menu | Edit item (sheet) | WORKS | PATCH `/api/menu/items/{id}` |
| Menu | Delete item | WORKS | DELETE `/api/menu/items/{id}` |
| Menu | Toggle 86 (sold out) | WORKS | PATCH `/api/menu/items/{id}/86` with optimistic update |
| Menu | Reorder items | WORKS | PATCH `/api/menu/items/reorder` |
| Menu | Search items | WORKS | Client-side filter by `searchQuery` |
| Menu | Allergen entry | WORKS | ItemDetailSheet "Extras" tab has toggleable allergen pills (gluten, dairy, nuts, shellfish, soy, eggs, fish, sesame). Saved in `allergens` array field |
| Menu | Item description | WORKS | Textarea in Details tab |
| Menu | Price and cost fields | WORKS | Input fields with dollar prefix |
| Menu | Category assignment | WORKS | Dropdown select in Details tab |
| Menu | Prep station / course | WORKS | Dropdown selects in Details tab |
| Menu | Prep time | WORKS | Number input |
| Menu | Taxable toggle | WORKS | Switch component |
| Menu | PLU code / barcode | WORKS | Text inputs in Extras tab |
| Menu | Link modifier groups to item | WORKS | Modifiers tab shows checkboxes, saves via POST `/api/menu/items/{id}/modifier-groups` |
| Menu | Create modifier group | WORKS | ModifierGroupManager with full CRUD |
| Menu | Edit/delete modifier group | WORKS | Full CRUD via API |
| Menu | Item images / image upload | MISSING | `image_url` field exists in the database schema and API accepts it, but there is **no image upload UI** anywhere in the ItemDetailSheet. No file picker, no URL input, no image preview. The field is completely absent from the edit form |
| Menu | Short name (KDS label) | WORKS | Input field in Details tab |

### Staff Manager (`/staff`)

| Page | Feature | Status | Details |
|------|---------|--------|---------|
| Staff | Load roster | WORKS | Fetches `/api/staff` |
| Staff | Search staff | WORKS | Client-side filter |
| Staff | Add staff member | WORKS | Sheet with form, POST `/api/staff` |
| Staff | Edit staff member | WORKS | Sheet pre-populated, PATCH `/api/staff/{id}` |
| Staff | Deactivate staff | WORKS | DELETE `/api/staff/{id}` with confirmation |
| Staff | Set/update PIN | WORKS | PIN field in create/edit form |
| Staff | Role assignment | WORKS | Select dropdown with all roles |
| Staff | Hourly rate | WORKS | Number input |
| Staff | Hire date | WORKS | Date input |
| Staff | Clock in (from Time Clock tab) | MISSING | Time Clock tab shows entries and can **clock out** and **approve** time entries, but there is **no clock-in button** in the UI. Clock-in API endpoint exists (`/api/staff/{id}/clock-in`) but no UI triggers it. The sidebar shows a static "Clocked In" indicator that is always green regardless of actual status |
| Staff | Clock out | WORKS | Time Clock tab has "Clock Out" button calling POST `/api/staff/{id}/clock-out` |
| Staff | Approve time entry | WORKS | POST `/api/staff/time-entries/{id}/approve` |
| Staff | Edit time entry | WORKS | Sheet with clock in/out datetime pickers, PATCH `/api/staff/time-entries/{id}` |
| Staff | Tips tab | WORKS | Loads tip data, shows by-staff breakdown, distribute button |
| Staff | Tip distribution | WORKS | POST `/api/staff/tips/distribute` |

### Settings

| Page | Feature | Status | Details |
|------|---------|--------|---------|
| Settings | Organization settings | WORKS | Loads and saves org name, legal name, owner info, timezone, currency, brand color via API |
| Settings | Locations | WORKS | Full CRUD for locations with address, phone, email, hours |
| Settings | Tax rates | WORKS | Full CRUD for tax rates with name, rate percentage, active toggle |
| Settings | Terminals | WORKS | List terminals, generate registration codes, edit names |
| Settings | Roles/permissions | WORKS | Full CRUD for custom roles with permission toggles |
| Settings | Accounting integration | WORKS | QuickBooks/Xero OAuth connect, disconnect, mapping fields, sync trigger |
| Settings | Modules page | WORKS | Toggle switches call PATCH `/api/settings/modules`, dependency checking works |
| Settings | Module "Configure" buttons | WORKS | Most navigate to correct pages. Modules without a dedicated page show `toast.info('No configuration page for {name}')`. Navigation targets: pos->/orders, menu->/menu, tables->/tables, etc. |

### Reports (`/reports`)

| Page | Feature | Status | Details |
|------|---------|--------|---------|
| Reports | Dashboard | WORKS | Fetches daily/hourly/payments/category-mix/pmix APIs. Falls back to mock data on error |
| Reports | KPI cards | WORKS | Total sales, orders, avg check, labor % with period-over-period change |
| Reports | Charts (hourly, payment mix, category, top items) | WORKS | Recharts-based, wired to API or mock data |
| Reports | Date range picker | WORKS | Preset buttons (today/yesterday/this week/this month) and custom range |
| Reports | Export button | WORKS | Opens `/api/reports/export?type=daily` in new tab |
| Reports | Sales sub-report | WORKS | Line chart + data table with gross/net/discounts/tax, date range picker |
| Reports | Labor sub-report | WORKS | Fetches `/api/reports/labor` |
| Reports | Product mix sub-report | WORKS | Scatter chart from `/api/reports/pmix` |
| Reports | Server performance | WORKS | Table from `/api/reports/server-performance` |
| Reports | Mock data fallback | WORKS | All reports show realistic mock data when API returns empty. Clear "Sample data" label displayed |

### Customers (`/customers`)

| Page | Feature | Status | Details |
|------|---------|--------|---------|
| Customers | List with pagination | WORKS | Fetches `/api/customers` with page/limit/sort params |
| Customers | Search (debounced) | WORKS | Client-side with 300ms debounce |
| Customers | Sortable columns | WORKS | last_name, total_visits, total_spend, last_visit_at |
| Customers | Create customer | WORKS | Dialog with name/email/phone, handles 409 duplicate detection |
| Customers | View detail sheet | WORKS | Fetches `/api/customers/{id}`, shows profile, orders, tags |
| Customers | Edit notes/tags/VIP status | WORKS | PATCH `/api/customers/{id}` |
| Customers | View order history | WORKS | Fetches `/api/customers/{id}/orders` |
| Customers | Delete customer | WORKS | DELETE `/api/customers/{id}` with confirmation |
| Customers | Merge duplicates | WORKS | Search secondary, POST `/api/customers/merge` |

### Reservations (`/reservations`)

| Page | Feature | Status | Details |
|------|---------|--------|---------|
| Reservations | List reservations by date | WORKS | Fetches `/api/reservations` with date and status filters |
| Reservations | Date navigation (prev/next day) | WORKS | Buttons update `selectedDate` |
| Reservations | Status filter | WORKS | Dropdown filters by pending/confirmed/seated/etc. |
| Reservations | Create reservation | WORKS | Dialog with full form (name, phone, email, party size, date, time, notes, special requests), POST `/api/reservations` |
| Reservations | Confirm reservation | WORKS | POST `/api/reservations/{id}/confirm` |
| Reservations | Seat reservation | WORKS | POST `/api/reservations/{id}/seat` |
| Reservations | Cancel reservation | WORKS | DELETE `/api/reservations/{id}` |
| Reservations | Availability slots | WORKS | Fetches `/api/reservations/availability` |
| Reservations | Waitlist tab | WORKS | Fetches `/api/reservations/waitlist`, add/notify/seat/cancel actions |
| Reservations | Add to waitlist | WORKS | Dialog with name/phone/party size/quoted wait, POST `/api/reservations/waitlist` |

### Other Backoffice Pages

| Page | Feature | Status | Details |
|------|---------|--------|---------|
| Inventory | Items CRUD | WORKS | Full inventory item management with search, categories, stock tracking, count adjustments |
| Inventory | Purchase orders | WORKS | Create PO, add line items, receive, reconcile |
| Inventory | Vendors | WORKS | CRUD for vendors with payment terms |
| Inventory | Recipes | WORKS | Link menu items to inventory ingredients |
| Loyalty | Programs CRUD | WORKS | Create/edit loyalty programs with earn/redeem rules |
| Loyalty | Accounts list | WORKS | Search, view balances, transactions |
| Loyalty | Manual adjust points | WORKS | POST `/api/loyalty/accounts/{id}/adjust` |
| Marketing | Campaigns CRUD | WORKS | Create/edit/delete campaigns (email/SMS/push) |
| Marketing | Send campaign | WORKS | POST `/api/marketing/campaigns/{id}/send` |
| Marketing | Segment builder | WORKS | Min visits + tags criteria, count matching customers |
| Marketing | Analytics tab | WORKS | Fetches `/api/marketing/analytics`, shows KPIs and performance table |
| Online Ordering | Order queue | WORKS | Fetch, accept, reject with reason |
| Online Ordering | Menu config | WORKS | Create menus, toggle active, view items |
| Online Ordering | Settings (throttle) | WORKS | Max orders per 15min/hour, pause toggle, save |
| Online Ordering | Create menu placeholder | BROKEN | Uses hardcoded `location_id: "00000000-0000-0000-0000-000000000000"` which will fail on any DB with foreign key constraints |
| Delivery | Zones CRUD | WORKS | Create/edit delivery zones with fees and estimated times |
| Delivery | Active deliveries | WORKS | List, assign driver, update status |
| Drive-Thru | Orders + metrics | WORKS | Queue management, menu boards, lane times |
| Drive-Thru | Create order placeholder | BROKEN | Uses hardcoded `location_id: "00000000-0000-0000-0000-000000000000"` |
| Catering | Events CRUD | WORKS | Create/edit catering events with contact, budget, deposits |
| Catering | Menus CRUD | WORKS | Create catering menus with pricing per head |
| Catering | Calendar view | WORKS | Fetches `/api/catering/calendar` |
| Catering | Create event placeholder | BROKEN | Uses hardcoded `location_id: "00000000-0000-0000-0000-000000000000"` |
| Franchise | Locations overview | WORKS | Fetch franchise locations, sync |
| Franchise | Royalties | WORKS | Calculate, list, update royalties |
| Franchise | Reports | WORKS | Cross-location reporting |
| House Accounts | Accounts CRUD | WORKS | Create/edit accounts with credit limits, billing info |
| House Accounts | Charge to account | WORKS | POST `/api/house-accounts/{id}/charge` |
| House Accounts | Record payment | WORKS | POST `/api/house-accounts/{id}/payment` |
| House Accounts | Generate statement | WORKS | GET `/api/house-accounts/{id}/statement` |
| Scheduling | Weekly schedule | WORKS | Create/edit/delete shifts, view by week |
| Scheduling | Swap requests | WORKS | Create, approve, reject swap requests |
| Scheduling | Staff availability | WORKS | Set availability by user |
| Scheduling | Schedule templates | WORKS | CRUD for reusable schedule templates |

---

## Fullscreen Pages (`src/app/(fullscreen)/`)

### KDS (`/kds`)

| Page | Feature | Status | Details |
|------|---------|--------|---------|
| KDS | Load stations | WORKS | Fetches `/api/kds/stations` |
| KDS | Station tabs | WORKS | Switch between stations |
| KDS | Load tickets | WORKS | Fetches `/api/kds/tickets` |
| KDS | Ticket display with aging colors | WORKS | KdsTicket with KdsTimer, color changes by age |
| KDS | Bump ticket | WORKS | POST `/api/kds/tickets/{id}/bump` |
| KDS | Bump all | WORKS | POST `/api/kds/tickets/bump-all` |
| KDS | Recall drawer | WORKS | KdsRecallDrawer fetches bumped tickets, recall via POST `/api/kds/tickets/{id}/recall` |
| KDS | All-Day counts | WORKS | KdsAllDay overlay shows item counts |
| KDS | Sound toggle | STUB | Toggle button works (stores state) but sound only logs to console -- no actual audio playback (`console.log('[KDS] Sound: ...')`) |
| KDS | Real-time updates | WORKS | `useRealtimeKds` and `useRealtimeTable` hooks for live ticket updates |
| KDS | Auto-dark mode | WORKS | Adds `dark` class to HTML on mount, removes on unmount |

---

## Auth Pages (`src/app/(auth)/`)

| Page | Feature | Status | Details |
|------|---------|--------|---------|
| Login | Email/password login | WORKS | POST `/api/auth/login`, sets auth store, redirects to /orders |
| Login | Form validation | WORKS | react-hook-form with required fields, email pattern |
| Login | Error display with shake | WORKS | Server errors shown in banner with shake animation |
| Login | Link to PIN login | WORKS | Navigates to `/pin-login` |
| PIN Login | Staff avatar grid | WORKS | Fetches `/api/staff/active`, displays name + colored avatar |
| PIN Login | Numpad entry | WORKS | 4-digit PIN with auto-submit on last digit |
| PIN Login | PIN verification | WORKS | POST `/api/auth/pin-login` |
| PIN Login | Brute-force lockout display | WORKS | Shows countdown timer when `locked_until` returned |
| PIN Login | Keyboard support | WORKS | Number keys, backspace, escape to switch user |
| Register | Terminal registration | WORKS | 6-digit code entry, POST `/api/terminals/activate`, stores terminal ID |
| Register | Add to Home Screen instructions | WORKS | Platform-specific instructions for iOS/Android |

---

## Layout & Navigation

| Page | Feature | Status | Details |
|------|---------|--------|---------|
| Sidebar | Navigation links | WORKS | All links render and navigate correctly (POS, Management, Modules, Admin sections) |
| Sidebar | Expand/collapse | STUB | Sidebar is **hard-coded** per layout: `collapsed` on POS pages, `collapsed={false}` on backoffice pages. There is a `toggleSidebar` function in `ui-store.ts` but **no UI element** (button/toggle) to trigger it. Users cannot manually collapse or expand the sidebar |
| Sidebar | "Clocked In" indicator | STUB | Shows a green clock icon with "Clocked In" text at the bottom of the sidebar, but this is **always static** -- it doesn't read from any store or API. It says "Clocked In" regardless of actual clock status |
| Topbar | Live clock | WORKS | Updates every 60 seconds |
| Topbar | Connection status | STUB | Always shows green dot + "Connected" -- not wired to any actual connection monitoring |
| Topbar | User display | STUB | Always shows "Demo User" -- not reading from auth store |
| Topbar | Settings gear link | WORKS | Navigates to `/settings` |
| Topbar | Breadcrumbs | STUB | Only shows "Home / Dashboard" regardless of current page -- not dynamic |

---

## Component-Level Issues

### Modifier Sheet (`src/components/pos/ModifierSheet.tsx`)

| Feature | Status | Details |
|---------|--------|---------|
| Modifier selection (toggle) | WORKS | Correctly handles single/multi selection per group |
| Required group validation | WORKS | `isValid` checks `min_selections` for required groups, disables "Add to Order" button when not met |
| Max selections enforcement | WORKS | Returns early when max reached (won't add more) |
| Running total display | WORKS | Shows base price + modifier price sum |
| Special instructions textarea | WORKS | 500 char limit, passed to `onAddToOrder` |

### Payment Components

| Feature | Status | Details |
|---------|--------|---------|
| PaymentMethodGrid | WORKS | 6 buttons: card, cash, gift card, split, house account, digital wallet |
| CashTender numpad | WORKS | Quick-amount buttons + numpad, calculates change |
| TipSelector | WORKS | Percentage buttons (18/20/22/25%) + custom amount |
| CardProcessing mock | WORKS | Calls real API, handles approved/declined with animations |
| ReceiptOptions | STUB | 4 buttons (print/email/text/none) fire `onSelect` but parent does nothing with the choice |
| PaymentComplete | WORKS | Shows summary + auto-redirects |

---

## Cross-Cutting Issues

| Issue | Status | Details |
|-------|--------|---------|
| No cash drawer page | MISSING | No `/cash-drawer` page exists despite being mentioned in CLAUDE.md project structure. No cash drawer count, denomination breakdown, or drawer kick functionality |
| No receipt printing anywhere | MISSING | Receipt printing is completely unimplemented. The ReceiptOptions component captures the user's choice but nothing happens. No ESC/POS generation, no browser print, no connection to Star Micronics or any printer |
| No customer display page | MISSING | No `/customer-display` route exists in the Next.js app. The CLAUDE.md mentions it but it is not built |
| No kiosk page | MISSING | No `/kiosk` route exists. Mentioned in CLAUDE.md but not built |
| Reports use mock data by default | WORKS | Reports correctly attempt to fetch real API data and fall back to realistic mock data. This is acceptable for demo/dev |
| 3 pages use placeholder location_id | BROKEN | Online Ordering, Drive-Thru, and Catering all hardcode `location_id: "00000000-0000-0000-0000-000000000000"` when creating records, which will fail with FK constraints in production |
| Auth store permission check incomplete | STUB | `src/stores/auth-store.ts` line 67: `// TODO: Check against user's permission list when loaded` -- `hasPermission()` always returns true |
| No image upload for menu items | MISSING | Database schema has `image_url` column, API accepts it, but no UI for uploading or setting images |
| No actual audio for KDS | STUB | Sound toggle works but only `console.log` -- no Audio API or sound file |

---

## Summary Counts

| Status | Count |
|--------|-------|
| WORKS | ~130 features |
| STUB | 18 features |
| BROKEN | 4 features |
| MISSING | 6 features |

### Critical Stubs (user-facing, would be noticed immediately)

1. **Discount button** on POS -- shows "coming soon" toast
2. **Print button** on POS -- shows "coming soon" toast
3. **All split check buttons** -- 5 buttons (equal 2-8, by seat, custom) do literally nothing on click
4. **Print Check and Process Payment** on checks page -- buttons with no handlers
5. **Receipt delivery** -- print/email/text choice is captured but never acted on
6. **Sidebar collapse toggle** -- no UI to trigger it
7. **Clock-in button** -- missing from staff Time Clock tab (can only clock out)
8. **Topbar user name** -- always says "Demo User"

### Critical Missing Features

1. **Cash drawer management** -- entire page missing
2. **Receipt/ticket printing** -- no implementation anywhere
3. **Customer display** -- entire page missing
4. **Kiosk self-ordering** -- entire page missing
5. **Menu item image upload** -- no UI exists
6. **KDS audio alerts** -- no sound files or Audio API usage

### Broken Code

1. `server_id: 'current-user'` literal string instead of actual user ID
2. Three pages with `location_id: "00000000-..."` placeholder UUIDs
3. `hasPermission()` always returns true (TODO comment)
4. Topbar breadcrumbs always show "Home / Dashboard" regardless of route
