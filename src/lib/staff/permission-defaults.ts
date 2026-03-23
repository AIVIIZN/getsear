/**
 * Permission Defaults per Role
 *
 * Defines the default permission set for each of the 12 roles in Sear POS.
 * Per-user overrides (grant/deny) take precedence over these defaults.
 */

// ---------------------------------------------------------------------------
// Permission codes grouped by category
// ---------------------------------------------------------------------------

export interface PermissionCategory {
  key: string
  label: string
  permissions: PermissionDef[]
}

export interface PermissionDef {
  code: string
  label: string
  description: string
}

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    key: 'orders',
    label: 'Orders',
    permissions: [
      { code: 'void_pre_send', label: 'Void Before Send', description: 'Remove items before they are sent to the kitchen' },
      { code: 'void_post_send', label: 'Void After Send', description: 'Remove items after they have been sent to the kitchen' },
      { code: 'comp', label: 'Comp Items', description: 'Comp items on an order' },
      { code: 'discount', label: 'Apply Discounts', description: 'Apply discounts to orders' },
      { code: 'reopen_closed', label: 'Reopen Closed Orders', description: 'Reopen a closed or settled order' },
      { code: 'price_override', label: 'Price Override', description: 'Override the price of an item' },
      { code: 'transfer_table', label: 'Transfer Table', description: 'Transfer a table to another server' },
    ],
  },
  {
    key: 'payments',
    label: 'Payments',
    permissions: [
      { code: 'process_payment', label: 'Process Payment', description: 'Process payments on orders' },
      { code: 'refund', label: 'Refund', description: 'Issue refunds on settled payments' },
      { code: 'adjust_tip', label: 'Adjust Tips', description: 'Edit tip amounts on settled transactions' },
      { code: 'cash_drawer_no_sale', label: 'No-Sale Drawer Open', description: 'Open cash drawer without a transaction' },
      { code: 'batch_settle', label: 'Batch Settle', description: 'Run end-of-day batch settlement' },
    ],
  },
  {
    key: 'menu',
    label: 'Menu',
    permissions: [
      { code: 'view_menu', label: 'View Menu', description: 'View menu items and categories' },
      { code: 'edit_menu', label: 'Edit Menu', description: 'Create, edit, and delete menu items' },
      { code: 'edit_prices', label: 'Edit Prices', description: 'Change menu item prices' },
      { code: 'manage_modifiers', label: 'Manage Modifiers', description: 'Create and edit modifier groups' },
      { code: 'manage_86', label: 'Manage 86 List', description: 'Toggle items on/off the 86 list' },
    ],
  },
  {
    key: 'staff',
    label: 'Staff',
    permissions: [
      { code: 'view_staff', label: 'View Staff', description: 'View staff list and profiles' },
      { code: 'manage_staff', label: 'Manage Staff', description: 'Add, edit, and deactivate staff members' },
      { code: 'edit_time_entries', label: 'Edit Time Entries', description: 'Edit clock-in/out times for staff' },
      { code: 'approve_time_entries', label: 'Approve Time Entries', description: 'Approve pending time entries' },
      { code: 'manage_schedule', label: 'Manage Schedule', description: 'Create and edit schedules' },
    ],
  },
  {
    key: 'reports',
    label: 'Reports',
    permissions: [
      { code: 'view_shift_reports', label: 'View Shift Reports', description: 'View end-of-shift summaries' },
      { code: 'view_daily_reports', label: 'View Daily Reports', description: 'View daily sales and labor reports' },
      { code: 'view_labor_reports', label: 'View Labor Reports', description: 'View labor cost and overtime reports' },
      { code: 'view_financial_reports', label: 'View Financial Reports', description: 'View P&L, COGS, and financial reports' },
      { code: 'view_payroll', label: 'View Payroll', description: 'View payroll data and export' },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    permissions: [
      { code: 'view_settings', label: 'View Settings', description: 'View system settings' },
      { code: 'edit_location_settings', label: 'Edit Location Settings', description: 'Edit location-level settings' },
      { code: 'manage_terminals', label: 'Manage Terminals', description: 'Add and configure terminals' },
      { code: 'manage_printers', label: 'Manage Printers', description: 'Add and configure printers' },
    ],
  },
]

// ---------------------------------------------------------------------------
// All permission codes as a flat array
// ---------------------------------------------------------------------------

export const ALL_PERMISSION_CODES = PERMISSION_CATEGORIES.flatMap((cat) =>
  cat.permissions.map((p) => p.code)
)

// ---------------------------------------------------------------------------
// Default permissions per role
// ---------------------------------------------------------------------------

export type PermissionDefault = 'grant' | 'deny'

type RolePermissionDefaults = Record<string, PermissionDefault>

