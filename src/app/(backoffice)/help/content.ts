import type { ComponentType } from 'react'
import { AlertTriangle, BarChart3, BookOpen, CreditCard, Monitor, Printer, ShoppingCart, Users, UtensilsCrossed } from 'lucide-react'

export interface HelpCategory {
  slug: string
  name: string
  description: string
  icon: ComponentType<{ className?: string }>
  articleCount: number
}

export interface HelpArticle {
  slug: string
  category: string
  title: string
  summary: string
  content: string
}

export const HELP_CATEGORIES: HelpCategory[] = [
  { slug: 'getting-started', name: 'Getting Started', description: 'Set up your restaurant, import your menu, and take your first order.', icon: BookOpen, articleCount: 4 },
  { slug: 'taking-orders', name: 'Taking Orders', description: 'Everything about the POS order screen, modifiers, and sending to kitchen.', icon: ShoppingCart, articleCount: 4 },
  { slug: 'kitchen-display', name: 'Kitchen Display', description: 'How the KDS works, bumping tickets, aging colors, and expo mode.', icon: Monitor, articleCount: 3 },
  { slug: 'menu-management', name: 'Menu Management', description: 'Add categories, items, modifiers, 86 items, and manage pricing.', icon: UtensilsCrossed, articleCount: 4 },
  { slug: 'payments', name: 'Payments', description: 'Process card payments, cash, splits, tips, voids, and refunds.', icon: CreditCard, articleCount: 4 },
  { slug: 'staff-labor', name: 'Staff & Labor', description: 'Add employees, manage shifts, clock in/out, tips, and overtime.', icon: Users, articleCount: 3 },
  { slug: 'reports', name: 'Reports', description: 'Sales reports, labor reports, PMIX, server performance, and exports.', icon: BarChart3, articleCount: 3 },
  { slug: 'hardware', name: 'Hardware', description: 'Set up receipt printers, kitchen printers, and Valor payment terminals.', icon: Printer, articleCount: 3 },
  { slug: 'troubleshooting', name: 'Troubleshooting', description: 'Fix common issues with connectivity, printing, payments, and performance.', icon: AlertTriangle, articleCount: 4 },
]

