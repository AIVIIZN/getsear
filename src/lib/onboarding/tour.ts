export interface OnboardingTourStep {
  id: string
  title: string
  body: string
  target: string
}

export const FIRST_ORDER_TOUR_STEPS: OnboardingTourStep[] = [
  {
    id: 'open-pos',
    title: 'Open the order screen',
    body: 'Start at Orders. This is where servers create checks for dine-in, bar, and takeout service.',
    target: '/orders',
  },
  {
    id: 'choose-service',
    title: 'Choose dine-in or takeout',
    body: 'Set the service type before adding items so reporting, kitchen routing, and receipts stay clean.',
    target: '/orders',
  },
  {
    id: 'add-item',
    title: 'Add the first item',
    body: 'Tap a menu tile. Modifiers and allergy notes stay attached to the item all the way to KDS.',
    target: '/orders',
  },
  {
    id: 'review-check',
    title: 'Review the check',
    body: 'Confirm quantities, notes, discounts, and guest attachment before sending anything to the kitchen.',
    target: '/orders',
  },
  {
    id: 'send-kitchen',
    title: 'Send to kitchen',
    body: 'Fire the order once the check is accurate. Kitchen Display receives the routed ticket immediately.',
    target: '/kds',
  },
  {
    id: 'watch-kds',
    title: 'Watch the KDS ticket',
    body: 'The ticket ages by station, highlights allergies, and can be bumped when each item is complete.',
    target: '/kds',
  },
  {
    id: 'take-payment',
    title: 'Take payment',
    body: 'Open Payments, choose tender type, confirm tip, and issue the receipt from the same check.',
    target: '/payments',
  },
  {
    id: 'replay-anytime',
    title: 'Replay from Help',
    body: 'The owner can replay this tour from the Help drawer whenever a new manager needs a walkthrough.',
    target: '/backoffice/help',
  },
]

export const TOUR_STORAGE_KEY = 'sear_first_order_tour_seen'
