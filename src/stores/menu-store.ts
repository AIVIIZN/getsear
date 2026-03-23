'use client'

import { create } from 'zustand'

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
  },
}))
