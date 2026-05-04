import type {
  OrderType,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  UserRole,
  TerminalType,
  TableStatus,
  DiscountType,
  CompReason,
  VoidReason,
} from '@/lib/constants'

// ---------------------------------------------------------------------------
// Utility types
// ---------------------------------------------------------------------------

/** All IDs are UUIDv7 strings */
type UUID = string

/** ISO 8601 timestamp string (UTC) */
type Timestamp = string

/** ISO 8601 date string (YYYY-MM-DD) */
type DateString = string

/** Monetary amount stored as numeric(10,2) — dollars in DB, cents in API layer */
type Money = string

// ---------------------------------------------------------------------------
// Core Entities
// ---------------------------------------------------------------------------

export interface Organization {
  id: UUID
  name: string
  slug: string
  plan: 'starter' | 'professional' | 'enterprise'
  subscription_status: 'trialing' | 'active' | 'past_due' | 'cancelled'
  trial_ends_at: Timestamp | null
  logo_url: string | null
  primary_color: string | null
  owner_name: string | null
  owner_email: string | null
  owner_phone: string | null
  settings: Record<string, unknown>
  created_at: Timestamp
  updated_at: Timestamp
  deleted_at: Timestamp | null
}

export interface Location {
  id: UUID
  org_id: UUID
  name: string
  slug: string
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  zip: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
  phone: string | null
  email: string | null
  timezone: string
  currency: string
  business_hours: Array<{ day: number; open: string; close: string }>
  settings: Record<string, unknown>
  is_active: boolean
  created_at: Timestamp
  updated_at: Timestamp
  deleted_at: Timestamp | null
}

export interface User {
  id: UUID
  org_id: UUID
  email: string | null
  phone: string | null
  first_name: string
  last_name: string
  display_name: string | null
  avatar_url: string | null
  pin_hash: string | null
  role: UserRole
  location_ids: UUID[]
  hire_date: DateString | null
  hourly_rate: Money | null
  is_active: boolean
  settings: Record<string, unknown>
  created_at: Timestamp
  updated_at: Timestamp
  deleted_at: Timestamp | null
}

