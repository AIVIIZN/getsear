'use client'

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InventoryItem {
  id: string
  org_id: string
  location_id: string | null
  name: string
  unit: string
  par_level: number
  reorder_point: number
  current_stock: number
  unit_cost: string
  category: string | null
  supplier_id: string | null
  is_active: boolean
  auto_86: boolean
  created_at: string
}

export interface WasteEntry {
  id: string
  org_id: string
  location_id: string
  inventory_item_id: string
  item_name: string
  quantity: number
  unit: string
  reason: 'expired' | 'dropped' | 'returned' | 'overproduction' | 'other'
  notes: string | null
  recorded_by: string
  recorded_by_name: string
  dollar_value: number
  created_at: string
}

export interface FoodCostData {
  category: string
  theoretical_cost: number
  actual_cost: number
  revenue: number
  theoretical_pct: number
  actual_pct: number
  variance_pct: number
  is_flagged: boolean
}

export interface PrepListItem {
  inventory_item_id: string
  item_name: string
  unit: string
  current_count: number
  par_level: number
  avg_daily_usage: number
  prep_quantity: number
  priority: 'critical' | 'high' | 'normal'
  category: string
}

export interface LowStockAlert {
  id: string
  item_name: string
  current_stock: number
  par_level: number
  reorder_point: number
  unit: string
  severity: 'critical' | 'warning'
}

interface InventoryState {
  items: InventoryItem[]
  wasteEntries: WasteEntry[]
  foodCostData: FoodCostData[]
  prepList: PrepListItem[]
  lowStockAlerts: LowStockAlert[]
  activeTab: string
  isLoading: boolean
  foodCostSummary: {
    theoretical_pct: number
    actual_pct: number
    variance_pct: number
  } | null
}

interface InventoryActions {
  setItems: (items: InventoryItem[]) => void
  setWasteEntries: (entries: WasteEntry[]) => void
  setFoodCostData: (data: FoodCostData[]) => void
  setPrepList: (list: PrepListItem[]) => void
  setLowStockAlerts: (alerts: LowStockAlert[]) => void
  setActiveTab: (tab: string) => void
  setIsLoading: (loading: boolean) => void
  setFoodCostSummary: (summary: InventoryState['foodCostSummary']) => void
  addWasteEntry: (entry: WasteEntry) => void
  updateItemStock: (itemId: string, newStock: number) => void
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useInventoryStore = create<InventoryState & InventoryActions>()(
  immer((set) => ({
    items: [],
    wasteEntries: [],
    foodCostData: [],
    prepList: [],
    lowStockAlerts: [],
    activeTab: 'dashboard',
    isLoading: false,
    foodCostSummary: null,

    setItems: (items) =>
      set((state) => {
        state.items = items
      }),
    setWasteEntries: (entries) =>
      set((state) => {
        state.wasteEntries = entries
      }),
    setFoodCostData: (data) =>
      set((state) => {
        state.foodCostData = data
      }),
    setPrepList: (list) =>
      set((state) => {
        state.prepList = list
      }),
    setLowStockAlerts: (alerts) =>
      set((state) => {
        state.lowStockAlerts = alerts
      }),
    setActiveTab: (tab) =>
      set((state) => {
        state.activeTab = tab
      }),
    setIsLoading: (loading) =>
      set((state) => {
        state.isLoading = loading
      }),
    setFoodCostSummary: (summary) =>
      set((state) => {
        state.foodCostSummary = summary
      }),
    addWasteEntry: (entry) =>
      set((state) => {
        state.wasteEntries.unshift(entry)
      }),
    updateItemStock: (itemId, newStock) =>
      set((state) => {
        const item = state.items.find((i) => i.id === itemId)
        if (item) item.current_stock = newStock
      }),
  }))
)
