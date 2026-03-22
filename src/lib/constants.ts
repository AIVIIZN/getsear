// ---------------------------------------------------------------------------
// Order Types
// ---------------------------------------------------------------------------
export const ORDER_TYPES = [
  'dine_in',
  'takeout',
  'delivery',
  'bar',
  'catering',
  'online',
  'kiosk',
  'drive_thru',
] as const

export type OrderType = (typeof ORDER_TYPES)[number]

// ---------------------------------------------------------------------------
// Order Statuses
// ---------------------------------------------------------------------------
export const ORDER_STATUSES = [
  { value: 'draft', label: 'Draft', color: 'gray' },
  { value: 'open', label: 'Open', color: 'blue' },
  { value: 'fired', label: 'Fired', color: 'orange' },
  { value: 'ready', label: 'Ready', color: 'green' },
  { value: 'served', label: 'Served', color: 'emerald' },
  { value: 'closed', label: 'Closed', color: 'slate' },
  { value: 'voided', label: 'Voided', color: 'red' },
  { value: 'refunded', label: 'Refunded', color: 'rose' },
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]['value']

// ---------------------------------------------------------------------------
// Payment Statuses
// ---------------------------------------------------------------------------
export const PAYMENT_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'yellow' },
  { value: 'authorized', label: 'Authorized', color: 'blue' },
  { value: 'captured', label: 'Captured', color: 'green' },
  { value: 'settled', label: 'Settled', color: 'emerald' },
  { value: 'declined', label: 'Declined', color: 'red' },
  { value: 'voided', label: 'Voided', color: 'gray' },
  { value: 'refunded', label: 'Refunded', color: 'rose' },
  { value: 'failed', label: 'Failed', color: 'red' },
] as const

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]['value']

// ---------------------------------------------------------------------------
// Table Statuses (colors match UI_DESIGN.md tokens)
// ---------------------------------------------------------------------------
export const TABLE_STATUSES = [
  { value: 'available', label: 'Available', color: 'green' },
  { value: 'seated', label: 'Seated', color: 'blue' },
  { value: 'ordered', label: 'Ordered', color: 'orange' },
  { value: 'served', label: 'Served', color: 'yellow' },
  { value: 'check_presented', label: 'Check Presented', color: 'purple' },
  { value: 'dirty', label: 'Dirty', color: 'red' },
] as const

export type TableStatus = (typeof TABLE_STATUSES)[number]['value']

// ---------------------------------------------------------------------------
// Payment Methods
// ---------------------------------------------------------------------------
export const PAYMENT_METHODS = [
  'cash',
  'credit_card',
  'debit_card',
  'gift_card',
  'house_account',
  'apple_pay',
  'google_pay',
  'external',
] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

// ---------------------------------------------------------------------------
// User Roles
// ---------------------------------------------------------------------------
export const USER_ROLES = [
  { value: 'platform_admin', label: 'Platform Admin' },
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'server', label: 'Server' },
  { value: 'bartender', label: 'Bartender' },
  { value: 'host', label: 'Host' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'cashier', label: 'Cashier' },
  { value: 'driver', label: 'Driver' },
  { value: 'kiosk', label: 'Kiosk' },
  { value: 'readonly', label: 'Read Only' },
] as const

export type UserRole = (typeof USER_ROLES)[number]['value']

// ---------------------------------------------------------------------------
// Terminal Types
// ---------------------------------------------------------------------------
export const TERMINAL_TYPES = [
  'server_station',
  'bar',
  'host',
  'cashier',
  'kds',
  'kiosk',
  'customer_display',
  'drive_thru',
] as const

export type TerminalType = (typeof TERMINAL_TYPES)[number]

// ---------------------------------------------------------------------------
// KDS Aging Thresholds (minutes)
// ---------------------------------------------------------------------------
export const KDS_AGING = {
  fresh: { min: 0, max: 5, color: 'green', label: 'Fresh' },
  aging: { min: 5, max: 10, color: 'yellow', label: 'Aging' },
  late: { min: 10, max: 15, color: 'orange', label: 'Late' },
  critical: { min: 15, max: Infinity, color: 'red', label: 'Critical' },
} as const

// ---------------------------------------------------------------------------
// Tip Suggestions (percentages)
// ---------------------------------------------------------------------------
export const TIP_SUGGESTIONS = [18, 20, 22] as const

// ---------------------------------------------------------------------------
// Touch Target Minimum (px) — WCAG / Apple HIG
// ---------------------------------------------------------------------------
export const TOUCH_TARGET_MIN = 44

// ---------------------------------------------------------------------------
// Discount Types
// ---------------------------------------------------------------------------
export const DISCOUNT_TYPES = [
  'percentage',
  'fixed_amount',
  'bogo',
  'free_item',
] as const

export type DiscountType = (typeof DISCOUNT_TYPES)[number]

// ---------------------------------------------------------------------------
// Comp Reasons
// ---------------------------------------------------------------------------
export const COMP_REASONS = [
  'manager_comp',
  'quality_issue',
  'service_issue',
  'birthday',
  'vip',
  'employee_meal',
  'promotional',
  'other',
] as const

export type CompReason = (typeof COMP_REASONS)[number]

// ---------------------------------------------------------------------------
// Void Reasons
// ---------------------------------------------------------------------------
export const VOID_REASONS = [
  'customer_request',
  'kitchen_error',
  'server_error',
  'wrong_item',
  'quality_issue',
  '86d',
  'duplicate',
  'other',
] as const

export type VoidReason = (typeof VOID_REASONS)[number]
