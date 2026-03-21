# Sear POS — User Manual

**The Copper Vine Demo Restaurant**
**https://getsear.com**

---

## 1. Getting Started

### System Requirements

- **Device:** iPad (10th gen or newer recommended), iPad Pro, or iPad Air. The system also works on any modern tablet or laptop with a web browser.
- **Browser:** Safari (iPad), Chrome, Firefox, or Edge. Safari on iPad is the primary supported browser.
- **Internet:** A stable Wi-Fi connection. The system requires internet access to sync orders, process payments, and update the kitchen display.
- **Screen orientation:** Landscape mode is required for the POS and KDS screens.

### Accessing the System

1. Open Safari (or your browser) on your iPad.
2. Navigate to **https://getsear.com**.
3. You will see the Sear POS login screen with the Sear logo, an email field, and a password field.

### Demo Credentials

The Copper Vine demo comes pre-loaded with two accounts:

| Account | Email | Password | PIN | Role |
|---------|-------|----------|-----|------|
| Demo Owner | demo@getsear.com | demo1234 | 0000 | Owner |
| Admin | ian@cyberactiveconsulting.com | SearAdmin2026! | 1234 | Owner |

Use either account to explore the full system with all permissions.

### Screen Layout Overview

Sear POS uses three different layouts depending on where you are:

**POS Layout** (order entry, payment, checks): A collapsed sidebar on the left (icons only), a compact top bar, and a full-screen content area. No scrolling. Designed for touch on iPad in landscape mode.

**Back Office Layout** (reports, menu manager, staff, settings): An expanded sidebar on the left with text labels, a top bar with breadcrumbs, and a scrollable content area. Designed for management tasks.

**Fullscreen Layout** (KDS, login, clock-in, customer display, kiosk): No sidebar, no top bar. The entire screen is dedicated to the content. Used for kitchen displays and public-facing screens.

The **sidebar** (visible on POS and Back Office screens) contains navigation links:
- POS (order entry)
- Tables (floor plan)
- Checks (open check management)
- KDS (kitchen display)
- Reports
- Menu (menu manager)
- Staff
- Settings

The **top bar** shows your name, your role, and provides access to notifications and account settings.

---

## 2. Logging In

### Email Login (Manager / Owner Login)

This is the primary login method for managers and owners who need full system access.

1. Open **https://getsear.com** in your browser.
2. You will see the login screen with the Sear POS logo and "Sign in to your account."
3. In the **Email** field, type your email address (e.g., `demo@getsear.com`).
4. In the **Password** field, type your password (e.g., `demo1234`).
5. Tap the **Sign In** button.
6. If the credentials are correct, you will be taken directly to the POS order entry screen.
7. If the credentials are wrong, the login card will shake and display a red error message: "Invalid email or password."

Below the login form, you will see a **Forgot Password?** link if you need to reset your password, and a **Staff PIN Login** link at the bottom of the page for quick staff access.

### PIN Login (Quick Staff Access)

PIN login is designed for front-of-house staff who need fast access without typing an email and password. This is what servers, bartenders, hosts, and cooks use at the start of their shift.

1. From the email login screen, tap **Staff PIN Login** at the bottom.
2. The PIN login screen appears with two halves:
   - **Left side:** A grid of staff avatars. Each avatar shows the employee's initials, first name, and role (e.g., "Server," "Manager").
   - **Right side:** A numeric PIN pad with 6 dots at the top showing how many digits you have entered.
3. Tap your avatar on the left side. Your avatar will highlight with a teal ring.
4. Enter your 4-to-6-digit PIN using the number pad on the right. The dots fill in as you type.
5. The system auto-submits after 4 digits. If your PIN is longer (5 or 6 digits), it submits after you finish.
6. If the PIN is correct:
   - If you are already clocked in, you go straight to the POS screen.
   - If you are not clocked in, you go to the Clock In screen.
7. If the PIN is wrong, the dots turn red and shake. The PIN clears so you can try again. The message "Wrong PIN. Try again." appears.
8. At the bottom of the PIN pad, there is a **Manager Login** link to go back to the email login screen.

### Clock In / Clock Out

After logging in via PIN, if you are not yet clocked in, you will see the Clock In screen. This screen shows:

- A large clock displaying the current time (updated every second).
- Your clock-in status: "Not Clocked In," "Clocked In since [time]," or "On Break since [time]."

**To Clock In:**
1. Tap the large green **Clock In** button.
2. A success message appears: "Clocked in successfully."
3. Your status changes to "Clocked In since [current time]."
4. A **Go to POS** button appears. Tap it to start taking orders.

**To Clock Out:**
1. Tap the large red **Clock Out** button.
2. A message appears: "Clocked out. Have a good one."
3. Your status returns to "Not Clocked In."
4. You must end your break before clocking out. The Clock Out button is disabled while you are on break.

### Starting / Ending a Break

While clocked in, you can start and end breaks:

1. Tap the **Start Break** button (below the Clock Out button).
2. Your status changes to "On Break since [time]."
3. When your break is over, tap the **End Break** button.
4. Your status returns to "Clocked In" and you can continue working.

To switch to a different user, tap the **Switch User** link at the bottom of the clock-in screen.

---

## 3. The POS Screen (Order Entry)

The POS screen is where you take orders. It is the screen you will use most during service.

### Understanding the Layout

The POS order entry screen has three main areas:

**Top Bar (56px tall):** Runs across the top of the screen.
- **Left side:** Hamburger menu icon (toggles the sidebar), order type selector (colored pill showing Dine-In, Takeout, Delivery, or Bar), and the table number or customer name.
- **Right side:** Your avatar/initials, your name, a guest count button (person icon with a number), and a settings gear icon.

