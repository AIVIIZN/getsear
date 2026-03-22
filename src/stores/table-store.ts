'use client'

import { create } from 'zustand'

type TableStatus = 'available' | 'seated' | 'ordered' | 'served' | 'check_presented' | 'dirty' | 'reserved' | 'needs_attention'

interface TableShape {
  type: 'square' | 'round' | 'rectangle' | 'booth' | 'bar'
  width: number
  height: number
}

interface RestaurantTable {
  id: string
  name: string
  section: string
  status: TableStatus
  capacity: number
  position_x: number
  position_y: number
  shape: TableShape
  current_order_id: string | null
  current_server_id: string | null
  current_server_name: string | null
  guest_count: number
  seated_at: string | null
  floor_plan_id: string
}

interface FloorPlan {
  id: string
  name: string
  is_default: boolean
}

interface TableState {
  tables: RestaurantTable[]
  floorPlans: FloorPlan[]
  activeFloorPlanId: string | null
  activeSectionFilter: string | null
  editMode: boolean
  actions: {
    setTables: (tables: RestaurantTable[]) => void
    setFloorPlans: (plans: FloorPlan[]) => void
    setActiveFloorPlan: (id: string) => void
    setSectionFilter: (section: string | null) => void
    setEditMode: (editing: boolean) => void
    updateTableStatus: (tableId: string, status: TableStatus) => void
    updateTablePosition: (tableId: string, x: number, y: number) => void
    getFilteredTables: () => RestaurantTable[]
    getSections: () => string[]
  }
}

export const useTableStore = create<TableState>()((set, get) => ({
  tables: [],
  floorPlans: [],
  activeFloorPlanId: null,
  activeSectionFilter: null,
  editMode: false,
  actions: {
    setTables: (tables) => set({ tables }),
    setFloorPlans: (plans) => {
      set({ floorPlans: plans })
      const defaultPlan = plans.find((p) => p.is_default)
      if (defaultPlan) set({ activeFloorPlanId: defaultPlan.id })
    },
    setActiveFloorPlan: (id) => set({ activeFloorPlanId: id }),
    setSectionFilter: (section) => set({ activeSectionFilter: section }),
    setEditMode: (editing) => set({ editMode: editing }),
    updateTableStatus: (tableId, status) =>
      set((state) => ({
        tables: state.tables.map((t) =>
          t.id === tableId ? { ...t, status } : t
        ),
      })),
    updateTablePosition: (tableId, x, y) =>
      set((state) => ({
        tables: state.tables.map((t) =>
          t.id === tableId ? { ...t, position_x: x, position_y: y } : t
        ),
      })),
    getFilteredTables: () => {
      const { tables, activeFloorPlanId, activeSectionFilter } = get()
      let filtered = tables
      if (activeFloorPlanId) {
        filtered = filtered.filter((t) => t.floor_plan_id === activeFloorPlanId)
      }
      if (activeSectionFilter) {
        filtered = filtered.filter((t) => t.section === activeSectionFilter)
      }
      return filtered
    },
    getSections: () => {
      const { tables } = get()
      return [...new Set(tables.map((t) => t.section))].sort()
    },
  },
}))
