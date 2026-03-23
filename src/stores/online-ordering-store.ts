'use client'

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export interface PublicMenuItem {
  id: string
  name: string
  description: string
  price: number // cents
  category_id: string
  category_name: string
  image_url: string | null
  modifiers: Array<{
    id: string
    name: string
    options: Array<{
      id: string
      name: string
      price: number // cents
    }>
    required: boolean
    max_selections: number
  }>
  is_available: boolean
}

export interface CartItem {
  id: string // unique cart item id
  menu_item_id: string
  name: string
  price: number // cents (base price)
  quantity: number
  modifiers: Array<{
    modifier_id: string
    modifier_name: string
    option_id: string
    option_name: string
    option_price: number
  }>
  subtotal: number // cents
  special_instructions: string
}

export interface OnlineOrderingState {
  locationSlug: string | null
  locationName: string | null
  menu: PublicMenuItem[]
  categories: Array<{ id: string; name: string }>
  activeCategory: string | null
  cart: CartItem[]
  customerName: string
  customerPhone: string
  orderType: 'pickup' | 'delivery'
  scheduledTime: string | null
  deliveryAddress: string
  isMenuLoading: boolean
  isSubmitting: boolean
}

interface OnlineOrderingActions {
  setLocationSlug: (slug: string) => void
  setLocationName: (name: string) => void
  setMenu: (items: PublicMenuItem[]) => void
  setCategories: (categories: Array<{ id: string; name: string }>) => void
  setActiveCategory: (id: string | null) => void
  addToCart: (item: CartItem) => void
  removeFromCart: (cartItemId: string) => void
  updateCartItemQuantity: (cartItemId: string, quantity: number) => void
  clearCart: () => void
  setCustomerName: (name: string) => void
  setCustomerPhone: (phone: string) => void
  setOrderType: (type: 'pickup' | 'delivery') => void
  setScheduledTime: (time: string | null) => void
  setDeliveryAddress: (address: string) => void
  setIsMenuLoading: (loading: boolean) => void
  setIsSubmitting: (submitting: boolean) => void
  getCartTotal: () => number
  getCartItemCount: () => number
}

export const useOnlineOrderingStore = create<OnlineOrderingState & OnlineOrderingActions>()(
  immer((set, get) => ({
    locationSlug: null,
    locationName: null,
    menu: [],
    categories: [],
    activeCategory: null,
    cart: [],
    customerName: '',
    customerPhone: '',
    orderType: 'pickup',
    scheduledTime: null,
    deliveryAddress: '',
    isMenuLoading: false,
    isSubmitting: false,

    setLocationSlug: (slug) => set((s) => { s.locationSlug = slug }),
    setLocationName: (name) => set((s) => { s.locationName = name }),
    setMenu: (items) => set((s) => { s.menu = items }),
    setCategories: (categories) => set((s) => { s.categories = categories }),
    setActiveCategory: (id) => set((s) => { s.activeCategory = id }),
    addToCart: (item) => set((s) => { s.cart.push(item) }),
    removeFromCart: (cartItemId) =>
      set((s) => { s.cart = s.cart.filter((i) => i.id !== cartItemId) }),
    updateCartItemQuantity: (cartItemId, quantity) =>
      set((s) => {
        const item = s.cart.find((i) => i.id === cartItemId)
        if (item) {
          item.quantity = quantity
          item.subtotal = (item.price + item.modifiers.reduce((sum, m) => sum + m.option_price, 0)) * quantity
        }
      }),
    clearCart: () => set((s) => { s.cart = [] }),
    setCustomerName: (name) => set((s) => { s.customerName = name }),
    setCustomerPhone: (phone) => set((s) => { s.customerPhone = phone }),
    setOrderType: (type) => set((s) => { s.orderType = type }),
    setScheduledTime: (time) => set((s) => { s.scheduledTime = time }),
    setDeliveryAddress: (address) => set((s) => { s.deliveryAddress = address }),
    setIsMenuLoading: (loading) => set((s) => { s.isMenuLoading = loading }),
    setIsSubmitting: (submitting) => set((s) => { s.isSubmitting = submitting }),
    getCartTotal: () => get().cart.reduce((sum, item) => sum + item.subtotal, 0),
    getCartItemCount: () => get().cart.reduce((sum, item) => sum + item.quantity, 0),
  }))
)
