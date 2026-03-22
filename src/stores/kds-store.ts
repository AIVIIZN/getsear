'use client'

import { create } from 'zustand'

type TicketAge = 'fresh' | 'aging' | 'late' | 'critical'

interface KdsTicketItem {
  id: string
  name: string
  quantity: number
  modifiers: string[]
  special_instructions: string
  seat_number: number | null
  course: number
  status: 'pending' | 'in_progress' | 'completed'
}

interface KdsTicket {
  id: string
  order_id: string
  order_number: string
  order_type: string
  server_name: string
  table_name: string | null
  items: KdsTicketItem[]
  created_at: string
  age_seconds: number
  age_category: TicketAge
  is_rush: boolean
  station_id: string
}

interface KdsStation {
  id: string
  name: string
  station_type: string
  sort_order: number
  is_active: boolean
}

// Aging thresholds in seconds
const AGE_THRESHOLDS = { fresh: 0, aging: 300, late: 600, critical: 900 }

function getAgeCategory(seconds: number): TicketAge {
  if (seconds >= AGE_THRESHOLDS.critical) return 'critical'
  if (seconds >= AGE_THRESHOLDS.late) return 'late'
  if (seconds >= AGE_THRESHOLDS.aging) return 'aging'
  return 'fresh'
}

interface KdsState {
  stations: KdsStation[]
  tickets: KdsTicket[]
  activeStationId: string | null
  soundEnabled: boolean
  actions: {
    setStations: (stations: KdsStation[]) => void
    setTickets: (tickets: KdsTicket[]) => void
    setActiveStation: (stationId: string) => void
    addTicket: (ticket: KdsTicket) => void
    bumpTicket: (ticketId: string) => void
    bumpAll: () => void
    recallTicket: (ticketId: string) => void
    toggleSound: () => void
    updateTicketAges: () => void
    getActiveTickets: () => KdsTicket[]
    getAllDayCounts: () => Record<string, number>
  }
}

export const useKdsStore = create<KdsState>()((set, get) => ({
  stations: [],
  tickets: [],
  activeStationId: null,
  soundEnabled: true,
  actions: {
    setStations: (stations) => set({ stations }),
    setTickets: (tickets) => set({ tickets }),
    setActiveStation: (stationId) => set({ activeStationId: stationId }),
    addTicket: (ticket) =>
      set((state) => ({ tickets: [...state.tickets, ticket] })),
    bumpTicket: (ticketId) =>
      set((state) => ({
        tickets: state.tickets.filter((t) => t.id !== ticketId),
      })),
    bumpAll: () => {
      const { activeStationId } = get()
      set((state) => ({
        tickets: state.tickets.filter((t) => t.station_id !== activeStationId),
      }))
    },
    recallTicket: (ticket) =>
      set((state) => ({
        tickets: [...state.tickets, ticket as unknown as KdsTicket],
      })),
    toggleSound: () =>
      set((state) => ({ soundEnabled: !state.soundEnabled })),
    updateTicketAges: () =>
      set((state) => ({
        tickets: state.tickets.map((t) => {
          const age = Math.floor((Date.now() - new Date(t.created_at).getTime()) / 1000)
          return { ...t, age_seconds: age, age_category: getAgeCategory(age) }
        }),
      })),
    getActiveTickets: () => {
      const { tickets, activeStationId } = get()
      if (!activeStationId) return tickets
      return tickets.filter((t) => t.station_id === activeStationId)
    },
    getAllDayCounts: () => {
      const { tickets, activeStationId } = get()
      const filtered = activeStationId
        ? tickets.filter((t) => t.station_id === activeStationId)
        : tickets
      const counts: Record<string, number> = {}
      filtered.forEach((t) => {
        t.items.forEach((item) => {
          counts[item.name] = (counts[item.name] ?? 0) + item.quantity
        })
      })
      return counts
    },
  },
}))
