/**
 * Tutorial step definitions for each major page in Sear POS.
 * Each tutorial is a sequence of steps targeting specific DOM elements.
 *
 * Tutorials show once per page (flagged in localStorage).
 * "Replay tutorial" button available on each page.
 */

export interface TutorialStep {
  /** CSS selector for the target element to spotlight */
  target: string
  /** Title shown in the tooltip */
  title: string
  /** Body text explaining what to do */
  body: string
  /** Which side of the target to position the tooltip */
  placement: 'top' | 'bottom' | 'left' | 'right'
}

export interface TutorialDefinition {
  /** Unique page identifier */
  pageId: string
  /** Human-readable name for the tutorial */
  name: string
  /** Tutorial steps in order */
  steps: TutorialStep[]
}

export const TUTORIALS: TutorialDefinition[] = [
  {
    pageId: 'pos-orders',
    name: 'Taking Orders',
    steps: [
      {
        target: '[data-tutorial="category-bar"]',
        title: 'Browse Categories',
        body: 'Tap a category to see the menu items available. Categories are organized the way your menu is structured.',
        placement: 'bottom',
      },
      {
        target: '[data-tutorial="menu-grid"]',
        title: 'Add Items to Order',
        body: 'Tap any item to add it to the current order. Items with modifiers (like temperature or toppings) will prompt you to choose.',
        placement: 'left',
      },
      {
        target: '[data-tutorial="order-panel"]',
        title: 'View Your Order',
        body: 'Your current order appears here. You can adjust quantities, remove items, or add notes. The total updates in real time.',
        placement: 'left',
      },
      {
        target: '[data-tutorial="send-button"]',
        title: 'Send to Kitchen',
        body: 'When the order is ready, tap "Send to Kitchen" to fire the ticket. The kitchen display will show the order immediately.',
        placement: 'top',
      },
    ],
  },
  {
    pageId: 'menu-builder',
    name: 'Menu Builder',
    steps: [
      {
        target: '[data-tutorial="add-category"]',
        title: 'Add a Category',
        body: 'Start by creating menu categories like "Appetizers", "Entrees", or "Beverages". Categories organize your menu for the POS screen.',
        placement: 'bottom',
      },
      {
        target: '[data-tutorial="add-item"]',
        title: 'Add Menu Items',
        body: 'Add items to each category. Set the name, price, description, and any allergen information. You can also upload a photo for each item.',
        placement: 'bottom',
      },
      {
        target: '[data-tutorial="modifier-groups"]',
        title: 'Set Up Modifiers',
        body: 'Create modifier groups like "Temperature" or "Toppings" and assign them to menu items. Modifiers let servers customize orders.',
        placement: 'left',
      },
    ],
  },
  {
    pageId: 'tables',
    name: 'Table Management',
    steps: [
      {
        target: '[data-tutorial="floor-plan"]',
        title: 'Your Floor Plan',
        body: 'This is your restaurant floor plan. Each shape represents a table. Colors indicate the table status at a glance.',
        placement: 'right',
      },
      {
        target: '[data-tutorial="table-item"]',
        title: 'Seat a Table',
        body: 'Tap any available table to seat guests. You can set the party size and assign a server. The table will turn blue when occupied.',
        placement: 'bottom',
      },
      {
        target: '[data-tutorial="table-details"]',
        title: 'View Table Details',
        body: 'Tap a seated table to see the order details, timing, and server assignment. You can also move, merge, or split tables from here.',
        placement: 'left',
      },
    ],
  },
  {
    pageId: 'kds',
    name: 'Kitchen Display',
    steps: [
      {
        target: '[data-tutorial="kds-ticket"]',
        title: 'Order Tickets',
        body: 'Each card is an order ticket. Items are listed with any modifiers. The timer shows how long the order has been active.',
        placement: 'bottom',
      },
      {
        target: '[data-tutorial="kds-bump"]',
        title: 'Bump Completed Orders',
        body: 'When all items on a ticket are ready, tap "Bump" to mark it done. The ticket will be removed and the server will be notified.',
        placement: 'top',
      },
    ],
  },
  {
    pageId: 'staff',
    name: 'Staff Management',
    steps: [
      {
        target: '[data-tutorial="staff-list"]',
        title: 'Your Team',
        body: 'All your employees are listed here. You can see who is currently clocked in, their role, and recent activity.',
        placement: 'bottom',
      },
      {
        target: '[data-tutorial="add-staff"]',
        title: 'Add Employees',
        body: 'Add new team members with their name, role, and login PIN. Roles control what each employee can access in the POS.',
        placement: 'left',
      },
    ],
  },
  {
    pageId: 'reports',
    name: 'Reports',
    steps: [
      {
        target: '[data-tutorial="report-cards"]',
        title: 'Dashboard Overview',
        body: 'Key metrics are shown at a glance: today\'s sales, covers, average ticket, and labor cost. Tap any card for details.',
        placement: 'bottom',
      },
      {
        target: '[data-tutorial="date-picker"]',
        title: 'Date Range',
        body: 'Select a date range to view reports for any time period. Compare today versus last week, or drill into specific days.',
        placement: 'bottom',
      },
    ],
  },
]

/**
 * Get tutorial definition for a page.
 */
export function getTutorialForPage(pageId: string): TutorialDefinition | undefined {
  return TUTORIALS.find((t) => t.pageId === pageId)
}

/**
 * Check if a tutorial has been completed (stored in localStorage).
 */
export function isTutorialCompleted(pageId: string): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(`tutorial_completed_${pageId}`) === 'true'
}

/**
 * Mark a tutorial as completed.
 */
export function markTutorialCompleted(pageId: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(`tutorial_completed_${pageId}`, 'true')
}

/**
 * Reset a tutorial so it shows again.
 */
export function resetTutorial(pageId: string): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(`tutorial_completed_${pageId}`)
}