// All articles with full content for search
export const HELP_ARTICLES: HelpArticle[] = [
  // Getting Started
  {
    slug: 'first-order',
    category: 'getting-started',
    title: 'How to take your first order',
    summary: 'Walk through the complete process of creating and sending your first order.',
    content: 'Taking your first order in Sear POS is straightforward. Navigate to the POS screen by tapping "Open POS" from the back-office or using the POS link in the sidebar. You will see your menu categories across the top of the screen. Tap a category to see the items within it. Tap any item to add it to the current order in the panel on the right side of the screen. If an item has modifiers (like temperature for a steak or toppings for a burger), a popup will appear to let you make selections. Once you have added all items, review the order in the right panel. You can adjust quantities by tapping the plus or minus buttons, remove items by swiping left, or add special notes. When the order is complete, tap the "Send to Kitchen" button at the bottom. The order will immediately appear on the Kitchen Display System. If you are working with tables, assign the order to a table before sending.',
  },
  {
    slug: 'setup-wizard',
    category: 'getting-started',
    title: 'Complete the setup wizard',
    summary: 'Step-by-step guide to the initial restaurant setup wizard.',
    content: 'The setup wizard guides you through eight steps to configure your restaurant. You will enter your restaurant name, address, and timezone. Then set up your dining sections (like Dining Room, Bar, Patio). Next, configure tax rates. The wizard can look up rates by zip code automatically. After taxes, import your menu. You can take a photo of your paper menu and our AI will extract items, upload a CSV spreadsheet, build from scratch, or load a sample menu. Then choose a floor plan template or create a custom layout. Add your staff members with their roles and PINs. Finally, connect your hardware (printers and payment terminals). Each step can be skipped and completed later from Settings. Your progress is saved automatically.',
  },
  {
    slug: 'import-menu',
    category: 'getting-started',
    title: 'How to import your menu',
    summary: 'Four ways to get your menu into Sear POS quickly.',
    content: 'Sear POS offers four ways to import your menu. First, you can take a photo of your paper menu. Our AI reads the image and extracts item names, prices, and categories. You review the results and fix any errors before importing. Second, upload a CSV file with columns for name, price, and category. This works great if you have your menu in a spreadsheet. Third, build from scratch using the menu builder. Add categories, then add items to each category with names, prices, and descriptions. Fourth, load our sample menu which includes 50 items across 8 categories. This is great for exploring the POS and training staff. You can always mix methods. For example, import from a photo and then add missing items manually.',
  },
  {
    slug: 'demo-data',
    category: 'getting-started',
    title: 'Loading sample data for training',
    summary: 'Use demo data to explore the POS without affecting real operations.',
    content: 'Demo data lets you explore every feature of Sear POS without setting up a real restaurant first. From the setup wizard, choose "Load sample menu" to seed your restaurant with 50 menu items across 8 categories, 12 modifier groups, 24 tables, sample tax rates, and more. All demo items are clearly marked so they do not interfere with real operations. When you are ready to go live, you can delete all demo data from Settings. Demo data is also useful for staff training. Your team can practice taking orders, processing payments, and using the KDS with realistic menu items before opening day.',
  },
  // Taking Orders
  {
    slug: 'order-types',
    category: 'taking-orders',
    title: 'Understanding order types',
    summary: 'Dine-in, takeout, delivery, bar, and more. When to use each one.',
    content: 'Sear POS supports nine order types. Dine-in is the most common. Assign the order to a table and a server. The kitchen ticket shows the table number. Takeout orders print a customer name instead of a table number and can be marked ready for pickup. Delivery orders include a delivery address and can be assigned to a driver. Bar orders are for the bar area and route drink tickets to the bar printer. Online orders come in from your online ordering page. Drive-thru orders track lane position and speed metrics. Catering orders are for events and can include BEOs. Each order type has its own color code on the POS screen so staff can quickly identify what type of order they are working with.',
  },
  {
    slug: 'modifiers',
    category: 'taking-orders',
    title: 'Working with modifiers',
    summary: 'How to use temperature, toppings, sides, and other modifiers.',
    content: 'Modifiers let you customize menu items. When a guest orders a steak, the server needs to ask for temperature (rare, medium rare, etc.). When the server taps the steak item on the POS, a modifier popup automatically appears showing the required temperature selection. Some modifiers are required (the server must select one), while others are optional. Modifiers can have additional charges. For example, adding avocado to a burger might cost an extra two dollars. Modifier groups set minimum and maximum selections. A "Toppings" group might allow up to 5 selections, while "Temperature" requires exactly 1. To create modifier groups, go to Menu Management in the back-office. You can assign the same modifier group to multiple items.',
  },
  {
    slug: 'split-merge',
    category: 'taking-orders',
    title: 'Splitting and merging orders',
    summary: 'How to split a check, merge tables, or move items between orders.',
    content: 'Splitting a check is one of the most common operations. Open the order you want to split and tap the "Split" button. You can split evenly by number of guests, split by item (drag items to separate checks), or split custom amounts. Each split creates a separate check that can be paid independently. Merging combines two separate orders into one. This is useful when two tables are pushed together or when a bar guest moves to a table. Tap "Merge" on either order and select the order to merge with. You can also move individual items between open orders by long-pressing an item and selecting "Move to" from the context menu.',
  },
  {
    slug: 'coursing',
    category: 'taking-orders',
    title: 'Firing courses in order',
    summary: 'How to use course numbers to control when items fire to the kitchen.',
    content: 'Coursing controls the order in which items are sent to the kitchen. By default, all items fire together when you send the order. To use coursing, tap the course button next to each item in the order panel. Assign items to Course 1 (appetizers), Course 2 (entrees), Course 3 (desserts), etc. When you send the order, only Course 1 fires immediately. The kitchen prepares appetizers first. When appetizers are bumped from the KDS, Course 2 fires automatically. Alternatively, the server can manually fire the next course by tapping "Fire Next Course" in the order panel. This gives servers full control over pacing, which is especially important for fine dining.',
  },
  // Kitchen Display
  {
    slug: 'kds-basics',
    category: 'kitchen-display',
    title: 'How the Kitchen Display works',
    summary: 'Understanding tickets, timing colors, and bumping orders.',
    content: 'The Kitchen Display System (KDS) replaces paper tickets in the kitchen. When a server sends an order, it appears on the KDS as a card. Each card shows the table number, server name, order items with modifiers, and a timer. The timer changes color as orders age: white when fresh, yellow after a few minutes, orange when getting late, and red when critical. This visual aging helps the kitchen prioritize older orders. Tap "Bump" on a ticket when all items are ready. The ticket disappears and the server is notified. If you bump a ticket by accident, use "Recall" to bring it back. The KDS works in different station modes. The hot station sees only hot items. The cold station sees salads and desserts. The expo station sees everything and coordinates plating.',
  },
  {
    slug: 'kds-stations',
    category: 'kitchen-display',
    title: 'Setting up KDS stations',
    summary: 'Configure station routing so each screen shows the right items.',
    content: 'KDS stations let you route tickets to the right kitchen area. Go to Settings and then KDS Stations. Create stations for each area of your kitchen: Hot Line, Cold Line, Grill, Fry, Expo, Bar. For each station, select which menu categories it should display. The Hot Line station might show Entrees and Sides. The Cold Line might show Salads and Desserts. The Bar station shows Beverages. When an order is sent, each station only sees the items relevant to them. The Expo station is special. It shows all items from every station for a single order, letting the expeditor coordinate when everything is ready. Each station runs on its own screen. You can use iPads, Android tablets, or any web browser.',
  },
  {
    slug: 'kds-recall',
    category: 'kitchen-display',
    title: 'Recalling bumped tickets',
    summary: 'How to bring back a ticket that was accidentally bumped.',
    content: 'If a ticket is bumped by accident, it can be recalled. Tap the "Recall" button on the KDS screen (usually in the top right corner). A list of recently bumped tickets appears, ordered by most recent. Tap the ticket you want to bring back and it returns to the active display with its original timer. Recalled tickets are marked with a "Recalled" tag so the kitchen knows it was bumped and brought back. Tickets can only be recalled within 15 minutes of being bumped. After that, they are permanently archived. The recall feature requires manager permission if configured in your settings.',
  },
  // Menu Management
  {
    slug: 'add-menu-item',
    category: 'menu-management',
    title: 'How to add a menu item',
    summary: 'Step-by-step guide to creating a new menu item with modifiers.',
    content: 'To add a new menu item, go to Menu Management in the back-office. Select the category where you want to add the item, or create a new category first. Tap "Add Item" and fill in the details. Enter the item name as it should appear on the POS screen and printed tickets. Add a description for the online ordering page and customer-facing displays. Set the price in dollars. Mark whether the item is taxable and whether it contains alcohol (for different tax rates). Add allergen tags like Gluten, Dairy, Nuts, or Shellfish. Upload a photo for online ordering. Under "Modifiers", select which modifier groups apply to this item. For example, a burger should have Temperature and Toppings. Set the sort order to control where the item appears in its category. Toggle the item on or off with the Active switch.',
  },
  {
    slug: 'eighty-six',
    category: 'menu-management',
    title: 'How to 86 an item',
    summary: 'Temporarily remove an item from the POS when you run out.',
    content: 'When you run out of an ingredient or a dish, you can 86 it so servers cannot order it. From the POS screen, long-press the item and select "86 Item". The item becomes grayed out and untappable. Any current orders with that item are not affected. From the back-office, go to Menu Management, find the item, and toggle the 86 switch. You can 86 an item until a specific time (like end of service) or indefinitely. All 86 changes sync in real time across all POS terminals. When you restock, un-86 the item the same way. The item immediately becomes available on all terminals. The 86 log in Reports tracks how often items are 86d and helps with inventory planning.',
  },
  {
    slug: 'price-levels',
    category: 'menu-management',
    title: 'Using price levels',
    summary: 'Set different prices for happy hour, brunch, catering, and more.',
    content: 'Price levels let you charge different prices for the same item based on daypart, order type, or location. Sear POS supports up to 9 price levels per item. The default price is Level 1. Go to Settings and then Price Levels to create additional levels like "Happy Hour", "Brunch", "Catering", or "Online". For each menu item, you can set a specific price for each level. During Happy Hour, your IPA might be five dollars instead of seven. For catering orders, your entree prices might be higher to account for the extra service. Price levels activate automatically based on the active daypart or order type, or can be set manually by the server. Price level changes are logged in the audit trail.',
  },
  {
    slug: 'categories',
    category: 'menu-management',
    title: 'Organizing menu categories',
    summary: 'Create, reorder, and customize your menu categories.',
    content: 'Categories organize your menu on the POS screen. Go to Menu Management and tap "Add Category" to create a new one. Enter a name, choose a color that will appear as the category button on the POS, and set the sort order. You can drag and drop categories to reorder them. Categories can be scheduled to only appear during certain dayparts. For example, your "Brunch" category might only show on weekends from 10am to 3pm. You can also restrict categories to specific locations in a multi-unit setup. Each category can have an optional image for the online ordering page. To delete a category, you must first move or delete all items in it.',
  },
  // Payments
  {
    slug: 'process-payment',
    category: 'payments',
    title: 'How to process a payment',
    summary: 'Accept card payments, cash, and other tender types.',
    content: 'To process a payment, open the order and tap "Pay". The payment screen shows the order total including tax and any applied discounts. For card payments, tap "Card" and the Valor terminal will activate. The guest inserts, taps, or swipes their card on the terminal. The transaction processes in seconds and a receipt prints automatically. Card data never touches the Sear POS system for security. For cash payments, tap "Cash" and enter the amount tendered. The system calculates change automatically. Sear POS supports dual pricing. With dual pricing, card payments include a small service fee while cash payments get the base price. This is configured in your Valor account settings. Other payment methods include gift cards, house accounts, and bar tabs.',
  },
  {
    slug: 'tips',
    category: 'payments',
    title: 'Managing tips',
    summary: 'Tip entry, tip adjustment, tip pooling, and tip reports.',
    content: 'Tips can be entered at the time of payment or adjusted later. When a guest pays with a card, they can add a tip on the Valor terminal or write it on the receipt. For written tips, the server enters the tip amount in the POS before end of shift. Go to the order and tap "Adjust Tip". Tip pooling distributes tips among team members based on rules you define. Go to Settings and then Tip Pool to configure. You can pool by percentage, points, or equal share. Define which roles participate (usually servers, bartenders, bussers, and hosts). The tip report in Reports shows tips by employee, by shift, and identifies any tip adjustments made after close.',
  },
  {
    slug: 'voids-refunds',
    category: 'payments',
    title: 'Voids and refunds',
    summary: 'How to void an item, void an order, or process a refund.',
    content: 'Voiding removes an item or order before payment. To void a single item, tap it in the order panel and select "Void". Enter a reason (wrong item, guest changed mind, quality issue). Voided items appear on the void report. Voiding requires manager approval if configured in your settings. To void an entire order, tap the menu button on the order and select "Void Order". A full refund returns money to the guest after payment. Open the completed order, tap "Refund", and select which items to refund (or refund all). Card refunds go back to the original payment method through the Valor terminal. Cash refunds are given from the drawer. All voids and refunds are logged with the employee who initiated them, the manager who approved them, and the reason.',
  },
  {
    slug: 'bar-tabs',
    category: 'payments',
    title: 'Running bar tabs',
    summary: 'Open a tab with a card pre-auth and close it when the guest leaves.',
    content: 'Bar tabs let guests run an open tab and pay when they leave. To open a tab, tap "New Tab" on the POS. Swipe or insert the card on the Valor terminal. A pre-authorization hold is placed on the card (default amount is configurable in Settings). Add items to the tab throughout the evening. When the guest is ready to close, open the tab and tap "Close Tab". The final amount (with tip) is charged to the card. If a guest leaves without closing their tab, the system automatically closes it at end of day using the pre-authorized card. A configurable auto-gratuity (default 20%) is added to tabs that auto-close. Tab activity is tracked in the server report.',
  },
  // Staff & Labor
  {
    slug: 'add-employee',
    category: 'staff-labor',
    title: 'Adding a new employee',
    summary: 'Create an employee profile with role, PIN, and permissions.',
    content: 'To add a new employee, go to Staff in the back-office. Tap "Add Employee" and enter their first name, last name, and email. Select their role from the dropdown. Available roles include Owner, Manager, Server, Bartender, Host, Line Cook, Expo, Cashier, and Busser. Each role has default permissions that control what the employee can access. Set a unique 4-digit PIN that the employee will use to log in to the POS terminal. PINs are securely hashed and never stored in plain text. You can also set the employee hourly rate, overtime rules, and tip eligibility. Once created, the employee can immediately log in to any POS terminal using their PIN.',
  },
  {
    slug: 'clock-in-out',
    category: 'staff-labor',
    title: 'Clock in and out',
    summary: 'How employees clock in, take breaks, and clock out.',
    content: 'Employees clock in at the POS terminal by entering their PIN. The system records the clock-in time and displays who is currently on the clock. During a shift, employees can start a break by going to the clock menu. Breaks can be paid or unpaid based on your labor rules in Settings. The system tracks break duration and alerts managers if a break exceeds the configured limit. At the end of a shift, the employee clocks out using their PIN. The system records total hours worked and calculates overtime if applicable. Managers can edit time entries from the back-office. All time edits are logged in the audit trail. The labor report shows hours worked by employee, by day, and as a percentage of sales.',
  },
  {
    slug: 'scheduling',
    category: 'staff-labor',
    title: 'Creating a staff schedule',
    summary: 'Build weekly schedules, manage availability, and handle shift swaps.',
    content: 'Go to Scheduling in the back-office to build your weekly schedule. You can create schedules from scratch or use a template from a previous week. Drag and drop shifts on the calendar view. Set shift times, assign employees, and specify the position for each shift. Employees can set their availability from their profile. When you schedule someone outside their available hours, you will see a warning. Published schedules are visible to all employees. Shift swaps let employees trade shifts with manager approval. An employee requests a swap, another employee accepts, and the manager approves. The schedule updates automatically. The labor forecast shows projected labor cost based on scheduled hours and hourly rates.',
  },
  // Reports
  {
    slug: 'sales-report',
    category: 'reports',
    title: 'Reading the sales report',
    summary: 'Understand your daily sales, net revenue, comps, and discounts.',
    content: 'The sales report gives you a complete picture of your revenue. The summary shows gross sales, discounts, comps, net sales, taxes collected, and tips. Below the summary, you see sales broken down by category. This tells you which parts of your menu are performing best. The hourly breakdown shows when your peak hours are so you can staff accordingly. The payment method breakdown shows what percentage of sales are card versus cash. Compare any date range to the same period last week, last month, or last year. Export the report as a CSV or PDF for your accountant. The sales report updates in real time. You can view it during service to see how the day is tracking against your targets.',
  },
  {
    slug: 'labor-report',
    category: 'reports',
    title: 'Labor cost report',
    summary: 'Track labor cost as a percentage of sales and manage overtime.',
    content: 'The labor report shows your labor cost as a percentage of revenue. Healthy restaurants typically run 25 to 35 percent labor cost. The report shows hours worked by employee and by role. It flags any overtime hours so you can manage labor spending. The daily view shows which days have the highest labor percentage and helps identify overstaffing. Compare actual labor to scheduled labor to see if employees are clocking in early or staying late. The report includes both regular and overtime hours with their respective costs. Use this report alongside the sales report to make scheduling decisions.',
  },
  {
    slug: 'pmix-report',
    category: 'reports',
    title: 'Product mix (PMIX) report',
    summary: 'See which items sell the most and which are underperforming.',
    content: 'The product mix report ranks every menu item by quantity sold, revenue generated, and food cost percentage. This tells you which items are your best sellers and which might need to be removed or repositioned on the menu. Sort by quantity to see your most popular items. Sort by revenue to see your highest-dollar performers. Sort by food cost to identify items where your margin is too thin. Use PMIX data to optimize your menu. Move high-profit items to prominent positions. Consider removing items that sell rarely and have high food cost. The report also shows modifier popularity so you can see which add-ons guests prefer.',
  },
  // Hardware
  {
    slug: 'receipt-printer',
    category: 'hardware',
    title: 'Setting up a receipt printer',
    summary: 'Connect a Star Micronics or Epson printer to print receipts.',
    content: 'Sear POS works with standard ESC/POS receipt printers from Star Micronics and Epson. For network printers, connect the printer to your WiFi or Ethernet network. Go to Settings and then Printers, then tap "Add Printer". Select the brand and connection type. The system will scan your network for compatible printers. Select your printer from the list and run a test print. Assign the printer a role: Receipt, Kitchen, or Bar. For USB printers, plug the printer directly into your POS device. For Bluetooth printers, put the printer in pairing mode and pair from your device settings. Each POS terminal can have a default receipt printer. Kitchen and bar printers receive tickets based on the menu category routing configured in KDS settings.',
  },
  {
    slug: 'valor-terminal',
    category: 'hardware',
    title: 'Pairing a Valor payment terminal',
    summary: 'Connect your VP800, VP550, VP300 Pro, or RCKT terminal.',
    content: 'Valor payment terminals handle all card processing. Sear POS never touches card data. For countertop models (VP800, VP550), connect the terminal to the same network as your POS device. The terminal comes pre-configured from Valor with your merchant credentials. When you process your first card payment, the POS connects to the terminal automatically using the terminal IP address. For the RCKT mobile terminal, pair it via Bluetooth. Hold the Bluetooth button until the LED blinks, then pair from your device Bluetooth settings. After pairing, run a test transaction (which will be voided immediately) to confirm connectivity. If you have multiple POS stations, each one can have its own dedicated terminal or share a terminal.',
  },
  {
    slug: 'cash-drawer',
    category: 'hardware',
    title: 'Connecting a cash drawer',
    summary: 'Set up a standard RJ-11 cash drawer with your receipt printer.',
    content: 'Cash drawers connect to your receipt printer using a standard RJ-11 cable (the same kind used for telephone lines). Plug the cable from the cash drawer into the RJ-11 port on the back of your receipt printer. No additional setup is needed in Sear POS. When a cash payment is processed, the POS sends a drawer kick signal through the receipt printer and the drawer opens automatically. To manually open the drawer (for making change), go to the POS menu and tap "Open Drawer". Manual drawer opens are logged with the employee name and time for security. You can configure drawer open permissions by role in Settings.',
  },
  // Troubleshooting
  {
    slug: 'internet-down',
    category: 'troubleshooting',
    title: 'What to do when the internet goes down',
    summary: 'Keep taking orders and processing payments even without internet.',
    content: 'Sear POS has offline mode built in. If your internet goes down, the POS continues to work. You can still take orders, print tickets to the kitchen, and process cash payments. Card payments require internet, but Valor terminals have store-and-forward capability. This means card transactions are saved on the terminal and processed when the connection is restored. Orders taken offline are synced to the server when the connection comes back. You will see a yellow "Offline" badge on the POS screen. Real-time features like KDS and table sync pause during an outage but resume automatically. To prepare for outages, make sure your POS has the latest menu data cached locally by loading the POS screen at least once while online.',
  },
  {
    slug: 'printer-not-working',
    category: 'troubleshooting',
    title: 'Printer is not printing',
    summary: 'Common fixes when your receipt or kitchen printer stops working.',
    content: 'If your printer stops printing, start with the basics. Check that the printer is powered on and the paper is loaded correctly. The thermal paper has a glossy side (the printable side) that must face up. Open and close the paper cover firmly. For network printers, check that the printer is still connected to your WiFi network. Print a self-test page by holding the feed button while powering on. This will show the printer IP address. If the IP has changed, update it in Settings. For USB printers, try a different USB cable or port. For Bluetooth printers, remove the pairing and re-pair. If the printer prints blank pages, the paper is likely loaded upside down. If it prints garbled text, try selecting a different printer model in Settings. When all else fails, restart both the printer and the POS device.',
  },
  {
    slug: 'payment-declined',
    category: 'troubleshooting',
    title: 'Handling declined payments',
    summary: 'What to do when a card is declined and alternative options.',
    content: 'When a card is declined, the Valor terminal shows a decline message. Common reasons include insufficient funds, expired card, incorrect PIN, or fraud alerts from the card issuer. Ask the guest to try a different payment method. They can use another card, pay cash, or split the payment between card and cash. Never run the same declined card multiple times, as this can trigger additional fraud alerts. If a card is declined on a bar tab, the tab remains open with the pre-authorized amount still held. The guest must provide an alternative payment method to close the tab. Declined transactions are logged in the payment report. If you see a pattern of declines from a specific terminal, contact Valor support to check the terminal configuration.',
  },
  {
    slug: 'slow-performance',
    category: 'troubleshooting',
    title: 'POS is running slowly',
    summary: 'Tips to improve POS performance on iPad and Android tablets.',
    content: 'If the POS feels slow, try these steps in order. First, close any other apps running on the device. The POS works best when it is the only active application. Second, clear the browser cache by going to Settings, Safari, and Clear History and Website Data. Third, restart the device. Fourth, check your WiFi signal strength. The POS needs a reliable connection for real-time features. Position your WiFi router centrally in the restaurant. Consider a mesh WiFi system for larger spaces. Fifth, if you are using an older device, consider upgrading. Sear POS runs best on iPad Air (5th generation or newer) or iPad Pro. For Android, use a tablet with at least 4GB of RAM. Sixth, reduce the number of open orders. Having hundreds of open orders can slow down the system. Close out completed orders promptly.',
  },
]
