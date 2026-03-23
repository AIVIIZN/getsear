'use client'

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import {
  calculateOrderTax,
  isOrderForHere,
  type TaxRate,
  type TaxableItem,
} from '@/lib/tax/tax-engine'
import type { CourseState } from '@/lib/constants'

type OrderType = 'dine_in' | 'takeout' | 'delivery' | 'bar' | 'catering' | 'online' | 'kiosk' | 'drive_thru' | 'qr'
type OrderStatus = 'draft' | 'open' | 'fired' | 'ready' | 'served' | 'closed' | 'voided'

interface OrderModifier {
  id: string
  modifier_id: string
  name: string
  price_cents: number
  quantity: number
}

interface ComboChildItem {
  id: string
  menu_item_id: string
  name: string
  slot_name: string
  upcharge_cents: number
  modifiers: OrderModifier[]
}

interface OrderItem {
  id: string
  menu_item_id: string
  name: string
  price_cents: number
  quantity: number
  seat_number: number | null
  course: number
  status: 'pending' | 'sent' | 'fired' | 'ready' | 'served' | 'voided'
  modifiers: OrderModifier[]
  special_instructions: string
  voided: boolean
  void_reason: string | null
  is_combo: boolean
  combo_children: ComboChildItem[]
  /** Tax class for this item: 'food', 'alcohol', 'non_taxable', 'retail' */
  tax_class: string
  /** Whether this item is subject to tax */
  is_taxable: boolean
}

interface Order {
  id: string
  order_number: string
  order_type: OrderType
  status: OrderStatus
  table_id: string | null
  table_name: string | null
  server_id: string
  server_name: string
  guest_count: number
  items: OrderItem[]
  subtotal_cents: number
  discount_cents: number
  tax_cents: number
  total_cents: number
  notes: string
  created_at: string
  /** Explicit for-here / to-go toggle. null = inferred from order_type. */
  for_here: boolean | null
}

interface OrderState {
  currentOrder: Order | null
  activeOrders: Record<string, Order>
  activeSeat: number | null
  activeCourse: number
  /** Tax rates for the current location, loaded at POS init */
  taxRates: TaxRate[]
  /** Per-course fire/hold state. Key is course number. */
  courseStates: Record<number, CourseState>
  actions: {
    newOrder: (params: { order_type: OrderType; server_id: string; server_name: string; table_id?: string; table_name?: string }) => void
    setCurrentOrder: (order: Order | null) => void
    addItem: (item: { menu_item_id: string; name: string; price_cents: number; modifiers?: OrderModifier[]; special_instructions?: string; tax_class?: string; is_taxable?: boolean }) => void
    addComboToOrder: (combo: { menu_item_id: string; name: string; combo_price_cents: number; children: ComboChildItem[] }) => void
    updateItemQuantity: (itemId: string, quantity: number) => void
    updateItemModifiers: (itemId: string, modifiers: OrderModifier[]) => void
    updateItemSpecialInstructions: (itemId: string, instructions: string) => void
    voidItem: (itemId: string, reason: string) => void
    removeItem: (itemId: string) => void
    setActiveSeat: (seat: number | null) => void
    setActiveCourse: (course: number) => void
    setGuestCount: (count: number) => void
    setOrderType: (type: OrderType) => void
    setTable: (tableId: string, tableName: string) => void
    setForHere: (forHere: boolean) => void
    setCourseState: (course: number, state: CourseState) => void
    setTaxRates: (rates: TaxRate[]) => void
    recalculateTotals: () => void
    clearCurrentOrder: () => void
    loadActiveOrders: (orders: Order[]) => void
    updateActiveOrder: (order: Order) => void
    removeActiveOrder: (orderId: string) => void
  }
}

/**
 * Calculate order totals using the tax engine with real location tax rates.
 * All math in integer cents to avoid floating-point issues.
 */
function calculateTotals(
  items: OrderItem[],
  taxRates: TaxRate[],
  orderType: string,
  forHere: boolean | null
): { subtotal: number; tax: number; total: number } {
  const activeItems = items.filter((i) => !i.voided)

  const subtotal = activeItems.reduce((sum, item) => {
    const itemTotal = item.price_cents * item.quantity
    const modTotal = item.modifiers.reduce((m, mod) => m + mod.price_cents * mod.quantity, 0)
    // For combos, child modifiers are already included in combo_children upcharges
    // which are baked into price_cents during addComboToOrder
    const comboChildModTotal = item.combo_children.reduce((cs, child) => {
      return cs + child.modifiers.reduce((cm, mod) => cm + mod.price_cents * mod.quantity, 0)
    }, 0)
    return sum + itemTotal + modTotal + comboChildModTotal
  }, 0)

  // If no tax rates loaded yet, return zero tax (will recalculate when rates arrive)
  if (taxRates.length === 0) {
    return { subtotal, tax: 0, total: subtotal }
  }

  // Build taxable items for the tax engine
  const taxableItems: TaxableItem[] = activeItems.map((item) => {
    const itemTotal = item.price_cents * item.quantity
    const modTotal = item.modifiers.reduce((m, mod) => m + mod.price_cents * mod.quantity, 0) * item.quantity
    const comboChildModTotal = item.combo_children.reduce((cs, child) => {
      return cs + child.modifiers.reduce((cm, mod) => cm + mod.price_cents * mod.quantity, 0)
    }, 0)
    return {
      taxable_amount_cents: itemTotal + modTotal + comboChildModTotal,
      tax_class: item.tax_class ?? 'food',
      is_taxable: item.is_taxable ?? true,
    }
  })

  const isForHere = isOrderForHere(orderType, forHere)
  const taxResult = calculateOrderTax(taxableItems, taxRates, isForHere)

  return {
    subtotal,
    tax: taxResult.total_tax_cents,
    total: subtotal + taxResult.total_tax_cents,
  }
}

