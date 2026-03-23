'use client'

import { create } from 'zustand'
import { getCachedTables, getCachedFloorPlans } from '@/lib/offline/tables-cache'

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
    /** Load tables from IndexedDB cache (offline mode) */
    loadFromCache: (locationId: string) => Promise<void>
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
    loadFromCache: async (locationId: string) => {
      try {
        const [cachedTables, cachedPlans] = await Promise.all([
          getCachedTables(locationId),
          getCachedFloorPlans(locationId),
        ])
        const tables: RestaurantTable[] = cachedTables.map((t) => ({
          id: t.id,
          name: t.name,
          section: t.section,
          status: t.status as TableStatus,
          capacity: t.capacity,
          position_x: t.position_x,
          position_y: t.position_y,
          shape: t.shape as TableShape,
          current_order_id: t.current_order_id,
          current_server_id: t.current_server_id,
          current_server_name: t.current_server_name,
          guest_count: t.guest_count,
          seated_at: t.seated_at,
          floor_plan_id: t.floor_plan_id,
        }))
        const floorPlans: FloorPlan[] = cachedPlans.map((fp) => ({
          id: fp.id,
          name: fp.name,
          is_default: fp.is_default,
        }))
        set({ tables })
        if (floorPlans.length > 0) {
          set({ floorPlans })
          const defaultPlan = floorPlans.find((p) => p.is_default)
          if (defaultPlan) set({ activeFloorPlanId: defaultPlan.id })
        }
      } catch (error) {
        console.error('[TableStore] Failed to load from cache:', error)
      }
    },
  },
}))
