'use client'

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export type FilterMode = 'all' | 'active' | '86d' | 'low_stock' | 'has_photo' | 'no_photo'
export type ViewMode = 'grid' | 'list'

interface MenuBuilderState {
  selectedCategoryId: string | null
  selectedItemId: string | null
  selectedItemIds: Set<string>
  searchQuery: string
  filterMode: FilterMode
  viewMode: ViewMode
  isDetailOpen: boolean
  isMultiSelectMode: boolean
  isQuickAddOpen: boolean
  expandedCategoryIds: Set<string>
}

interface MenuBuilderActions {
  selectCategory: (id: string | null) => void
  selectItem: (id: string | null) => void
  toggleItemSelection: (id: string) => void
  selectAllItems: (ids: string[]) => void
  clearSelection: () => void
  setSearchQuery: (query: string) => void
  setFilterMode: (mode: FilterMode) => void
  setViewMode: (mode: ViewMode) => void
  openDetail: (itemId: string) => void
  closeDetail: () => void
  toggleMultiSelect: () => void
  setQuickAddOpen: (open: boolean) => void
  toggleCategoryExpanded: (id: string) => void
  expandAllCategories: (ids: string[]) => void
  collapseAllCategories: () => void
}

export const useMenuBuilderStore = create<MenuBuilderState & MenuBuilderActions>()(
  immer((set) => ({
    selectedCategoryId: null,
    selectedItemId: null,
    selectedItemIds: new Set<string>(),
    searchQuery: '',
    filterMode: 'all',
    viewMode: 'grid',
    isDetailOpen: false,
    isMultiSelectMode: false,
    isQuickAddOpen: false,
    expandedCategoryIds: new Set<string>(),

    selectCategory: (id) =>
      set((state) => {
        state.selectedCategoryId = id
        state.selectedItemIds = new Set()
      }),

    selectItem: (id) =>
      set((state) => {
        state.selectedItemId = id
        if (id) {
          state.isDetailOpen = true
        }
      }),

    toggleItemSelection: (id) =>
      set((state) => {
        const next = new Set(state.selectedItemIds)
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        state.selectedItemIds = next
      }),

    selectAllItems: (ids) =>
      set((state) => {
        state.selectedItemIds = new Set(ids)
      }),

    clearSelection: () =>
      set((state) => {
        state.selectedItemIds = new Set()
        state.isMultiSelectMode = false
      }),

    setSearchQuery: (query) =>
      set((state) => {
        state.searchQuery = query
      }),

    setFilterMode: (mode) =>
      set((state) => {
        state.filterMode = mode
      }),

    setViewMode: (mode) =>
      set((state) => {
        state.viewMode = mode
      }),

    openDetail: (itemId) =>
      set((state) => {
        state.selectedItemId = itemId
        state.isDetailOpen = true
      }),

    closeDetail: () =>
      set((state) => {
        state.isDetailOpen = false
        state.selectedItemId = null
      }),

    toggleMultiSelect: () =>
      set((state) => {
        state.isMultiSelectMode = !state.isMultiSelectMode
        if (!state.isMultiSelectMode) {
          state.selectedItemIds = new Set()
        }
      }),

    setQuickAddOpen: (open) =>
      set((state) => {
        state.isQuickAddOpen = open
      }),

    toggleCategoryExpanded: (id) =>
      set((state) => {
        const next = new Set(state.expandedCategoryIds)
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        state.expandedCategoryIds = next
      }),

    expandAllCategories: (ids) =>
      set((state) => {
        state.expandedCategoryIds = new Set(ids)
      }),

    collapseAllCategories: () =>
      set((state) => {
        state.expandedCategoryIds = new Set()
      }),
  }))
)