const ROLE_DEFAULTS: Record<string, RolePermissionDefaults> = {
  platform_admin: Object.fromEntries(ALL_PERMISSION_CODES.map((c) => [c, 'grant' as const])),

  owner: Object.fromEntries(ALL_PERMISSION_CODES.map((c) => [c, 'grant' as const])),

  admin: Object.fromEntries(ALL_PERMISSION_CODES.map((c) => [c, 'grant' as const])),

  manager: {
    void_pre_send: 'grant',
    void_post_send: 'grant',
    comp: 'grant',
    discount: 'grant',
    reopen_closed: 'grant',
    price_override: 'grant',
    transfer_table: 'grant',
    process_payment: 'grant',
    refund: 'grant',
    adjust_tip: 'grant',
    cash_drawer_no_sale: 'grant',
    batch_settle: 'grant',
    view_menu: 'grant',
    edit_menu: 'grant',
    edit_prices: 'grant',
    manage_modifiers: 'grant',
    manage_86: 'grant',
    view_staff: 'grant',
    manage_staff: 'grant',
    edit_time_entries: 'grant',
    approve_time_entries: 'grant',
    manage_schedule: 'grant',
    view_shift_reports: 'grant',
    view_daily_reports: 'grant',
    view_labor_reports: 'grant',
    view_financial_reports: 'deny',
    view_payroll: 'deny',
    view_settings: 'grant',
    edit_location_settings: 'grant',
    manage_terminals: 'grant',
    manage_printers: 'grant',
  },

  server: {
    void_pre_send: 'grant',
    void_post_send: 'deny',
    comp: 'deny',
    discount: 'deny',
    reopen_closed: 'deny',
    price_override: 'deny',
    transfer_table: 'grant',
    process_payment: 'grant',
    refund: 'deny',
    adjust_tip: 'deny',
    cash_drawer_no_sale: 'deny',
    batch_settle: 'deny',
    view_menu: 'grant',
    edit_menu: 'deny',
    edit_prices: 'deny',
    manage_modifiers: 'deny',
    manage_86: 'deny',
    view_staff: 'deny',
    manage_staff: 'deny',
    edit_time_entries: 'deny',
    approve_time_entries: 'deny',
    manage_schedule: 'deny',
    view_shift_reports: 'grant',
    view_daily_reports: 'deny',
    view_labor_reports: 'deny',
    view_financial_reports: 'deny',
    view_payroll: 'deny',
    view_settings: 'deny',
    edit_location_settings: 'deny',
    manage_terminals: 'deny',
    manage_printers: 'deny',
  },

  bartender: {
    void_pre_send: 'grant',
    void_post_send: 'deny',
    comp: 'deny',
    discount: 'deny',
    reopen_closed: 'deny',
    price_override: 'deny',
    transfer_table: 'grant',
    process_payment: 'grant',
    refund: 'deny',
    adjust_tip: 'deny',
    cash_drawer_no_sale: 'grant',
    batch_settle: 'deny',
    view_menu: 'grant',
    edit_menu: 'deny',
    edit_prices: 'deny',
    manage_modifiers: 'deny',
    manage_86: 'grant',
    view_staff: 'deny',
    manage_staff: 'deny',
    edit_time_entries: 'deny',
    approve_time_entries: 'deny',
    manage_schedule: 'deny',
    view_shift_reports: 'grant',
    view_daily_reports: 'deny',
    view_labor_reports: 'deny',
    view_financial_reports: 'deny',
    view_payroll: 'deny',
    view_settings: 'deny',
    edit_location_settings: 'deny',
    manage_terminals: 'deny',
    manage_printers: 'deny',
  },

  host: {
    void_pre_send: 'deny',
    void_post_send: 'deny',
    comp: 'deny',
    discount: 'deny',
    reopen_closed: 'deny',
    price_override: 'deny',
    transfer_table: 'grant',
    process_payment: 'deny',
    refund: 'deny',
    adjust_tip: 'deny',
    cash_drawer_no_sale: 'deny',
    batch_settle: 'deny',
    view_menu: 'grant',
    edit_menu: 'deny',
    edit_prices: 'deny',
    manage_modifiers: 'deny',
    manage_86: 'deny',
    view_staff: 'deny',
    manage_staff: 'deny',
    edit_time_entries: 'deny',
    approve_time_entries: 'deny',
    manage_schedule: 'deny',
    view_shift_reports: 'deny',
    view_daily_reports: 'deny',
    view_labor_reports: 'deny',
    view_financial_reports: 'deny',
    view_payroll: 'deny',
    view_settings: 'deny',
    edit_location_settings: 'deny',
    manage_terminals: 'deny',
    manage_printers: 'deny',
  },

  kitchen: {
    void_pre_send: 'deny',
    void_post_send: 'deny',
    comp: 'deny',
    discount: 'deny',
    reopen_closed: 'deny',
    price_override: 'deny',
    transfer_table: 'deny',
    process_payment: 'deny',
    refund: 'deny',
    adjust_tip: 'deny',
    cash_drawer_no_sale: 'deny',
    batch_settle: 'deny',
    view_menu: 'grant',
    edit_menu: 'deny',
    edit_prices: 'deny',
    manage_modifiers: 'deny',
    manage_86: 'grant',
    view_staff: 'deny',
    manage_staff: 'deny',
    edit_time_entries: 'deny',
    approve_time_entries: 'deny',
    manage_schedule: 'deny',
    view_shift_reports: 'deny',
    view_daily_reports: 'deny',
    view_labor_reports: 'deny',
    view_financial_reports: 'deny',
    view_payroll: 'deny',
    view_settings: 'deny',
    edit_location_settings: 'deny',
    manage_terminals: 'deny',
    manage_printers: 'deny',
  },

  cashier: {
    void_pre_send: 'grant',
    void_post_send: 'deny',
    comp: 'deny',
    discount: 'deny',
    reopen_closed: 'deny',
    price_override: 'deny',
    transfer_table: 'deny',
    process_payment: 'grant',
    refund: 'deny',
    adjust_tip: 'deny',
    cash_drawer_no_sale: 'deny',
    batch_settle: 'deny',
    view_menu: 'grant',
    edit_menu: 'deny',
    edit_prices: 'deny',
    manage_modifiers: 'deny',
    manage_86: 'deny',
    view_staff: 'deny',
    manage_staff: 'deny',
    edit_time_entries: 'deny',
    approve_time_entries: 'deny',
    manage_schedule: 'deny',
    view_shift_reports: 'grant',
    view_daily_reports: 'deny',
    view_labor_reports: 'deny',
    view_financial_reports: 'deny',
    view_payroll: 'deny',
    view_settings: 'deny',
    edit_location_settings: 'deny',
    manage_terminals: 'deny',
    manage_printers: 'deny',
  },

  driver: {
    void_pre_send: 'deny',
    void_post_send: 'deny',
    comp: 'deny',
    discount: 'deny',
    reopen_closed: 'deny',
    price_override: 'deny',
    transfer_table: 'deny',
    process_payment: 'grant',
    refund: 'deny',
    adjust_tip: 'deny',
    cash_drawer_no_sale: 'deny',
    batch_settle: 'deny',
    view_menu: 'grant',
    edit_menu: 'deny',
    edit_prices: 'deny',
    manage_modifiers: 'deny',
    manage_86: 'deny',
    view_staff: 'deny',
    manage_staff: 'deny',
    edit_time_entries: 'deny',
    approve_time_entries: 'deny',
    manage_schedule: 'deny',
    view_shift_reports: 'deny',
    view_daily_reports: 'deny',
    view_labor_reports: 'deny',
    view_financial_reports: 'deny',
    view_payroll: 'deny',
    view_settings: 'deny',
    edit_location_settings: 'deny',
    manage_terminals: 'deny',
    manage_printers: 'deny',
  },

  kiosk: {
    void_pre_send: 'deny',
    void_post_send: 'deny',
    comp: 'deny',
    discount: 'deny',
    reopen_closed: 'deny',
    price_override: 'deny',
    transfer_table: 'deny',
    process_payment: 'grant',
    refund: 'deny',
    adjust_tip: 'deny',
    cash_drawer_no_sale: 'deny',
    batch_settle: 'deny',
    view_menu: 'grant',
    edit_menu: 'deny',
    edit_prices: 'deny',
    manage_modifiers: 'deny',
    manage_86: 'deny',
    view_staff: 'deny',
    manage_staff: 'deny',
    edit_time_entries: 'deny',
    approve_time_entries: 'deny',
    manage_schedule: 'deny',
    view_shift_reports: 'deny',
    view_daily_reports: 'deny',
    view_labor_reports: 'deny',
    view_financial_reports: 'deny',
    view_payroll: 'deny',
    view_settings: 'deny',
    edit_location_settings: 'deny',
    manage_terminals: 'deny',
    manage_printers: 'deny',
  },

  readonly: Object.fromEntries(ALL_PERMISSION_CODES.map((c) => [c, 'deny' as const])),
}

// Give readonly "view" permissions
ROLE_DEFAULTS.readonly.view_menu = 'grant'
ROLE_DEFAULTS.readonly.view_settings = 'grant'
ROLE_DEFAULTS.readonly.view_staff = 'grant'
ROLE_DEFAULTS.readonly.view_shift_reports = 'grant'
ROLE_DEFAULTS.readonly.view_daily_reports = 'grant'

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/**
 * Get the default permission value for a role + permission code.
 */
export function getRoleDefault(role: string, permissionCode: string): PermissionDefault {
  return ROLE_DEFAULTS[role]?.[permissionCode] ?? 'deny'
}

/**
 * Get all default permissions for a role.
 */
export function getRoleDefaults(role: string): RolePermissionDefaults {
  return ROLE_DEFAULTS[role] ?? Object.fromEntries(ALL_PERMISSION_CODES.map((c) => [c, 'deny' as const]))
}

/**
 * Resolve effective permission: override > role default.
 */
export function resolvePermission(
  role: string,
  permissionCode: string,
  override?: 'grant' | 'deny' | null
): 'grant' | 'deny' {
  if (override === 'grant' || override === 'deny') return override
  return getRoleDefault(role, permissionCode)
}