export const useOrderStore = create<OrderState>()(
  immer((set) => ({
    currentOrder: null,
    activeOrders: {},
    activeSeat: null,
    activeCourse: 1,
    taxRates: [],
    courseStates: { 1: 'fire' } as Record<number, CourseState>,
    actions: {
      newOrder: ({ order_type, server_id, server_name, table_id, table_name }) =>
        set((state) => {
          state.currentOrder = {
            id: crypto.randomUUID(),
            order_number: '',
            order_type,
            status: 'draft',
            table_id: table_id ?? null,
            table_name: table_name ?? null,
            server_id,
            server_name,
            guest_count: 1,
            items: [],
            subtotal_cents: 0,
            discount_cents: 0,
            tax_cents: 0,
            total_cents: 0,
            notes: '',
            created_at: new Date().toISOString(),
            for_here: null,
          }
          state.activeSeat = null
          state.activeCourse = 1
          state.courseStates = { 1: 'fire' }
        }),

      setCurrentOrder: (order) =>
        set((state) => {
          state.currentOrder = order
        }),

      addItem: ({ menu_item_id, name, price_cents, modifiers, special_instructions, tax_class, is_taxable }) =>
        set((state) => {
          if (!state.currentOrder) return
          state.currentOrder.items.push({
            id: crypto.randomUUID(),
            menu_item_id,
            name,
            price_cents,
            quantity: 1,
            seat_number: state.activeSeat,
            course: state.activeCourse,
            status: 'pending',
            modifiers: modifiers ?? [],
            special_instructions: special_instructions ?? '',
            voided: false,
            void_reason: null,
            is_combo: false,
            combo_children: [],
            tax_class: tax_class ?? 'food',
            is_taxable: is_taxable ?? true,
          })
          // Initialize course state if new course
          if (!(state.activeCourse in state.courseStates)) {
            state.courseStates[state.activeCourse] = state.activeCourse === 1 ? 'fire' : 'hold'
          }
          const totals = calculateTotals(
            state.currentOrder.items,
            state.taxRates,
            state.currentOrder.order_type,
            state.currentOrder.for_here
          )
          state.currentOrder.subtotal_cents = totals.subtotal
          state.currentOrder.tax_cents = totals.tax
          state.currentOrder.total_cents = totals.total
        }),

      addComboToOrder: ({ menu_item_id, name, combo_price_cents, children }) =>
        set((state) => {
          if (!state.currentOrder) return
          const upchargeTotal = children.reduce((sum, c) => sum + c.upcharge_cents, 0)
          state.currentOrder.items.push({
            id: crypto.randomUUID(),
            menu_item_id,
            name,
            price_cents: combo_price_cents + upchargeTotal,
            quantity: 1,
            seat_number: state.activeSeat,
            course: state.activeCourse,
            status: 'pending',
            modifiers: [],
            special_instructions: '',
            voided: false,
            void_reason: null,
            is_combo: true,
            combo_children: children,
            tax_class: 'food',
            is_taxable: true,
          })
          const totals = calculateTotals(
            state.currentOrder.items,
            state.taxRates,
            state.currentOrder.order_type,
            state.currentOrder.for_here
          )
          state.currentOrder.subtotal_cents = totals.subtotal
          state.currentOrder.tax_cents = totals.tax
          state.currentOrder.total_cents = totals.total
        }),

      updateItemQuantity: (itemId, quantity) =>
        set((state) => {
          if (!state.currentOrder) return
          const item = state.currentOrder.items.find((i) => i.id === itemId)
          if (item) {
            item.quantity = Math.max(0, quantity)
            const totals = calculateTotals(
              state.currentOrder.items,
              state.taxRates,
              state.currentOrder.order_type,
              state.currentOrder.for_here
            )
            state.currentOrder.subtotal_cents = totals.subtotal
            state.currentOrder.tax_cents = totals.tax
            state.currentOrder.total_cents = totals.total
          }
        }),

      updateItemModifiers: (itemId, modifiers) =>
        set((state) => {
          if (!state.currentOrder) return
          const item = state.currentOrder.items.find((i) => i.id === itemId)
          if (item) {
            item.modifiers = modifiers
            const totals = calculateTotals(
              state.currentOrder.items,
              state.taxRates,
              state.currentOrder.order_type,
              state.currentOrder.for_here
            )
            state.currentOrder.subtotal_cents = totals.subtotal
            state.currentOrder.tax_cents = totals.tax
            state.currentOrder.total_cents = totals.total
          }
        }),

      updateItemSpecialInstructions: (itemId, instructions) =>
        set((state) => {
          if (!state.currentOrder) return
          const item = state.currentOrder.items.find((i) => i.id === itemId)
          if (item) {
            item.special_instructions = instructions
          }
        }),

      voidItem: (itemId, reason) =>
        set((state) => {
          if (!state.currentOrder) return
          const item = state.currentOrder.items.find((i) => i.id === itemId)
          if (item) {
            item.voided = true
            item.void_reason = reason
            item.status = 'voided'
            const totals = calculateTotals(
              state.currentOrder.items,
              state.taxRates,
              state.currentOrder.order_type,
              state.currentOrder.for_here
            )
            state.currentOrder.subtotal_cents = totals.subtotal
            state.currentOrder.tax_cents = totals.tax
            state.currentOrder.total_cents = totals.total
          }
        }),

      removeItem: (itemId) =>
        set((state) => {
          if (!state.currentOrder) return
          state.currentOrder.items = state.currentOrder.items.filter((i) => i.id !== itemId)
          const totals = calculateTotals(
            state.currentOrder.items,
            state.taxRates,
            state.currentOrder.order_type,
            state.currentOrder.for_here
          )
          state.currentOrder.subtotal_cents = totals.subtotal
          state.currentOrder.tax_cents = totals.tax
          state.currentOrder.total_cents = totals.total
        }),

      setActiveSeat: (seat) =>
        set((state) => {
          state.activeSeat = seat
        }),

      setActiveCourse: (course) =>
        set((state) => {
          state.activeCourse = course
        }),

      setGuestCount: (count) =>
        set((state) => {
          if (state.currentOrder) state.currentOrder.guest_count = count
        }),

      setOrderType: (type) =>
        set((state) => {
          if (!state.currentOrder) return
          state.currentOrder.order_type = type
          // Recalculate tax when order type changes (for-here/to-go affects tax)
          const totals = calculateTotals(
            state.currentOrder.items,
            state.taxRates,
            state.currentOrder.order_type,
            state.currentOrder.for_here
          )
          state.currentOrder.subtotal_cents = totals.subtotal
          state.currentOrder.tax_cents = totals.tax
          state.currentOrder.total_cents = totals.total
        }),

      setForHere: (forHere) =>
        set((state) => {
          if (!state.currentOrder) return
          state.currentOrder.for_here = forHere
          // Recalculate tax when for-here/to-go changes
          const totals = calculateTotals(
            state.currentOrder.items,
            state.taxRates,
            state.currentOrder.order_type,
            state.currentOrder.for_here
          )
          state.currentOrder.subtotal_cents = totals.subtotal
          state.currentOrder.tax_cents = totals.tax
          state.currentOrder.total_cents = totals.total
        }),

      setCourseState: (course, courseState) =>
        set((state) => {
          state.courseStates[course] = courseState
        }),

      setTaxRates: (rates) =>
        set((state) => {
          state.taxRates = rates
          // Recalculate if there's an active order
          if (state.currentOrder) {
            const totals = calculateTotals(
              state.currentOrder.items,
              state.taxRates,
              state.currentOrder.order_type,
              state.currentOrder.for_here
            )
            state.currentOrder.subtotal_cents = totals.subtotal
            state.currentOrder.tax_cents = totals.tax
            state.currentOrder.total_cents = totals.total
          }
        }),

      setTable: (tableId, tableName) =>
        set((state) => {
          if (state.currentOrder) {
            state.currentOrder.table_id = tableId
            state.currentOrder.table_name = tableName
          }
        }),

      recalculateTotals: () =>
        set((state) => {
          if (!state.currentOrder) return
          const totals = calculateTotals(
            state.currentOrder.items,
            state.taxRates,
            state.currentOrder.order_type,
            state.currentOrder.for_here
          )
          state.currentOrder.subtotal_cents = totals.subtotal
          state.currentOrder.tax_cents = totals.tax
          state.currentOrder.total_cents = totals.total
        }),

      clearCurrentOrder: () =>
        set((state) => {
          state.currentOrder = null
          state.activeSeat = null
          state.activeCourse = 1
          state.courseStates = { 1: 'fire' }
        }),

      loadActiveOrders: (orders) =>
        set((state) => {
          state.activeOrders = {}
          orders.forEach((o) => {
            state.activeOrders[o.id] = o
          })
        }),

      updateActiveOrder: (order) =>
        set((state) => {
          state.activeOrders[order.id] = order
        }),

      removeActiveOrder: (orderId) =>
        set((state) => {
          delete state.activeOrders[orderId]
        }),
    },
  }))
)