export interface Terminal {
  id: UUID
  org_id: UUID
  location_id: UUID
  name: string
  terminal_type: TerminalType
  device_id: string | null
  registration_code: string | null
  registration_code_expires_at: Timestamp | null
  device_fingerprint: {
    user_agent: string
    screen_width: number
    screen_height: number
    platform: string
    standalone: boolean
  } | null
  assigned_printer_id: UUID | null
  default_view: 'pos' | 'kds' | 'customer_display' | 'kiosk'
  is_online: boolean
  last_heartbeat_at: Timestamp | null
  current_user_id: UUID | null
  settings: Record<string, unknown>
  is_active: boolean
  created_at: Timestamp
  updated_at: Timestamp
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

export interface MenuCategory {
  id: UUID
  org_id: UUID
  location_id: UUID | null
  name: string
  description: string | null
  sort_order: number
  is_active: boolean
  available_start_time: string | null
  available_end_time: string | null
  available_days: number[] | null
  color: string | null
  image_url: string | null
  created_at: Timestamp
  updated_at: Timestamp
  deleted_at: Timestamp | null
}

export interface MenuItem {
  id: UUID
  org_id: UUID
  category_id: UUID
  location_id: UUID | null
  name: string
  short_name: string | null
  description: string | null
  price: Money
  cost: Money | null
  tax_rate_id: UUID | null
  is_taxable: boolean
  prep_station: string | null
  prep_time_minutes: number | null
  course: string | null
  is_active: boolean
  is_86d: boolean
  is_running_low: boolean
  available_start_time: string | null
  available_end_time: string | null
  available_days: number[] | null
  availability_type: string
  available_dayparts: UUID[] | null
  available_start_date: DateString | null
  available_end_date: DateString | null
  quantity_available: number | null
  quantity_low_threshold: number | null
  price_type: string
  color: string | null
  image_url: string | null
  sort_order: number
  nutrition: Record<string, unknown> | null
  allergens: string[] | null
  plu_code: string | null
  barcode: string | null
  created_at: Timestamp
  updated_at: Timestamp
  deleted_at: Timestamp | null
}

// ---------------------------------------------------------------------------
// Dayparts & Pricing
// ---------------------------------------------------------------------------

export interface MenuDaypart {
  id: UUID
  org_id: UUID
  location_id: UUID
  name: string
  start_time: string
  end_time: string
  days: number[]
  sections: string[]
  is_active: boolean
  created_at: Timestamp
  updated_at: Timestamp
}

export interface PriceLevel {
  id: UUID
  org_id: UUID
  name: string
  level_number: number
  description: string | null
  is_active: boolean
  created_at: Timestamp
  updated_at: Timestamp
}

export interface PriceLevelPrice {
  id: UUID
  org_id: UUID
  menu_item_id: UUID
  price_level_id: UUID
  price: Money
  daypart_id: UUID | null
  created_at: Timestamp
  updated_at: Timestamp
}

export interface SeasonalMenuItem {
  id: UUID
  org_id: UUID
  location_id: UUID
  item_id: UUID
  replaces_item_id: UUID | null
  start_date: DateString
  end_date: DateString
  is_active: boolean
  created_at: Timestamp
  updated_at: Timestamp
}

export interface ModifierGroup {
  id: UUID
  org_id: UUID
  name: string
  min_selections: number
  max_selections: number
  is_required_prompt: boolean
  sort_order: number
  created_at: Timestamp
  updated_at: Timestamp
  deleted_at: Timestamp | null
}

export interface Modifier {
  id: UUID
  org_id: UUID
  modifier_group_id: UUID
  name: string
  short_name: string | null
  price_adjustment: Money
  is_default: boolean
  is_active: boolean
  sort_order: number
  created_at: Timestamp
  updated_at: Timestamp
  deleted_at: Timestamp | null
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export interface Order {
  id: UUID
  org_id: UUID
  location_id: UUID
  terminal_id: UUID | null
  order_number: number
  display_number: string
  order_type: OrderType
  status: OrderStatus
  server_id: UUID | null
  table_id: UUID | null
  customer_id: UUID | null
  guest_count: number | null
  guest_name: string | null
  guest_phone: string | null
  subtotal: Money
  discount_total: Money
  tax_total: Money
  tip_total: Money
  total: Money
  amount_paid: Money
  balance_due: Money
  opened_at: Timestamp
  sent_at: Timestamp | null
  closed_at: Timestamp | null
  scheduled_for: Timestamp | null
  delivery_address: Record<string, unknown> | null
  fire_course_2_at: Timestamp | null
  notes: string | null
  source: string | null
  metadata: Record<string, unknown>
  created_at: Timestamp
  updated_at: Timestamp
  created_by: UUID | null
  updated_by: UUID | null
}

export interface OrderItem {
  id: UUID
  org_id: UUID
  order_id: UUID
  menu_item_id: UUID | null
  name: string
  short_name: string | null
  quantity: number
  unit_price: Money
  modifier_total: Money
  discount_amount: Money
  tax_amount: Money
  line_total: Money
  prep_station: string | null
  course: number | null
  seat_number: number | null
  is_sent: boolean
  is_fired: boolean
  is_ready: boolean
  is_served: boolean
  is_voided: boolean
  void_reason: VoidReason | null
  voided_by: UUID | null
  voided_at: Timestamp | null
  is_comped: boolean
  comp_reason: CompReason | null
  comp_amount: Money | null
  comped_by: UUID | null
  notes: string | null
  sent_at: Timestamp | null
  fired_at: Timestamp | null
  ready_at: Timestamp | null
  served_at: Timestamp | null
  sort_order: number
  created_at: Timestamp
  updated_at: Timestamp
  created_by: UUID | null
}

export interface OrderItemModifier {
  id: UUID
  order_item_id: UUID
  modifier_id: UUID | null
  modifier_group_id: UUID | null
  name: string
  price_adjustment: Money
  quantity: number
  created_at: Timestamp
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export interface Payment {
  id: UUID
  org_id: UUID
  order_id: UUID
  payment_method: PaymentMethod
  status: PaymentStatus
  amount: Money
  tip_amount: Money
  total_amount: Money
  processor_transaction_id: string | null
  card_brand: string | null
  card_last_four: string | null
  auth_code: string | null
  gift_card_id: UUID | null
  cash_tendered: Money | null
  change_due: Money | null
  split_index: number | null
  refund_amount: Money | null
  refund_reason: string | null
  refunded_by: UUID | null
  refunded_at: Timestamp | null
  original_payment_id: UUID | null
  processed_by: UUID
  processed_at: Timestamp
  processor_response: Record<string, unknown> | null
  created_at: Timestamp
  updated_at: Timestamp
}

export interface TipAdjustment {
  id: UUID
  org_id: UUID
  payment_id: UUID
  order_id: UUID
  server_id: UUID
  original_tip: Money
  adjusted_tip: Money
  reason: string | null
  adjusted_by: UUID
  created_at: Timestamp
}

// ---------------------------------------------------------------------------
// Floor Plan & Tables
// ---------------------------------------------------------------------------

export interface FloorPlan {
  id: UUID
  org_id: UUID
  location_id: UUID
  name: string
  sort_order: number
  is_active: boolean
  canvas_width: number
  canvas_height: number
  background_image_url: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

export interface Table {
  id: UUID
  org_id: UUID
  location_id: UUID
  floor_plan_id: UUID
  name: string
  capacity: number
  shape: 'rectangle' | 'circle' | 'square'
  pos_x: number
  pos_y: number
  width: number
  height: number
  rotation: number
  status: TableStatus
  current_order_id: UUID | null
  current_server_id: UUID | null
  seated_at: Timestamp | null
  is_active: boolean
  sort_order: number
  section: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

// ---------------------------------------------------------------------------
// Staff & Time Tracking
// ---------------------------------------------------------------------------

export interface Shift {
  id: UUID
  org_id: UUID
  location_id: UUID
  name: string | null
  shift_date: DateString
  start_time: Timestamp
  end_time: Timestamp | null
  manager_id: UUID | null
  total_sales: Money | null
  total_labor_cost: Money | null
  total_comps: Money | null
  total_voids: Money | null
  is_closed: boolean
  closed_by: UUID | null
  closed_at: Timestamp | null
  notes: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

export interface TimeEntry {
  id: UUID
  org_id: UUID
  location_id: UUID
  user_id: UUID
  shift_id: UUID | null
  clock_in: Timestamp
  clock_out: Timestamp | null
  role_during_shift: UserRole | null
  hourly_rate: Money | null
  regular_hours: number | null
  overtime_hours: number | null
  total_pay: Money | null
  cash_tips: Money
  credit_tips: Money
  tip_out_given: Money
  tip_out_received: Money
  notes: string | null
  is_approved: boolean
  approved_by: UUID | null
  created_at: Timestamp
  updated_at: Timestamp
}

export interface BreakEntry {
  id: UUID
  time_entry_id: UUID
  break_type: 'paid' | 'unpaid'
  start_time: Timestamp
  end_time: Timestamp | null
  duration_minutes: number | null
  created_at: Timestamp
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export interface Customer {
  id: UUID
  org_id: UUID
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  notes: string | null
  tags: string[] | null
  total_visits: number
  total_spent: Money
  average_check: Money
  last_visit_at: Timestamp | null
  marketing_opt_in: boolean
  birthday: DateString | null
  anniversary: DateString | null
  created_at: Timestamp
  updated_at: Timestamp
  deleted_at: Timestamp | null
}

// ---------------------------------------------------------------------------
// KDS (Kitchen Display System)
// ---------------------------------------------------------------------------

export interface KdsStation {
  id: UUID
  org_id: UUID
  location_id: UUID
  name: string
  station_type: 'prep' | 'expo'
  prep_stations: string[] | null
  terminal_id: UUID | null
  display_settings: Record<string, unknown> | null
  sort_order: number | null
  is_active: boolean | null
  created_at: Timestamp | null
}

export interface KdsTicketEvent {
  id: UUID
  org_id: UUID
  station_id: UUID
  order_id: UUID
  order_item_id: UUID | null
  event_type: 'received' | 'started' | 'bumped' | 'recalled' | 'all_day_updated'
  performed_by: UUID | null
  created_at: Timestamp | null
}

// ---------------------------------------------------------------------------
// Gift Cards
// ---------------------------------------------------------------------------

export interface GiftCard {
  id: UUID
  org_id: UUID
  card_number: string
  card_number_hash: string
  pin_hash: string | null
  initial_balance: Money
  current_balance: Money
  purchased_by_customer_id: UUID | null
  purchased_at: Timestamp
  purchase_order_id: UUID | null
  recipient_name: string | null
  recipient_email: string | null
  recipient_phone: string | null
  message: string | null
  is_active: boolean
  expires_at: Timestamp | null
  created_at: Timestamp
  updated_at: Timestamp
}

// ---------------------------------------------------------------------------
// Tax Rates
// ---------------------------------------------------------------------------

export interface TaxRate {
  id: UUID
  org_id: UUID
  location_id: UUID
  name: string
  rate: string // numeric(6,4) as string
  is_inclusive: boolean
  is_default: boolean
  applies_to: string[] // e.g. ['food', 'alcohol', 'merchandise']
  is_active: boolean
  created_at: Timestamp
  updated_at: Timestamp
}

// ---------------------------------------------------------------------------
// Org Modules
// ---------------------------------------------------------------------------

export interface OrgModule {
  id: UUID
  org_id: UUID
  module_name: string
  is_enabled: boolean
  config: Record<string, unknown>
  location_ids: UUID[] | null
  created_at: Timestamp
  updated_at: Timestamp
}

// ---------------------------------------------------------------------------
// Roles & Permissions
// ---------------------------------------------------------------------------

export interface Permission {
  id: UUID
  name: string
  description: string | null
  category: string
  created_at: Timestamp
}

export interface RolePermission {
  id: UUID
  org_id: UUID
  role: UserRole
  permission_id: UUID
  created_at: Timestamp
}

// ---------------------------------------------------------------------------
// Audit Log
// ---------------------------------------------------------------------------

export interface AuditLog {
  id: UUID
  org_id: UUID
  location_id: UUID | null
  user_id: UUID | null
  user_name: string | null
  user_role: UserRole | null
  action: string
  entity_type: string
  entity_id: UUID | null
  description: string
  /** @deprecated since V5.4.3 — use `before_state`. Retained for rows written before the expansion. */
  previous_state: Record<string, unknown> | null
  /** @deprecated since V5.4.3 — use `after_state`. Retained for rows written before the expansion. */
  new_state: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  terminal_id: UUID | null
  /** Manager whose PIN authorised the action; NULL when no PIN was required. Added 5.4.3. */
  manager_pin_user_id: UUID | null
  /** Typed snapshot of the entity immediately before the change. Added 5.4.3. */
  before_state: Record<string, unknown> | null
  /** Typed snapshot of the entity immediately after the change. Added 5.4.3. */
  after_state: Record<string, unknown> | null
  /** Human-readable rationale entered by the actor. Added 5.4.3. */
  reason: string | null
  created_at: Timestamp
}

// ---------------------------------------------------------------------------
// Supabase Database type (used for typed client)
// ---------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: Organization
        Insert: Partial<Organization> & Pick<Organization, 'name' | 'slug'>
        Update: Partial<Organization>
      }
      locations: {
        Row: Location
        Insert: Partial<Location> & Pick<Location, 'org_id' | 'name' | 'slug'>
        Update: Partial<Location>
      }
      users: {
        Row: User
        Insert: Partial<User> & Pick<User, 'org_id' | 'first_name' | 'last_name'>
        Update: Partial<User>
      }
      terminals: {
        Row: Terminal
        Insert: Partial<Terminal> & Pick<Terminal, 'org_id' | 'location_id' | 'name' | 'terminal_type'>
        Update: Partial<Terminal>
      }
      menu_categories: {
        Row: MenuCategory
        Insert: Partial<MenuCategory> & Pick<MenuCategory, 'org_id' | 'name'>
        Update: Partial<MenuCategory>
      }
      menu_items: {
        Row: MenuItem
        Insert: Partial<MenuItem> & Pick<MenuItem, 'org_id' | 'category_id' | 'name' | 'price'>
        Update: Partial<MenuItem>
      }
      modifier_groups: {
        Row: ModifierGroup
        Insert: Partial<ModifierGroup> & Pick<ModifierGroup, 'org_id' | 'name'>
        Update: Partial<ModifierGroup>
      }
      modifiers: {
        Row: Modifier
        Insert: Partial<Modifier> & Pick<Modifier, 'org_id' | 'modifier_group_id' | 'name'>
        Update: Partial<Modifier>
      }
      menu_dayparts: {
        Row: MenuDaypart
        Insert: Partial<MenuDaypart> & Pick<MenuDaypart, 'org_id' | 'location_id' | 'name' | 'start_time' | 'end_time' | 'days'>
        Update: Partial<MenuDaypart>
      }
      price_levels: {
        Row: PriceLevel
        Insert: Partial<PriceLevel> & Pick<PriceLevel, 'org_id' | 'name' | 'level_number'>
        Update: Partial<PriceLevel>
      }
      price_level_prices: {
        Row: PriceLevelPrice
        Insert: Partial<PriceLevelPrice> & Pick<PriceLevelPrice, 'org_id' | 'menu_item_id' | 'price_level_id' | 'price'>
        Update: Partial<PriceLevelPrice>
      }
      seasonal_menu_items: {
        Row: SeasonalMenuItem
        Insert: Partial<SeasonalMenuItem> & Pick<SeasonalMenuItem, 'org_id' | 'location_id' | 'item_id' | 'start_date' | 'end_date'>
        Update: Partial<SeasonalMenuItem>
      }
      orders: {
        Row: Order
        Insert: Partial<Order> & Pick<Order, 'org_id' | 'location_id' | 'order_number' | 'display_number'>
        Update: Partial<Order>
      }
      order_items: {
        Row: OrderItem
        Insert: Partial<OrderItem> & Pick<OrderItem, 'org_id' | 'order_id' | 'name' | 'unit_price'>
        Update: Partial<OrderItem>
      }
      order_item_modifiers: {
        Row: OrderItemModifier
        Insert: Partial<OrderItemModifier> & Pick<OrderItemModifier, 'order_item_id' | 'name'>
        Update: Partial<OrderItemModifier>
      }
      payments: {
        Row: Payment
        Insert: Partial<Payment> & Pick<Payment, 'org_id' | 'order_id' | 'payment_method' | 'amount' | 'total_amount' | 'processed_by'>
        Update: Partial<Payment>
      }
      tip_adjustments: {
        Row: TipAdjustment
        Insert: Partial<TipAdjustment> & Pick<TipAdjustment, 'org_id' | 'payment_id' | 'order_id' | 'server_id' | 'original_tip' | 'adjusted_tip' | 'adjusted_by'>
        Update: Partial<TipAdjustment>
      }
      floor_plans: {
        Row: FloorPlan
        Insert: Partial<FloorPlan> & Pick<FloorPlan, 'org_id' | 'location_id' | 'name'>
        Update: Partial<FloorPlan>
      }
      tables: {
        Row: Table
        Insert: Partial<Table> & Pick<Table, 'org_id' | 'location_id' | 'floor_plan_id' | 'name'>
        Update: Partial<Table>
      }
      shifts: {
        Row: Shift
        Insert: Partial<Shift> & Pick<Shift, 'org_id' | 'location_id' | 'shift_date' | 'start_time'>
        Update: Partial<Shift>
      }
      time_entries: {
        Row: TimeEntry
        Insert: Partial<TimeEntry> & Pick<TimeEntry, 'org_id' | 'location_id' | 'user_id' | 'clock_in'>
        Update: Partial<TimeEntry>
      }
      break_entries: {
        Row: BreakEntry
        Insert: Partial<BreakEntry> & Pick<BreakEntry, 'time_entry_id' | 'break_type' | 'start_time'>
        Update: Partial<BreakEntry>
      }
      customers: {
        Row: Customer
        Insert: Partial<Customer> & Pick<Customer, 'org_id'>
        Update: Partial<Customer>
      }
      kds_stations: {
        Row: KdsStation
        Insert: Partial<KdsStation> & Pick<KdsStation, 'org_id' | 'location_id' | 'name' | 'station_type'>
        Update: Partial<KdsStation>
      }
      kds_ticket_events: {
        Row: KdsTicketEvent
        Insert: Partial<KdsTicketEvent> & Pick<KdsTicketEvent, 'org_id' | 'station_id' | 'order_id' | 'event_type'>
        Update: Partial<KdsTicketEvent>
      }
      gift_cards: {
        Row: GiftCard
        Insert: Partial<GiftCard> & Pick<GiftCard, 'org_id' | 'card_number' | 'card_number_hash' | 'initial_balance' | 'current_balance'>
        Update: Partial<GiftCard>
      }
      audit_log: {
        Row: AuditLog
        Insert: Partial<AuditLog> & Pick<AuditLog, 'org_id' | 'action' | 'entity_type' | 'description'>
        Update: Partial<AuditLog>
      }
      tax_rates: {
        Row: TaxRate
        Insert: Partial<TaxRate> & Pick<TaxRate, 'org_id' | 'location_id' | 'name' | 'rate'>
        Update: Partial<TaxRate>
      }
      org_modules: {
        Row: OrgModule
        Insert: Partial<OrgModule> & Pick<OrgModule, 'org_id' | 'module_name'>
        Update: Partial<OrgModule>
      }
      permissions: {
        Row: Permission
        Insert: Partial<Permission> & Pick<Permission, 'name' | 'category'>
        Update: Partial<Permission>
      }
      role_permissions: {
        Row: RolePermission
        Insert: Partial<RolePermission> & Pick<RolePermission, 'org_id' | 'role' | 'permission_id'>
        Update: Partial<RolePermission>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      order_status: OrderStatus
      order_type: OrderType
      payment_status: PaymentStatus
      payment_method: PaymentMethod
      user_role: UserRole
      terminal_type: TerminalType
      discount_type: DiscountType
      comp_reason: CompReason
      void_reason: VoidReason
    }
  }
}
