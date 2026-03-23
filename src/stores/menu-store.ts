'use client'

import { create } from 'zustand'
import { getCachedCategories, getCachedMenuItems } from '@/lib/offline/menu-cache'

interface Modifier {
  id: string
  name: string
  price_cents: number
  is_available: boolean
  sort_order: number
}

interface ModifierGroup {
  id: string
  name: string
  is_required: boolean
  min_selections: number
  max_selections: number
  modifiers: Modifier[]
}

type PriceType = 'fixed' | 'open' | 'market_price'

interface ComboSlot {
  id: string
  name: string
  sort_order: number
  options: ComboSlotOption[]
}

interface ComboSlotOption {
  id: string
  menu_item_id: string
  name: string
  upcharge_cents: number
  is_default: boolean
  modifier_groups: ModifierGroup[]
}

interface MenuItem {
  id: string
  name: string
  description: string
  price_cents: number
  category_id: string
  is_available: boolean
  is_taxable: boolean
  sort_order: number
  image_url: string | null
  allergens: string[]
  modifier_groups: ModifierGroup[]
  price_type: PriceType
  min_price_cents: number | null
  max_price_cents: number | null
  combo_group_id: string | null
  combo_name: string | null
  combo_price_cents: number | null
  combo_slots: ComboSlot[]
}

interface MenuCategory {
  id: string
  name: string
  color: string
  sort_order: number
  is_active: boolean
  item_count: number
}

interface MenuState {
  categories: MenuCategory[]
  items: MenuItem[]
  activeCategoryId: string | null
  searchQuery: string
  isLoading: boolean
  actions: {
    setCategories: (categories: MenuCategory[]) => void
    setItems: (items: MenuItem[]) => void
    setActiveCategory: (categoryId: string | null) => void
    setSearchQuery: (query: string) => void
    setLoading: (loading: boolean) => void
    toggleItemAvailability: (itemId: string) => void
    update86Status: (itemId: string, is86d: boolean) => void
    getFilteredItems: () => MenuItem[]
    /** Load menu from IndexedDB cache (offline mode) */
    loadFromCache: (locationId: string) => Promise<void>
  }
}

export const useMenuStore = create<MenuState>()((set, get) => ({
  categories: [],
  items: [],
  activeCategoryId: null,
  searchQuery: '',
  isLoading: false,
  actions: {
    setCategories: (categories) => set({ categories }),
    setItems: (items) => set({ items }),
    setActiveCategory: (categoryId) => set({ activeCategoryId: categoryId }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    setLoading: (loading) => set({ isLoading: loading }),
    toggleItemAvailability: (itemId) =>
      set((state) => ({
        items: state.items.map((item) =>
          item.id === itemId ? { ...item, is_available: !item.is_available } : item
        ),
      })),
    update86Status: (itemId, is86d) =>
      set((state) => ({
        items: state.items.map((item) =>
          item.id === itemId ? { ...item, is_available: !is86d } : item
        ),
      })),
    getFilteredItems: () => {
      const { items, activeCategoryId, searchQuery } = get()
      let filtered = items.filter((i) => i.is_available)
      if (activeCategoryId) {
        filtered = filtered.filter((i) => i.category_id === activeCategoryId)
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        filtered = filtered.filter(
          (i) => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)
        )
      }
      return filtered.sort((a, b) => a.sort_order - b.sort_order)
    },
    loadFromCache: async (locationId: string) => {
      try {
        set({ isLoading: true })
        const [cachedCategories, cachedItems] = await Promise.all([
          getCachedCategories(locationId),
          getCachedMenuItems(locationId),
        ])
        const categories: MenuCategory[] = cachedCategories.map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color,
          sort_order: c.sort_order,
          is_active: c.is_active,
          item_count: c.item_count,
        }))
        const items: MenuItem[] = cachedItems.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price_cents: item.price_cents,
          category_id: item.category_id,
          is_available: item.is_available,
          is_taxable: item.is_taxable,
          sort_order: item.sort_order,
          image_url: item.image_url,
          allergens: item.allergens,
          modifier_groups: item.modifier_groups,
          price_type: item.price_type as PriceType,
          min_price_cents: item.min_price_cents,
          max_price_cents: item.max_price_cents,
          combo_group_id: item.combo_group_id,
          combo_name: item.combo_name,
          combo_price_cents: item.combo_price_cents,
          combo_slots: item.combo_slots,
        }))
        set({ categories, items, isLoading: false })
      } catch (error) {
        console.error('[MenuStore] Failed to load from cache:', error)
        set({ isLoading: false })
      }
    },
  },
}))
