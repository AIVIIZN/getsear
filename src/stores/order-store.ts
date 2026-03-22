'use client'

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

type OrderType = 'dine_in' | 'takeout' | 'delivery' | 'bar' | 'catering' | 'online' | 'kiosk' | 'drive_thru' | 'qr'
type OrderStatus = 'draft' | 'open' | 'fired' | 'ready' | 'served' | 'closed' | 'voided'

interface OrderModifier {
  id: string
  modifier_id: string
  name: string
  price_cents: number
  quantity: number
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
}

interface OrderState {
  currentOrder: Order | null
  activeOrders: Record<string, Order>
  activeSeat: number | null
  activeCourse: number
  actions: {
    newOrder: (params: { order_type: OrderType; server_id: string; server_name: string; table_id?: string; table_name?: string }) => void
    setCurrentOrder: (order: Order | null) => void
    addItem: (item: { menu_item_id: string; name: string; price_cents: number; modifiers?: OrderModifier[]; special_instructions?: string }) => void
    updateItemQuantity: (itemId: string, quantity: number) => void
    voidItem: (itemId: string, reason: string) => void
    removeItem: (itemId: string) => void
    setActiveSeat: (seat: number | null) => void
    setActiveCourse: (course: number) => void
    setGuestCount: (count: number) => void
    setOrderType: (type: OrderType) => void
    setTable: (tableId: string, tableName: string) => void
    recalculateTotals: () => void
    clearCurrentOrder: () => void
    loadActiveOrders: (orders: Order[]) => void
    updateActiveOrder: (order: Order) => void
    removeActiveOrder: (orderId: string) => void
  }
}

function calculateTotals(items: OrderItem[]): { subtotal: number; tax: number; total: number } {
  const subtotal = items
    .filter((i) => !i.voided)
    .reduce((sum, item) => {
      const itemTotal = item.price_cents * item.quantity
      const modTotal = item.modifiers.reduce((m, mod) => m + mod.price_cents * mod.quantity, 0)
      return sum + itemTotal + modTotal
    }, 0)
  // Default 8.5% tax — will be replaced by location-specific rate
  const tax = Math.round(subtotal * 0.085)
  return { subtotal, tax, total: subtotal + tax }
}

export const useOrderStore = create<OrderState>()(
  immer((set) => ({
    currentOrder: null,
    activeOrders: {},
    activeSeat: null,
    activeCourse: 1,
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
          }
          state.activeSeat = null
          state.activeCourse = 1
        }),

      setCurrentOrder: (order) =>
        set((state) => {
          state.currentOrder = order
        }),

      addItem: ({ menu_item_id, name, price_cents, modifiers, special_instructions }) =>
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
          })
          const totals = calculateTotals(state.currentOrder.items)
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
            const totals = calculateTotals(state.currentOrder.items)
            state.currentOrder.subtotal_cents = totals.subtotal
            state.currentOrder.tax_cents = totals.tax
            state.currentOrder.total_cents = totals.total
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
            const totals = calculateTotals(state.currentOrder.items)
            state.currentOrder.subtotal_cents = totals.subtotal
            state.currentOrder.tax_cents = totals.tax
            state.currentOrder.total_cents = totals.total
          }
        }),

      removeItem: (itemId) =>
        set((state) => {
          if (!state.currentOrder) return
          state.currentOrder.items = state.currentOrder.items.filter((i) => i.id !== itemId)
          const totals = calculateTotals(state.currentOrder.items)
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
          if (state.currentOrder) state.currentOrder.order_type = type
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
          const totals = calculateTotals(state.currentOrder.items)
          state.currentOrder.subtotal_cents = totals.subtotal
          state.currentOrder.tax_cents = totals.tax
          state.currentOrder.total_cents = totals.total
        }),

      clearCurrentOrder: () =>
        set((state) => {
          state.currentOrder = null
          state.activeSeat = null
          state.activeCourse = 1
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