**Left Panel (320-360px wide):** The order panel.
- **Header:** Shows "Current Order" with the order number (e.g., #1042), and a row of seat selector buttons (All, 1, 2, 3, etc.).
- **Items list:** Scrollable list of items added to the current order.
- **Totals section:** Shows Subtotal, Discount (if any, in green), Tax, and Total (large and bold).
- **Action buttons:** A large green "Send to Kitchen" button (or blue "Update Order" if already sent), and a gray "Hold" button.

**Center Panel (remaining width):** The menu grid.
- **Category tabs (48px):** Horizontal scrollable row of category buttons. Each has a colored dot and category name (e.g., Appetizers, Entrees, Sides, Desserts, Cocktails, Wine).
- **Menu items grid:** 2-4 columns of menu item cards depending on screen width. Each card shows the item name, price, and dietary icons.
- **Search bar:** At the bottom of the grid area. Type to search for any menu item by name.
- **Quick Actions Bar (56px):** Runs along the very bottom. Contains buttons for Hold, Fire, Rush, Discount, Print, and Void.

### Selecting Order Type

The order type determines how the order is handled. It appears as a colored pill in the top bar.

1. Tap the order type pill in the top bar (it defaults to "Dine-In" in blue).
2. A dropdown menu appears with four options:
   - **Dine-In** (blue) — Standard table service.
   - **Takeout** (amber) — Guest picks up the order.
   - **Delivery** (violet) — Order is delivered.
   - **Bar** (emerald) — Bar tab or bar seat order.
3. Tap the order type you want. The pill color changes to match.

For Dine-In and Bar orders, a table selector appears in the top bar. For Takeout and Delivery, the customer name appears instead (or "Walk-in" if no name is entered).

### Starting a New Order

1. Make sure you are on the POS screen (tap the POS icon in the sidebar).
2. Select the order type (Dine-In, Takeout, etc.) using the dropdown in the top bar.
3. If Dine-In or Bar, tap the table number in the top bar to open the table picker. Select a table.
4. Set the guest count by tapping the person icon in the top bar. A grid of numbers 1-12 appears. Tap the number of guests.
5. Start adding items from the menu grid.

### Browsing Menu Categories

1. Look at the category tab bar across the top of the center panel.
2. Each category has a colored dot and a name. For example, at The Copper Vine:
   - Appetizers
   - Salads & Soups
   - Entrees
   - Sides
   - Desserts
   - Cocktails
3. Tap a category to filter the menu grid. Only items in that category will show.
4. The selected category tab gets a white background with a subtle shadow. All other tabs remain plain text.
5. Scroll the category bar left or right if there are more categories than fit on screen.

### Adding Items to an Order

1. Find the item in the menu grid. For example, tap the "Ribeye" card ($48).
2. The item appears in the order panel on the left.
3. If the item has required modifiers (like steak temperature), a modifier slide-over panel opens from the right. See the Modifiers section below.
4. If the item has no required modifiers, it is added immediately with a quantity of 1.
5. The order panel updates: the item name, quantity (1x), price, and any modifiers appear. The subtotal, tax, and total recalculate.

### Using Modifiers

Some items require you to make choices before they can be added to the order. When you tap one of these items, a modifier panel slides in from the right side of the screen, covering the menu grid.

For example, when you tap "Ribeye" ($48):
1. The modifier panel appears with the title "Ribeye" and a group called "Temperature."
2. You see options: Rare, Medium Rare, Medium, Medium Well, Well Done.
3. Tap one option (e.g., "Medium Rare"). It highlights.
4. If there are more modifier groups (e.g., "Add-ons" like truffle butter +$6), scroll down and make selections.
5. Some groups require exactly 1 selection (e.g., temperature). Others allow multiple (e.g., add-ons).
6. The panel shows validation requirements (e.g., "Choose exactly 1" or "Choose up to 3").
7. When all required selections are made, tap the **Add to Order** button at the bottom of the panel.
8. The modifier panel slides away and the item (with modifiers) appears in the order panel.

**Common modifier examples at The Copper Vine:**
- Steak temperature: Rare / MR / Med / MW / Well
- Wings sauce: Buffalo / BBQ / Garlic Parm / Lemon Pepper
- Burger add-ons: Extra Cheese +$2, Bacon +$3, Fried Egg +$2, Avocado +$3
- Side choice: Fries / House Salad / Soup du Jour

### Adding Special Instructions to Items

1. Tap an item that is already in the order panel on the left.
2. An edit popover appears near the item. This small card (280px wide) has options for the item.
3. Look for a "Special Instructions" or "Notes" text field.
4. Type your instruction (e.g., "No onions," "Extra crispy," "Allergy: gluten").
5. Tap outside the popover or tap "Done" to close it.
6. The special instructions appear below the item in the order panel in smaller text.

### Assigning Items to Seats

Seat assignment lets the kitchen and server know which guest at the table ordered which item. This matters for serving food to the right person without auctioning plates.

1. Look at the seat selector buttons in the order panel header: "All, 1, 2, 3, 4..." up to the guest count.
2. **Before adding an item,** tap the seat number button for the guest you are currently ordering for. The selected seat button turns blue.
3. Now add items from the menu. Each item you add will be assigned to that seat.
4. Switch seats by tapping a different number. Add that guest's items.
5. Tap "All" to see all items from all seats.
6. If you forget to set the seat, you can reassign after: tap the item in the order panel, and use the edit popover to change its seat assignment.

### Editing Item Quantity

1. Tap the item in the order panel on the left.
2. The edit popover appears.
3. Use the +/- buttons or quantity field to change the count (e.g., from 1 to 3).
4. The price updates (e.g., 3x Ribeye = $144).
5. Tap outside the popover to close it.

### Removing an Item Before Sending

If the order has not yet been sent to the kitchen:

1. Tap the item in the order panel.
2. In the edit popover, tap the **Remove** or trash icon button.
3. The item disappears from the order.
4. No manager approval is needed because the kitchen has not started making it yet.

### Sending the Order to the Kitchen

1. After adding all items for the table, review the order in the left panel.
2. Check the total at the bottom.
3. Tap the large green **Send to Kitchen** button at the bottom of the order panel.
4. The items are transmitted to the Kitchen Display System (KDS).
5. The button text changes to "Update Order" (blue) since the order has already been sent.
6. Items in the order panel may show a "sent" indicator (they can no longer be freely removed without manager approval).

### Adding More Items After Sending (Second Round)

Guests often order another round of drinks or additional courses after the initial order.

1. With the same order open, browse the menu and add new items.
2. New items appear in the order panel below the already-sent items.
3. Tap the blue **Update Order** button to send only the new items to the kitchen.
4. The kitchen sees a new ticket with just the additional items, marked with the same table number.

### Holding an Order

Sometimes you need to save an order without sending it to the kitchen yet (e.g., the table is still deciding).

1. Add items to the order panel.
2. Instead of tapping "Send to Kitchen," tap the gray **Hold** button below it (or the Hold button in the quick actions bar at the bottom).
3. The order is saved but NOT sent to the kitchen.
4. You can come back to it later by selecting the table or check.

### Firing a Course

If coursing is enabled (Settings > Order Settings > Coursing Enabled), items can be assigned to courses that fire to the kitchen at different times.

1. Tap the **Fire** button in the quick actions bar at the bottom of the POS screen.
2. A dialog appears showing held courses.
3. Select the course number you want to fire (e.g., "Fire Course 2 — Entrees").
4. The kitchen KDS receives those items with a "FIRE" indicator.

### Rushing an Order

If a table has been waiting too long or a VIP needs priority:

1. Tap the **Rush** button (amber, lightning bolt icon) in the quick actions bar.
2. The kitchen KDS shows a red "RUSH" banner on the ticket for this order.
3. The kitchen knows to prioritize this order.

---

## 4. Table Management

### Accessing the Floor Plan

1. Tap the **Tables** icon in the sidebar (it looks like a grid of squares).
2. The Table Management screen appears.

### Floor Plan View vs. List View

The table management screen has two tabs at the top:

**Floor Plan** (default): A visual map of your restaurant showing tables as positioned shapes. Tables are square, rectangular, round, or booth-shaped. Bar seats are small circles. You can see the physical layout of your dining room, bar, and patio.

**List View**: A spreadsheet-style table showing all tables in rows with columns for Table number, Section, Capacity, Status, Server, Guests, Time, and Amount. Tap any column header to sort. Useful when you need a quick overview without the visual layout.

### Understanding Table Colors and Statuses

Each table on the floor plan is color-coded by its current status:

| Color | Status | Meaning |
|-------|--------|---------|
| White with gray border | **Available** | Table is clean and ready for guests |
| Light blue with blue border | **Seated** | Guests are seated, no order yet |
| Light purple with purple border | **Ordered** | Order has been placed and sent to kitchen |
| Light green with green border | **Served** | Food has been delivered to the table |
| Light orange with orange border | **Check Presented** | The check has been given to the guest |
| Light red with red border | **Dirty** | Guests have left, table needs clearing |
| Gray with dashed border | **Reserved** | Table is held for an upcoming reservation |
| Red, pulsing | **Needs Attention** | Something requires immediate action |

Each table shape shows:
- The **table number** in large bold text (e.g., "12").
- The **guest count / capacity** below (e.g., "3/4" meaning 3 guests at a 4-seat table).
- The **elapsed time** since seating (e.g., "42m") if the table is occupied.

### Seating a Table

1. On the floor plan, find an available table (white).
2. Tap the table.
3. A detail popover appears showing the table number, its status ("Available"), and the capacity.
4. Tap the green **Seat** button.
5. Enter the guest count when prompted.
6. The table status changes to "Seated" (blue) and the timer starts.
7. You can now go to the POS screen and start taking the order for this table.

### Viewing Table Details

1. Tap any occupied table on the floor plan.
2. The detail popover shows:
   - Table number and status badge
   - Time since seating (e.g., "Seated 42m ago")
   - Assigned server name
   - Guest count / capacity
   - A summary of ordered items (first 3 items, then "+X more")
   - Running check total
   - Last activity description
3. Action buttons appear at the bottom of the popover based on the table's status.

### Moving an Order to a Different Table

If guests want to move to a different table:

1. Tap the occupied table on the floor plan.
2. In the detail popover, tap **Move**.
3. Select the destination table from the floor plan or a list.
4. The order, guest count, and all order data transfer to the new table.
5. The old table reverts to "Available" or "Dirty."

### Transferring a Table to Another Server

When a server's shift ends or sections are reassigned:

1. Tap the occupied table on the floor plan.
2. In the detail popover, tap **Transfer**.
3. Select the server who should take over from a list of clocked-in servers.
4. The receiving server gets a notification.
5. All order data, guest notes, and allergy alerts stay with the table.

### Clearing a Table After Payment

After guests have paid and left:

1. Tap the table (which should show "Check Presented" or "Dirty" status).
2. In the detail popover, tap **Clear**.
3. The table returns to "Available" (white).
4. The turn time is logged for reporting.

### Using Sections

Above the floor plan, you will see section filter chips: **All**, **Dining Room**, **Bar**, **Patio**, etc.

1. Tap a section chip to filter the floor plan to show only tables in that section.
2. The selected chip turns teal.
3. Tap "All" to show all tables again.

### Edit Mode (Rearranging Tables — Manager Only)

Managers can rearrange the physical layout of tables on the floor plan.

1. Tap the **Edit Mode** button in the upper-right corner of the table management screen.
2. The button turns amber and the background changes to a yellow grid with dots (snap points).
3. Drag tables to new positions on the grid.
4. Tap **Done Editing** to save the new layout.
5. All staff devices will see the updated floor plan.

---

## 5. Check Management

### Accessing the Checks Screen

1. Tap the **Checks** icon in the sidebar.
2. The Checks screen appears with a list of all open checks.

### Viewing Open Checks

The checks screen has:

**Tab bar** across the top with filter tabs: Open, My Checks, Bar Tabs, Closed (with counts in parentheses).

**Check list** on the left: Each row shows:
- Table name or "TO #[number]" for takeout
- Order type badge (Dine-In in blue, Takeout in amber, etc.)
- Server name, guest count, and elapsed time
- Check total on the right side

**Search bar** in the header lets you search by table number, server name, or check number.

### Viewing Check Details

1. Tap any check in the list.
2. The right panel opens showing the full check detail:
   - **Header:** Table name, check number, and an Actions dropdown.
   - **Seat filter strip** on the left edge: Buttons for "All" and individual seats (Seat 1, Seat 2, etc.).
   - **Items grouped by seat:** Each seat shows its ordered items with quantities, modifiers, and prices. Voided items appear with a strikethrough and a red "VOID" badge.
   - **Totals:** Subtotal, Discount (if any), Tax, and Total.
   - **Action buttons:** "Add Items" (returns to POS to add more), "Split Check," and "Pay Now."

### Splitting a Check

There are three ways to split a check:

**By Seat:**
1. On the check detail panel, tap **Split Check**.
2. The split modal appears.
3. Tap the **By Seat** method tab.
4. The system automatically creates one check per seat, with each seat's items assigned to their check.
5. Review the split, then tap **Confirm Split & Pay All**.

**Equal Split:**
1. Tap **Split Check**, then select the **Equal Split** tab.
2. Enter the number of ways to split (e.g., 4).
3. The total is divided evenly. Each check shows its share.
4. Tap **Confirm Split & Pay All**.

**Custom Split:**
1. Tap **Split Check**, then select the **Custom** tab.
2. The system shows all unassigned items on the left and check columns on the right (Check A, Check B, etc.).
3. Drag items from the unassigned list into the appropriate check column.
4. Tap **+ Add Check** (the dashed outline card) to create additional checks.
5. Shared items (like appetizers) can be split: tap the item and choose "Split equally" across selected checks.
6. Each check column shows its running total.
7. When all items are assigned (unassigned count = 0), tap **Confirm Split & Pay All**.

### Merging Checks

If two checks need to be combined (e.g., guests at separate tables decide to pay together):

1. Open the Checks screen.
2. Select the first check.
3. From the Actions dropdown, select an option to merge.
4. Select the second check to merge into the first.
5. All items combine into a single check.

### Applying a Discount to a Check

1. Select the check in the check list.
2. Tap the **Actions** dropdown in the check detail header.
3. Tap **Apply Discount**.
4. Choose a discount type (percentage off, fixed amount, or a pre-configured discount like "Military 10%").
5. Enter the discount amount or select from the list.
6. Manager PIN may be required depending on the discount amount and your role.
7. The discount appears in green on the totals section.

### Comping an Item or Check

A comp removes the charge while keeping the item on the check (for tracking purposes).

1. Select the check.
2. Tap the **Actions** dropdown.
3. Tap **Comp Check** for the whole check, or tap individual items to comp them.
4. Enter a manager PIN when prompted.
5. Select a reason code (Food Quality, Service Recovery, Manager Comp, etc.).
6. The comped amount appears on the check and in void/comp reports.

### Adding Auto-Gratuity

1. Select the check.
2. Tap the **Actions** dropdown.
3. Tap **Add Gratuity**.
4. Enter the gratuity percentage or amount.
5. Auto-gratuity can be configured to apply automatically for large parties (see Settings).

---

## 6. Processing Payments

### Accessing the Payment Screen

From the POS order entry screen or the Checks screen:

1. Tap the **Pay Now** button on the check detail panel, or navigate to the payment screen directly.
2. The Payment screen has two panels:
   - **Left:** Check summary showing all items, modifiers, subtotal, discount, tax, total, and balance due.
   - **Right:** The payment flow area (changes based on the current step).

### Payment Methods

The Payment screen shows four large tiles for payment methods:

- **Card** — Credit or debit card via the Valor payment terminal.
- **Cash** — Cash tendered by the guest.
- **Gift Card** — House gift cards with balance lookup.
- **House Acct** — Charge to a house account (for regulars with pre-approved accounts).

Below the tiles, a "Split payment" section offers: **Equal Split**, **By Item**, and **Custom**.

### Processing a Card Payment

1. Tap the **Card** tile.
2. The screen changes to "Card Waiting" mode with a pulsing card icon and the message "Insert, tap, or swipe card."
3. The amount due displays in large bold text.
4. The guest inserts, taps, or swipes their card on the Valor payment terminal.
5. The screen changes to "Processing..." with a spinning indicator.
6. If approved, a green checkmark appears with "Approved."
7. The system then advances to the tip prompt.

### The Tip Prompt

After a card payment is approved:

1. The tip prompt screen shows "Add a tip?" with the pre-tax subtotal.
2. Three suggested tip buttons appear in a row:
   - **18%** — shows the calculated dollar amount (e.g., $8.64)
   - **20%** — shows the calculated dollar amount (e.g., $9.60)
   - **22%** — shows the calculated dollar amount (e.g., $10.56)
3. Below the suggestions: **Custom** (enter a specific dollar amount) and **No Tip**.
4. Tap a percentage button — it highlights in blue.
5. Tap **Continue** to proceed.
6. If you tap **Custom**, a numpad appears. Enter the tip amount and tap **Confirm Tip**.

### Receipt Options

After the tip is confirmed:

1. The receipt prompt appears: "Receipt?"
2. Four tiles offer receipt delivery options:
   - **Print** — Prints a paper receipt to the connected receipt printer.
   - **Email** — An email input field appears. Type the email address and tap **Send Receipt**.
   - **Text** — A phone number input field appears. Type the number and tap **Send Receipt**.
   - **No Receipt** — Skips the receipt entirely.
3. After selecting, the screen shows a green checkmark with "Thank you!" and automatically returns to the order screen.

### Processing a Cash Payment

1. Tap the **Cash** tile.
2. The Cash Entry screen appears showing:
   - Total Due in bold.
   - An "Amount Tendered" display (large numbers, starting at $0.00).
   - Quick amount buttons (e.g., $20, $50, $100, Exact) for common denominations.
   - A full numpad for entering a custom amount.
3. Enter the amount the guest is handing you:
   - Tap a quick amount button (e.g., $50 for a $43.27 check), OR
   - Use the numpad to type the exact amount, OR
   - Tap **Exact** to auto-fill the exact amount due.
4. The **Tender Cash** button is disabled (grayed out) if the entered amount is less than the amount due. It enables when the amount is equal to or greater than the amount due.
5. Tap **Tender Cash**.
6. If overpaid, the Change Due screen appears showing the change amount in very large green text (e.g., "$6.73"), with the note "Cash drawer opened."
7. Tap **Print Receipt** if needed, then tap **Done**.

### Processing a Gift Card Payment

1. Tap the **Gift Card** tile.
2. The Gift Card screen appears with an input field: "Scan or enter card number."
3. Scan the gift card barcode or type the card number manually.
4. Tap **Look Up Balance**.
5. The system displays the available balance:
   - If the balance covers the full check: the balance appears in green, and the button says "Pay Full Amount."
   - If the balance is less than the check: the balance appears in amber with a note showing the remaining amount due (e.g., "Remaining $37.43 due after applying"). The button says "Apply $45.00" (the full gift card balance).
6. Tap the apply button.
7. If there is a remaining balance, you return to the payment method selection to pay the rest with card or cash.

### Split Payments (Part Card, Part Cash)

Example: A $127.43 check paid with a $45 gift card, $40 cash, and the remainder on a credit card.

1. On the Payment screen, tap **Gift Card**.
2. Scan the gift card. Balance: $45.00.
3. Tap **Apply $45.00**. Balance due updates to $82.43.
4. The system returns to the payment method screen with the new balance due shown.
5. Tap **Cash**. Enter $40.00 using the numpad. Tap **Tender Cash**. Balance due updates to $42.43.
6. Tap **Card**. Process $42.43 on the card reader.
7. The check is now fully paid. Each payment method is recorded separately for reconciliation.

### Voiding a Payment (Before End of Day)

If a payment was made in error and the day has not been closed:

1. Find the check in the Checks screen (switch to "Closed" tab).
2. From the Actions dropdown, select **Reopen**.
3. Manager PIN required.
4. Process the void through the payment screen or the Actions menu.
5. The void is logged with the manager's name, reason, and timestamp.

### Refunding a Payment (After End of Day)

If the payment has been settled (after day close):

1. Find the transaction in Reports or through the Checks screen.
2. A refund processes through the Valor payment terminal.
3. Manager PIN and reason code are required.
4. Refunds appear in the daily report under voids/refunds.

---

## 7. Voids and Comps

### Voiding an Item (Before Sending to Kitchen)

Any server can do this. No manager approval needed.

1. On the POS order entry screen, tap the item in the order panel on the left.
2. In the edit popover, tap the **Remove** or delete button.
3. The item is removed from the order immediately.
4. The totals recalculate.

### Voiding an Item (After Sending to Kitchen — Requires Manager PIN)

Once an order has been sent to the kitchen, the item cannot be freely removed. A manager must approve.

1. Tap the item in the order panel.
2. Tap **Void**.
3. The system prompts: "This item was sent to the kitchen. Manager approval required."
4. A manager enters their PIN on the numpad that appears.
5. Select a **reason code** (required — you cannot proceed without one):
   - Food Quality (overcooked, undercooked, cold)
   - Wrong Item Sent
   - Never Received
   - Guest Changed Mind
   - Allergy Concern
   - Service Recovery
   - Other (with free text)
6. Optionally add notes for context.
7. The system asks: "Re-fire replacement? (Y/N)"
   - If yes, a new item goes to the kitchen as a priority re-fire.
   - If no, the item is simply removed from the check.
8. The voided item appears on the check with a strikethrough and red "VOID" badge.

### Voiding an Entire Order

1. On the POS screen, tap the **Void** button (red, with X icon) in the quick actions bar.
2. Manager PIN required.
3. Select a reason code.
4. The entire order is voided. All items show as voided.
5. The table reverts to "Seated" status (or "Available" if the guests have left).

### Comping an Item (With Reason Code)

A comp is different from a void: the item stays on the check at $0 (for tracking food cost), rather than being removed entirely.

1. Tap the item in the order panel or check detail.
2. Tap **Comp**.
3. Manager PIN required.
4. Select a reason code: Food Quality, Service Recovery, Manager Comp, Promo, Owner Comp, etc.
5. Optionally add notes.
6. The item shows on the check at $0.00 with a "COMP" label.
7. The total recalculates.

### Comping an Entire Order

1. On the Checks screen, select the check.
2. From the Actions dropdown, tap **Comp Check**.
3. Manager PIN required.
4. Select a reason code.
5. All items on the check are comped to $0.00.

### Manager PIN Approval Process

Certain actions across the system require a manager PIN:

- Post-send voids
- Discounts above a threshold
- Price overrides
- Time card adjustments
- Cash drawer access (not your own)
- Refunds above a threshold
- Reopening closed checks
- Deleting orders
- Changing table assignments

When a manager PIN is required:
1. A dark overlay appears with a numpad and the message "Manager Approval Required."
2. A manager enters their 4-6 digit PIN.
3. The system verifies the PIN belongs to a user with manager or owner role.
4. If valid, the action proceeds.
5. If invalid, "Wrong PIN" appears and you can retry.
6. After too many failed attempts, the system locks out PIN entry briefly.

---

## 8. Kitchen Display System (KDS)

### Accessing the KDS Screen

1. Tap the **KDS** icon in the sidebar.
2. The KDS display takes over the full screen with a dark background (dark gray/near-black).
3. This screen is designed to be displayed on a dedicated iPad or screen in the kitchen.

### Understanding the KDS Layout

**Header bar (48px, dark):** Runs across the top.
- **Left:** Station name (e.g., "KDS -- Grill" or "KDS -- Expo").
- **Center:** All-Day summary — a scrolling row showing aggregate item counts across all active tickets (e.g., "4 Ribeye, 3 Caesar, 2 Burger").
- **Right:** Three buttons:
  - **Sound On/Off** — Toggles the audible alert for new tickets.
  - **All Day** — Opens the All-Day count panel.
  - **Recall** — Opens the recently bumped tickets panel.

**Ticket area (remaining height):** A horizontally scrolling row of ticket cards. Each ticket is a fixed-width card (about 1/6 of the screen on a 12.9" iPad). The tickets scroll left to right, with the oldest ticket on the left.

### Understanding Ticket Layout

Each ticket card shows:

- **Rush banner** (if applicable): A red bar across the top with "RUSH."
- **Header:** Order number (e.g., "#1042"), order type badge (Dine-In, Takeout, Delivery), elapsed timer (e.g., "8:32"), and server name.
- **Items section:** Large, bold item names with modifiers, removals (in red, prefixed with "NO"), special instructions (amber background), and allergen alerts (red background with warning icon, e.g., "PEANUT ALLERGY").
- **Course dividers** (if coursing is enabled): Horizontal lines with "COURSE 2" and a status badge (HOLD or FIRE).
- **Bump button:** A large green bar at the very bottom reading "BUMP."

### Ticket Aging and Colors

Tickets change color as they age to alert the kitchen to long wait times:

| Age | Color | Meaning |
|-----|-------|---------|
| 0-8 minutes | White (fresh) | Normal pace |
| 8-15 minutes | Amber/yellow | Getting slow |
| 15-20 minutes | Light red | Late |
| 20+ minutes | Red, pulsing | Critical — immediate attention needed |

The thresholds are configurable in Settings > Notifications > KDS Aging Alert Threshold.

### Bumping a Ticket (Marking as Done)

When the kitchen has completed all items on a ticket:

1. Tap the green **BUMP** button at the bottom of the ticket.
2. The ticket slides upward and fades out.
3. The ticket is removed from the active display and added to the "Recently Bumped" list.
4. The server is notified that the food is ready.

**Keyboard shortcut:** Press the **Spacebar** to bump the oldest (leftmost) ticket.

### Recalling a Bumped Ticket

If a ticket was bumped by mistake or needs to be re-checked:

1. Tap the **Recall** button in the KDS header bar (or press **R** on a keyboard).
2. A panel slides up from the bottom showing recently bumped ticket cards.
3. Each card shows the order number, when it was bumped (e.g., "Bumped 2m ago"), and a preview of the items.
4. Tap a card to recall that ticket back to the active display.
5. Tap **Close** or tap outside the panel to dismiss it.

### All-Day View (Aggregate Item Counts)

The All-Day view shows how many of each item are currently needed across all active tickets. This helps the kitchen manage prep and station workload.

1. Tap the **All Day** button in the KDS header bar (or press **A** on a keyboard).
2. A panel slides in from the right showing a list:
   - Item name (left column)
   - Total count (center, large teal number)
   - Modifier breakdown (right column)
3. For example: "Ribeye — 4 — 2 MR, 1 Med, 1 MW"
4. Tap **Close** or tap outside the panel to dismiss it.

### Allergen Alerts

When an order contains items with allergen notes:

- The ticket shows a bright red allergen alert bar with a warning icon: "PEANUT ALLERGY" (or whatever the allergen is).
- This alert appears inline within the ticket items, directly below the relevant item.
- The alert cannot be dismissed or hidden.
- Kitchen staff should follow allergy preparation protocols.

### Sound Alerts

- When a new ticket arrives, an audible alert plays (if sound is enabled).
- Toggle sound on/off using the **Sound On/Off** button in the KDS header.
- When sound is on, the button appears in teal. When off, it appears in gray.

---

## 9. 86ing Items

### What 86 Means

"86" is restaurant industry shorthand for "out of stock" or "unavailable." When the kitchen runs out of an ingredient or dish, it is "86'd" — removed from the menu so servers can no longer order it.

### How to 86 an Item

1. Open the **Menu Manager** (Menu icon in the sidebar).
2. Find the item in the menu tree on the left panel. For example, find "Grilled Salmon" under Entrees.
3. Click the item to select it. The item editor appears in the center panel.
4. In the top-right corner of the editor, find the **availability toggle**.
5. The toggle shows "Available" (green) or "86'd (Out of Stock)" (red).
6. Tap the toggle to switch it to red/86'd.
7. Tap **Save Changes**.

Alternatively, if you have the right permissions:
1. On the KDS or from a management iPad, use the 86 function.
2. The item is instantly marked as unavailable across all devices.

### How 86'd Items Appear on POS Terminals

- On the POS order entry screen, 86'd items show a red **86'd** badge overlay on the menu grid card.
- The item is still visible in the menu but cannot be added to an order.
- If a server tries to tap an 86'd item, nothing happens (or an alert explains the item is unavailable).
- Servers receive a notification when an item is 86'd: "Salmon has been 86'd."
- If a server has an unsent order containing a newly 86'd item, they receive an alert to remove or substitute it.

### How to Un-86 an Item (Bring It Back)

1. Open the **Menu Manager**.
2. Find the 86'd item (it will have a red "86'd" badge in the tree).
3. Click the item.
4. Toggle the availability switch back to "Available" (green).
5. Tap **Save Changes**.
6. The item immediately becomes orderable on all POS devices.

---

## 10. Staff Management

### Accessing the Staff Manager

1. Tap the **Staff** icon in the sidebar.
2. The Staff Management screen appears with two tabs: **Roster** and **Time Clock**.

### Viewing the Staff Roster

The Roster tab shows a table with columns:
- **Name** — Employee's full name
- **Role** — Color-coded badge (Manager in purple, Server in blue, Bartender in amber, Host in gray, Cook in orange, Busser in teal)
- **Status** — Green dot for Active, gray dot for Inactive
- **Phone** — Phone number
- **Last Clock-In** — Date and time of most recent clock-in
- **Actions** — Arrow button to open the detail panel

Use the **search field** at the top to find an employee by name.
Use the **role dropdown** to filter by role (e.g., show only Servers).

### Adding a New Staff Member

1. Tap the **Add Employee** button in the upper-right corner of the Roster tab.
2. A detail panel slides in from the right side of the screen.
3. Fill in the fields:
   - **First Name** (required)
   - **Last Name** (required)
   - **Role** — Select from: Manager, Server, Bartender, Host, Cook, Busser, Custom.
   - **PIN** — Enter a 4-6 digit PIN for quick login. Tap "Show" to see the PIN. This is what the employee will use at the PIN login screen.
   - **Phone** — Phone number (optional).
   - **Email** — Email address (optional, required if they will use email login).
   - **Pay Rate** — Enter the hourly or salary rate. Select "Hourly" or "Salary" from the dropdown.
   - **Locations** — Check the box for each location where this employee can work.
4. Tap **Save**.
5. The employee appears in the roster and can immediately log in.

### Setting Roles and Permissions

The detail panel has a **Permissions** section with expandable groups:

- **Orders:** Create orders, Modify orders, Void items (MGR), Apply discounts (MGR)
- **Payments:** Process payments, Issue refunds (MGR), No-sale drawer open (MGR)
- **Reports:** View own stats, View all reports (MGR), Export reports (MGR)
- **Menu:** View menu, Edit menu (MGR), 86 items
- **Staff:** View staff, Edit staff (MGR)
- **Settings:** Access settings (MGR)

Items marked "MGR" (in a purple badge) are typically only given to managers.

1. Expand a permission group by tapping its header.
2. Check or uncheck individual permissions.
3. Tap **Save** to apply.

### Setting a PIN for Quick Login

1. On the staff detail panel, find the **PIN** field.
2. Enter a 4-6 digit number (e.g., "2468").
3. Tap **Show** to verify the PIN is correct.
4. Tap **Save**.
5. The employee can now use this PIN at the PIN login screen.

### Deactivating a Staff Member

Deactivated employees cannot log in. Their historical data (time entries, tips, orders) is preserved.

1. Open the staff detail panel for the employee.
2. Tap the red **Deactivate** button at the bottom.
3. Confirm the deactivation.
4. The employee's status changes to "Inactive" (gray dot).

### Time Clock: Viewing Time Entries

1. Switch to the **Time Clock** tab on the Staff Management screen.
2. You see a table showing all clock-in/out records for the selected date range.
3. Columns: Employee, Date, Clock In, Clock Out, Hours, Overtime, Break, Tips.
4. Rows highlighted in amber indicate overtime.
5. Rows highlighted in red have a missing punch (no clock-out).
6. The footer row shows totals for hours, overtime, breaks, and tips.
7. Use the **date range picker** to change the time period.
8. Use the **employee dropdown** to filter to a specific employee.

### Editing a Time Entry (Manager)

If a clock-in or clock-out time needs correction:

1. Find the time entry in the Time Clock table.
2. Click the entry to open its detail.
3. Edit the clock-in or clock-out time.
4. Manager PIN required for changes.
5. Save the correction. The edit is logged in the audit trail.

### Exporting Time Clock Data

1. On the Time Clock tab, set the date range and employee filter.
2. Tap **Export CSV** to download the data as a spreadsheet.
3. Tap **Print** to print the time clock report.

---

## 11. Tip Management

### How Tip Suggestions Work

When a guest pays with a card, the tip prompt screen shows three suggested percentages: **18%, 20%, and 22%** by default. Each shows the calculated dollar amount based on the pre-tax subtotal.

For example, on a $48.00 subtotal:
- 18% = $8.64
- 20% = $9.60
- 22% = $10.56

Guests can also enter a custom amount or select "No Tip."

The suggested percentages are configurable in Settings > Order Settings > Tip Suggestions.

### Auto-Gratuity for Large Parties

Auto-gratuity can be applied automatically based on party size.

**Configuration (Settings > Order Settings):**
1. Toggle **Auto-Gratuity** on.
2. Set the **Party Size Threshold** (e.g., 6 guests).
3. Set the **Percentage** (e.g., 18%).

**How it works during service:**
- When a check is presented for a party at or above the threshold, the auto-gratuity is added as a line item.
- It appears on the check as "Service Charge" or "Gratuity."
- If a guest disputes it, a manager can remove it (manager PIN required, reason code logged).

### Adjusting a Tip After Close

Tips can be adjusted after the check is closed (e.g., if the guest wrote a different tip amount on the signed receipt):

1. Find the closed check in the Checks screen (Closed tab).
2. Open the check details.
3. Access the tip adjustment function through the Actions menu.
4. Enter the corrected tip amount.
5. The tip adjustment window is configurable (typically 24-48 hours).

### Tip Distribution

Sear POS supports multiple tip distribution models:

- **Direct:** Tips go entirely to the server who earned them.
- **Pool:** Tips are pooled and distributed according to configurable rules (e.g., 70% to servers, 15% to bussers, 10% to runners, 5% to host).
- **Points:** Tips are distributed based on a point system per role.

Tip distribution is configured in Settings and calculated automatically.

### Cash Tip Reporting

Cash tips are not automatically tracked by the system. Servers declare cash tips at clock-out:

1. During clock-out, the system may prompt: "Declare cash tips?"
2. The server enters the total cash tips received during their shift.
3. This data is recorded for tax reporting (IRS Form 8027 compliance).

---

## 12. Reports

### Accessing Reports

1. Tap the **Reports** icon in the sidebar.
2. You must be logged in as a manager or owner to view reports. Servers can only see their own performance stats.

### Reports Dashboard

The main reports screen shows:

**Left sidebar (240px):** Navigation with report categories:
- Dashboard (default)
- Sales
- Labor
- Product Mix
- Server Performance
- Voids & Comps
- Cash
- Speed of Service

**Top bar:** A date range picker (preset options like Today, Yesterday, This Week, Last Week, This Month, or Custom) and Export buttons (CSV, PDF).

**KPI Cards (4 across the top):**
- **Total Sales** — Big dollar amount with a percentage change vs. the comparison period (green arrow up or red arrow down).
- **Orders** — Total order count with percentage change.
- **Avg Check** — Average check size with percentage change.
- **Labor %** — Labor cost as a percentage of sales with percentage change.

**Charts:**
- **Hourly Sales** — A line chart showing sales by hour from 6am to 11pm. Teal line with a shaded area underneath.
- **Sales by Category** — A pie chart breaking down revenue by food/drink categories (e.g., Entrees, Appetizers, Cocktails, Wine).
- **Payment Methods** — A donut chart showing the split between Card, Cash, Gift Card, etc.

### Daily Sales Summary

The default dashboard view. See the KPI cards and charts described above. This is the report managers check every night to see how the day went.

Key metrics:
- Total gross sales and net sales (after discounts and voids)
- Guest count and per-cover average
- Sales comparison vs. same day last week or last year

### Hourly Sales Breakdown

Visible in the Hourly Sales chart on the dashboard. Shows which hours generated the most revenue. Helps with staffing decisions (e.g., lunch rush vs. late-night).

### Product Mix (PMIX) and Menu Engineering

Navigate to **Product Mix** in the reports sidebar.

This report shows every menu item with:
- Quantity sold
- Revenue generated
- Food cost percentage
- Gross profit

Items are categorized as:
- **Stars** — High profit, high volume (promote these)
- **Plowhorses** — Low profit, high volume (consider price increase)
- **Puzzles** — High profit, low volume (consider better placement)
- **Dogs** — Low profit, low volume (consider removing)

Use this report to make menu decisions: what to keep, what to remove, what to reprice.

### Server Performance Rankings

Navigate to **Server Performance** in the reports sidebar.

Shows per-server metrics:
- Total sales
- Number of covers served
- Average check size
- Average tip percentage
- Table turn time
- Void/comp count and value

Ranked by total sales, tip percentage, or average check.

### Labor Report

Navigate to **Labor** in the reports sidebar.

Shows:
- Total labor hours worked
- Total labor cost
- Labor cost as a percentage of sales (target: 25-35% depending on your concept)
- Overtime alerts
- Scheduled vs. actual hours
- Staffing efficiency (sales per labor hour)

### Voids, Comps, and Discounts Report

Navigate to **Voids & Comps** in the reports sidebar.

This is your loss-prevention report. Review it every night.

Shows:
- Every void: item, amount, server who rang it, manager who approved, reason code, time
- Every comp: same details
- Every discount: type, amount, server, authorization
- Total void/comp/discount value and percentage of sales
- Server-by-server breakdown (to identify patterns)

### Cash Management Report

Navigate to **Cash** in the reports sidebar.

Shows:
- Opening cash drawer count
- Cash sales during the shift
- Cash payments received
- Safe drops
- Expected vs. actual cash in drawer
- Over/Short amount

### Speed of Service Report

Navigate to **Speed of Service** in the reports sidebar.

Shows:
- Average ticket time (order sent to kitchen to order completed)
- By station (e.g., Grill 14 min, Saute 11 min, Fry 7 min)
- By daypart (lunch vs. dinner)
- Outliers (tickets over 25 minutes)

### Exporting Reports

On any report screen:

1. Tap **Export CSV** to download the report data as a CSV spreadsheet file. The CSV can be opened in Excel or Google Sheets.
2. Tap **Export PDF** to generate a printable PDF version of the report.

### Comparing Periods

The date range picker supports period comparison:

1. Select your date range (e.g., "This Week").
2. Enable the comparison toggle.
3. Choose a comparison mode: "Previous period," "Same period last year," etc.
4. KPI cards will show percentage changes between the selected period and the comparison period.

---

## 13. Menu Management (Back Office)

### Accessing the Menu Manager

1. Tap the **Menu** icon in the sidebar.
2. The Menu Manager opens with a three-panel layout:
   - **Left (280px):** Menu tree — a collapsible hierarchy of Menus > Categories > Items.
   - **Center:** Item editor form.
   - **Right (240px):** Live preview card showing how the item appears on the POS.

### Understanding the Menu Tree

The left panel shows your menu structure. For The Copper Vine demo:

```
Food Menu
  Appetizers (6 items)
    Wings         $16
    Calamari      $15
    Bruschetta    $14
    ...
  Salads & Soups (4 items)
    Caesar Salad  $14
    ...
  Entrees (8 items)
    Ribeye        $48
    Copper Vine Burger $19
    Grilled Salmon $34
    ...
  Sides (4 items)
  Desserts (4 items)

Drink Menu
  Cocktails (6 items)
  Wine (6 items)
  Beer (4 items)
```

- Click the arrow next to a category to expand/collapse it.
- Click an item name to select it and load it in the editor.
- Items that are 86'd show a red "86'd" badge.
- Drag the grip icon (6 dots) next to items or categories to reorder them.

### Creating a Category

1. At the bottom of the menu tree panel, tap **+ New Category**.
2. A modal appears.
3. Enter the **Category Name** (e.g., "Appetizers" or "Specials").
4. Select the **Menu Type**: Food, Drink, or Other.
5. Tap **Create**.
6. The category appears in the menu tree.

### Creating a Menu Item

1. At the bottom of the menu tree panel, tap **+ New Item**.
2. The center panel loads a blank item editor form.
3. Fill in the fields:

**Item Name** (required): The name as it appears on the POS and menu (e.g., "Copper Vine Burger").

**Short Name (KDS Display)**: An abbreviated name for kitchen tickets (e.g., "CV BURGER"). Max 20 characters.

**Description**: The menu description (e.g., "8oz Angus patty, aged cheddar, house pickles, brioche bun").

**Price** (required): The menu price in dollars. Enter "19.00" for $19.

**Happy Hour Price**: An alternate price during happy hour. Leave blank if no HH pricing.

**Cost Price**: Your cost to make this item. Used for food cost calculations in reports.

**Category**: Select from the dropdown (e.g., "Entrees").

**Tax Class**: Select the applicable tax rate (e.g., "Food Tax 8.5%").

**Modifier Groups**: Check the boxes to link modifier groups to this item. For example:
- "Temperature" (for steaks — Rare / MR / Med / MW / Well)
- "Add-ons" (Bacon +$3, Avocado +$3, Fried Egg +$2)
- "Side Choice" (Fries, House Salad, Soup du Jour)

**Dietary Tags**: Tap to toggle tags like Vegetarian, Vegan, Gluten-Free, Dairy-Free.

**Allergen Tags**: Tap to toggle allergens like Peanuts, Tree Nuts, Shellfish, Dairy, Gluten, Soy, Eggs, Fish, Sesame.

**Image**: Drag and drop a photo, or tap the image area to upload one. Tap "Remove" to delete.

**Availability — Dayparts**: Check which dayparts this item is available (Breakfast, Lunch, Happy Hour, Dinner, Late Night). If none are checked, the item is available all day.

**Availability — Days**: Check which days of the week this item is available.

4. Tap **Save Changes**.
5. The item appears in the menu tree under its assigned category.
6. The Live Preview panel on the right shows a card preview of how the item looks on the POS, updating in real-time as you edit.

### Creating Modifier Groups

Modifier groups define the choices available for items (e.g., steak temperature, burger add-ons).

1. In the item editor, find the "Modifier Groups" section.
2. Tap **Manage Modifier Groups** at the bottom.
3. A modal appears.
4. Enter the **Group Name** (e.g., "Temperature").
5. Choose the **Selection Type**:
   - **Choose Exactly 1** — Guest must pick one option (e.g., steak temp).
   - **Choose Up To N** — Guest can pick up to N options (e.g., up to 3 toppings).
   - **Choose At Least N** — Guest must pick at least N options.
6. Set **Min Selections** and **Max Selections** if applicable.
7. Add options to the **Options** list:
   - Each option has a **Name** (e.g., "Medium Rare"), a **Price** (e.g., $0.00 for temps, $3.00 for add-ons), and a **Default** checkbox.
   - Tap **+ Add Option** to add more.
   - Drag the grip icon to reorder options.
   - Tap the red X to delete an option.
8. Tap **Save Group**.

### Adding Modifiers with Price Adjustments

When creating modifier options, enter a price if the modifier costs extra:

- Temperature options (Rare, MR, Med, MW, Well): Price = $0.00 each (no upcharge).
- Add-ons (Bacon, Avocado, Fried Egg): Price = $3.00, $3.00, $2.00 respectively.
- Side upgrades (Upgrade to truffle fries): Price = $4.00.

### Linking Modifiers to Menu Items

1. Open the item in the editor.
2. In the "Modifier Groups" section, check the box next to each group you want.
3. For example, link "Temperature" and "Add-ons" to the Ribeye.
4. Tap **Save Changes**.
5. Now when a server taps "Ribeye" on the POS, the modifier panel will open with those groups.

### Editing an Existing Item

1. Click the item in the menu tree.
2. The editor loads with all current values.
3. Make changes.
4. Tap **Save Changes**.

### Reordering Items and Categories

1. In the menu tree, hover over (or press and hold on iPad) the grip icon (6 dots) next to an item or category.
2. Drag it up or down to a new position.
3. The new order is saved automatically.
4. The order you set here is the order items appear on the POS menu grid.

### Deleting Items

1. Select the item in the menu tree.
2. In the editor, tap **Delete Item** (red text, bottom-right of the form).
3. Confirm the deletion.
4. The item is soft-deleted: it is removed from the POS menu but preserved in historical data for reporting.

---

## 14. Settings

### Accessing Settings

1. Tap the **Settings** icon (gear) in the sidebar.
2. The Settings screen has a navigation sidebar on the left with sections:
   - Location
   - Tax Rates
   - Terminals
   - Order Settings
   - Notifications
   - Integrations
   - Modules

### Location Settings

Controls your restaurant's basic information:

- **Restaurant Name:** Displayed on receipts and the system header.
- **Address:** Your restaurant's address.
- **Timezone:** Select Eastern, Central, Mountain, Pacific, Alaska, or Hawaii.
- **Business Hours:** For each day of the week, set Open/Closed status and the opening and closing times.
- **Logo:** Upload your restaurant's logo (used on receipts and the customer display).
- **Receipt Header:** Custom text printed at the top of receipts (up to 4 lines).
- **Receipt Footer:** Custom text printed at the bottom of receipts (e.g., "Thank you for dining with us!").

Tap **Save Location Settings** after making changes.

### Tax Rate Configuration

Manage sales tax rates:

1. The tax rates table shows: Name, Rate (%), Inclusive toggle, Applies To, and Actions.
2. Tap **Add Tax Rate** to create a new rate.
3. To edit a rate, tap the pencil icon. Fields become editable.
4. Set:
   - **Name** (e.g., "City Sales Tax")
   - **Rate** (e.g., 8.5%)
   - **Inclusive** — Check if tax is included in the menu price (not added on top).
   - **Applies To** — All Items, Food Only, Beverage Only, or Alcohol Only.
5. Tap the checkmark to save.
6. Tap the trash icon to delete a rate.

### Terminal Setup

Configure each iPad/terminal in your restaurant:

Each terminal card shows:
- **Terminal Name** (e.g., "Bar iPad 1")
- **Status badge:** Online (green) or Offline (gray)
- **Type:** iPad, KDS Station, or Kiosk
- **Payment Reader:** Select the connected Valor terminal model (VP800, VP550, VP300 Pro, RCKT) or None.
- **Default Order Type:** The order type that auto-selects when using this terminal (Dine In, Takeout, Bar, Delivery).
- **Auto-Lock Timeout:** Minutes of inactivity before the terminal locks and requires a PIN.
- **Assigned Printer:** Select which receipt printer this terminal uses.

Tap **Save** on each terminal card after changes.

### Order Settings

Configure how orders behave:

- **Enabled Order Types:** Check/uncheck Dine-In, Takeout, Delivery, Bar. Unchecked types will not appear as options on the POS.
- **Auto-Gratuity:** Toggle on/off. Set the party size threshold (e.g., 6) and the percentage (e.g., 18%).
- **Tip Suggestions:** Set three percentage values for the tip prompt (default: 18%, 20%, 25%).
- **Require Seat Numbers:** Toggle on to force servers to assign items to seats.
- **Coursing Enabled:** Toggle on to enable course-based firing (Course 1, Course 2, etc.).

Tap **Save Order Settings** after changes.

### Notification Settings

- **KDS New Order Sound:** Toggle on/off. Plays an audible alert on KDS screens when new orders arrive.
- **KDS Aging Alert Threshold:** Set the number of minutes before a ticket triggers an aging alert (default: 10 minutes).
- **Push Notifications:** Toggle on/off for order update push notifications.

Tap **Save Notifications** after changes.

### Module Management

Modules are optional features that can be enabled or disabled:

Each module card shows:
- Module name and description
- Price label (if applicable)
- An on/off toggle switch
- A "Configure" link (visible when enabled)

Toggle modules on or off based on your needs. Some modules include KDS, Online Ordering, Loyalty, and Inventory.

### Integrations

Shows the status of third-party integrations:

- **Online Ordering** — Accept orders from your website
- **Payment Processor** — Valor PayTech (shows "Connected" if configured)
- **QuickBooks** — Accounting sync
- **DoorDash** — Delivery marketplace

Each card shows whether the integration is Connected or Not Connected. Tap **Configure** to set up credentials and settings.

---

## 15. Daily Operations

### Opening the Restaurant

Follow these steps at the start of each business day:

1. **Managers arrive first.** Log in using email + password at https://getsear.com.
2. **Count the starting cash.** Go to the POS screen. Open the cash drawer. Count all bills and coins. Record the starting amount in the Cash Drawer screen (accessible from the sidebar).
3. **Verify yesterday's close.** Check the Reports dashboard for yesterday's sales summary. Confirm cash was reconciled and no alerts are outstanding.
4. **Check 86 status.** Open the Menu Manager. Verify that any items 86'd yesterday have been un-86'd if stock has been replenished.
5. **Staff arrive and clock in.** Each employee goes to the PIN login screen, selects their avatar, enters their PIN, and clocks in.
6. **Verify the floor plan.** Open the Tables screen. Confirm all tables show "Available" (white). If any tables are stuck in a wrong status from the previous night, clear them.
7. **Service begins.** Staff start seating guests and taking orders.

### During Service

**Taking an order (full workflow):**
1. Guest is seated. The host or server taps the table on the floor plan and marks it as "Seated."
2. Server goes to the POS screen. Selects the table. Sets the guest count.
3. Server takes drink orders. Adds drinks to the order (select seat, tap drink, add modifiers if needed). Taps **Send to Kitchen**. Drinks fire immediately to the bar KDS.
4. Server takes food orders. Switches to food categories. Adds appetizers (Course 1) and entrees (Course 2) with modifiers and seat assignments. Taps **Send to Kitchen**. Kitchen receives the ticket.
5. If coursing is enabled, appetizers fire immediately. Entrees are held until the server taps **Fire** for Course 2.
6. Kitchen prepares the food. Tickets age on the KDS. When complete, kitchen taps **BUMP**.
7. Server or food runner delivers the food.
8. Second round of drinks: Server adds drinks to the existing order and taps **Update Order**.
9. Dessert: Server adds desserts and sends them.
10. Check time: Server goes to the Checks screen, selects the check, and taps **Pay Now**.
11. Guest pays with card. Tip prompt, receipt selection, done.
12. Server or busser clears the table on the floor plan.

**Managing multiple tables:**
- The sidebar and table floor plan let you quickly switch between tables.
- Use the Checks screen to see all your open checks at a glance.
- Color-coded table statuses help you prioritize (a red pulsing table needs immediate attention).

### Closing the Restaurant

1. **Close all open checks.** Go to the Checks screen. Every check must be paid before day close. If a guest left without paying, the manager processes it as a "Walkout" (manager PIN required).
2. **Reconcile the cash drawer.** Open the Cash Drawer screen. Count all cash in the drawer. Enter the actual count. The system calculates the expected amount and shows over/short. Anything over $5 either way should be investigated.
3. **Process safe drops.** If cash was dropped into the safe during service, verify those amounts match the logged drops.
4. **Run the daily report.** Go to Reports > Dashboard. Select "Today." Review:
   - Total sales vs. yesterday and vs. same day last week
   - Labor percentage (red flag if over 35%)
   - Void/comp report (red flag if over 3% of sales)
   - Cash over/short
5. **Export if needed.** Tap Export CSV to save the daily data for your records or accountant.
6. **Close the day.** The day-close function finalizes all transactions, settles the batch with the payment processor, and locks the day's records.
7. **Staff clock out.** Each employee goes to the Clock In screen and taps **Clock Out**. They declare any cash tips if prompted.
8. **Lock the terminals.** Turn off or lock the iPads.

---

## 16. Troubleshooting

### Can't Log In

**Email login fails:**
- Double-check your email address for typos.
- Make sure Caps Lock is not on (passwords are case-sensitive).
- Try the demo credentials: `demo@getsear.com` / `demo1234`.
- If you forgot your password, tap "Forgot Password?" on the login screen.

**PIN login fails:**
- Make sure you selected the correct avatar first.
- Enter only 4-6 digits (no letters).
- If the PIN was recently changed, ask your manager for the new one.
- After multiple failed attempts, the system temporarily locks PIN entry. Wait 1-2 minutes and try again.
- Try the Manager Login link to use email/password instead.

### Item Not Showing in Menu

- **Is it 86'd?** Check the Menu Manager. If the item has a red "86'd" badge, un-86 it.
- **Is it in the right category?** The POS menu grid filters by category. Make sure you are looking at the correct category tab.
- **Is it available for this daypart?** Some items are only available during certain dayparts (e.g., lunch specials not available at dinner). Check the item's availability settings in the Menu Manager.
- **Is it available on this day?** Check the "Availability — Days" setting for the item.
- **Use the search bar.** Type the item name in the search bar at the bottom of the POS menu grid. If it appears in search results, the item exists but may be in a different category.

### Payment Declined

- Ask the guest to try a different card.
- Check that the Valor payment terminal is powered on and connected.
- For gift cards, verify the balance covers the amount.
- If the terminal shows "No Connection," check Wi-Fi.
- In demo/mock mode (VALOR_MOCK=true), all card payments are simulated as approved.

### Order Stuck / Won't Send

- Check your internet connection. Look for the connection status indicator.
- Try tapping **Send to Kitchen** again. If it fails, try refreshing the browser (pull down on iPad to refresh).
- If the order panel shows items but the Send button is disabled, make sure at least one item has been added.
- If you see an error toast message, note the message and report it to your system administrator.

### Offline Mode Indicator

If the internet connection drops:

- A red banner appears across the top of the screen: "OFFLINE MODE — Data syncing paused."
- You can continue taking orders and processing cash payments.
- Card payments may be limited (store-and-forward mode).
- When connectivity returns, the banner changes to "SYNCING..." and then disappears when all data is synchronized.

### Common Questions

**How do I switch between tables quickly?**
Use the sidebar to go to the Tables screen, tap a table, then tap "View Order" to jump to that table's order on the POS.

**How do I reprint a receipt?**
Go to the Checks screen, find the check (Closed tab), and use the Actions dropdown > Reprint.

**How do I open the cash drawer without a transaction?**
This is a "No Sale" action and requires manager PIN approval. It is logged for loss prevention.

**How do I change the floor plan layout?**
Go to Tables, tap "Edit Mode" in the upper-right. Drag tables to new positions. Tap "Done Editing."

**How do I see only my tables?**
On the Checks screen, use the "My Checks" tab to filter to only checks assigned to you.
