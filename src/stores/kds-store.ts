'use client'

import { create } from 'zustand'
import { type TicketPriority, sortTicketsByPriority, resolveTicketPriority } from '@/lib/kds/priority-sort'
import { detectTicketAllergens } from '@/lib/kds/allergen-detector'

export type TicketAge = 'fresh' | 'aging' | 'late' | 'critical'

export type ItemStatus = 'pending' | 'in_progress' | 'completed' | 'voided' | 'held'

export type RefireReasonCode =
  | 'dropped'
  | 'wrong_temp'
  | 'wrong_item'
  | 'contamination'
  | 'customer_complaint'
  | 'expo_quality'
  | 'other'

export const REFIRE_REASON_LABELS: Record<RefireReasonCode, string> = {
  dropped: 'Dropped',
  wrong_temp: 'Wrong Temp',
  wrong_item: 'Wrong Item',
  contamination: 'Contamination',
  customer_complaint: 'Customer Complaint',
  expo_quality: 'Expo Quality',
  other: 'Other',
}

export interface KdsTicketItem {
  id: string
  name: string
  quantity: number
  modifiers: string[]
  special_instructions: string
  seat_number: number | null
  course: number
  status: ItemStatus
  is_void?: boolean
  is_fired?: boolean
  is_bumped?: boolean
  is_refire?: boolean
  is_add?: boolean
  refire_count?: number
  refire_reason?: RefireReasonCode
  prep_station?: string
  station_label?: string // display label like "GRILL", "FRY"
  category_id?: string
  item_age_category?: TicketAge
}

export interface KdsTicket {
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
  is_vip?: boolean
  is_refire?: boolean
  is_add?: boolean
  station_id: string
  priority: TicketPriority
  allergens: string[] | null
  has_allergens: boolean
  // Expo-specific
  station_statuses?: Record<string, 'pending' | 'complete'> // station_name -> status
  is_ready_to_run?: boolean
}

export interface KdsStation {
  id: string
  name: string
  station_type: string
  sort_order: number
  is_active: boolean
  prep_stations?: string[]
  display_settings?: {
    columns?: number
    font_size?: string
    sound_enabled?: boolean
    aging_thresholds?: {
      aging?: number
      late?: number
      critical?: number
    }
    max_capacity?: number
  }
  max_capacity?: number
  is_online?: boolean
  last_heartbeat_at?: string
}

interface CategoryThreshold {
  category_id: string
  category_name: string
  fresh_max_seconds: number
  aging_max_seconds: number
  late_max_seconds: number
}

interface CapacityInfo {
  activeTickets: number
  totalItems: number
  maxCapacity: number
  utilization: number
}

// Default aging thresholds in seconds
const DEFAULT_THRESHOLDS = { fresh: 0, aging: 300, late: 600, critical: 900 }

function getAgeCategory(seconds: number, thresholds?: { aging?: number; late?: number; critical?: number }): TicketAge {
  const t = {
    aging: thresholds?.aging ?? DEFAULT_THRESHOLDS.aging,
    late: thresholds?.late ?? DEFAULT_THRESHOLDS.late,
    critical: thresholds?.critical ?? DEFAULT_THRESHOLDS.critical,
  }
  if (seconds >= t.critical) return 'critical'
  if (seconds >= t.late) return 'late'
  if (seconds >= t.aging) return 'aging'
  return 'fresh'
}

/** Get the worst (most urgent) age category from a list */
function getWorstAgeCategory(categories: TicketAge[]): TicketAge {
  const rank: Record<TicketAge, number> = { fresh: 0, aging: 1, late: 2, critical: 3 }
  let worst: TicketAge = 'fresh'
  for (const cat of categories) {
    if (rank[cat] > rank[worst]) worst = cat
  }
  return worst
}

export interface KdsMessageData {
  id: string
  from_station_id: string
  from_station_name: string
  to_station_id: string | null
  to_station_name: string | null
  message: string
  message_type: 'quick' | 'custom'
  is_read: boolean
  read_by: string[]
  created_at: string
  location_id: string
}

type StationHealth = 'online' | 'degraded' | 'offline'

interface StationHealthInfo {
  health: StationHealth
  failoverActive: boolean
  lastHeartbeatAt: string | null
}

interface KdsState {
  stations: KdsStation[]
  tickets: KdsTicket[]
  activeStationId: string | null
  soundEnabled: boolean
  isKitchenClosed: boolean
  categoryThresholds: CategoryThreshold[]
  messages: KdsMessageData[]
  unreadCount: number
  stationHealth: Record<string, StationHealthInfo>
  actions: {
    setStations: (stations: KdsStation[]) => void
    setTickets: (tickets: KdsTicket[]) => void
    setActiveStation: (stationId: string) => void
    addTicket: (ticket: KdsTicket) => void
    bumpTicket: (ticketId: string) => void
    bumpItem: (ticketId: string, itemId: string) => void
    bumpAll: () => void
    recallTicket: (ticketId: string) => void
    refireItem: (ticketId: string, itemId: string, reason: RefireReasonCode) => void
    toggleSound: () => void
    updateTicketAges: () => void
    getActiveTickets: () => KdsTicket[]
    getSortedActiveTickets: () => KdsTicket[]
    getAllDayCounts: () => Record<string, number>
    getAllDayCountsByCategory: () => Record<string, Record<string, number>>
    getCapacity: () => CapacityInfo
    getPriorityCount: () => number
    getActiveStation: () => KdsStation | undefined
    setKitchenClosed: (closed: boolean) => void
    setCategoryThresholds: (thresholds: CategoryThreshold[]) => void
    // Message actions
    setMessages: (messages: KdsMessageData[]) => void
    addMessage: (message: KdsMessageData) => void
    markMessageRead: (messageId: string) => void
    getUnreadCount: () => number
    // Station health actions
    setStationHealth: (stationId: string, health: StationHealthInfo) => void
    setStationOnline: (stationId: string) => void
    setStationOffline: (stationId: string, failoverActive: boolean) => void
    /** Start listening for offline orders via BroadcastChannel */
    startOfflineListener: () => void
  }
}

export const useKdsStore = create<KdsState>()((set, get) => ({
  stations: [],
  tickets: [],
  activeStationId: null,
  soundEnabled: true,
  isKitchenClosed: false,
  categoryThresholds: [],
  messages: [],
  unreadCount: 0,
  stationHealth: {},
  actions: {
    setStations: (stations) => set({ stations }),
    setTickets: (tickets) => {
      // Process tickets: detect allergens, resolve priorities
      const processed = tickets.map((t) => {
        const allergenResult = detectTicketAllergens(t.items)
        const priority = resolveTicketPriority(t)
        return {
          ...t,
          priority,
          has_allergens: allergenResult.hasAllergens,
          allergens: allergenResult.hasAllergens ? allergenResult.allergenList : null,
        }
      })
      set({ tickets: processed })
    },
    setActiveStation: (stationId) => set({ activeStationId: stationId }),
    addTicket: (ticket) => {
      const allergenResult = detectTicketAllergens(ticket.items)
      const priority = resolveTicketPriority(ticket)
      set((state) => ({
        tickets: [
          ...state.tickets,
          {
            ...ticket,
            priority,
            has_allergens: allergenResult.hasAllergens,
            allergens: allergenResult.hasAllergens ? allergenResult.allergenList : null,
          },
        ],
      }))
    },
    bumpTicket: (ticketId) =>
      set((state) => ({
        tickets: state.tickets.filter((t) => t.id !== ticketId),
      })),
    bumpItem: (ticketId, itemId) =>
      set((state) => ({
        tickets: state.tickets.map((t) => {
          if (t.id !== ticketId) return t
          const updatedItems = t.items.map((item) =>
            item.id === itemId
              ? { ...item, is_bumped: true, status: 'completed' as ItemStatus }
              : item
          )
          // Check if all non-void items are now bumped
          const allBumped = updatedItems
            .filter((item) => !item.is_void && item.status !== 'held')
            .every((item) => item.is_bumped || item.status === 'completed')
          if (allBumped) {
            // Will be removed after animation
            return { ...t, items: updatedItems }
          }
          return { ...t, items: updatedItems }
        }),
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
    refireItem: (ticketId, itemId, reason) =>
      set((state) => ({
        tickets: state.tickets.map((t) => {
          if (t.id !== ticketId) return t
          const updatedItems = t.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  is_bumped: false,
                  is_refire: true,
                  refire_reason: reason,
                  refire_count: (item.refire_count ?? 0) + 1,
                  status: 'pending' as ItemStatus,
                }
              : item
          )
          return {
            ...t,
            items: updatedItems,
            priority: 'refire' as TicketPriority,
            is_refire: true,
          }
        }),
      })),
    toggleSound: () =>
      set((state) => ({ soundEnabled: !state.soundEnabled })),
    updateTicketAges: () => {
      const { categoryThresholds } = get()
      const thresholdMap = new Map<string, CategoryThreshold>()
      for (const ct of categoryThresholds) {
        thresholdMap.set(ct.category_id, ct)
      }

      set((state) => ({
        tickets: state.tickets.map((t) => {
          const age = Math.floor((Date.now() - new Date(t.created_at).getTime()) / 1000)

          // Calculate per-item age categories
          const itemAgeCategories: TicketAge[] = []
          const updatedItems = t.items.map((item) => {
            if (item.is_void || item.is_bumped) return item
            const categoryThreshold = item.category_id ? thresholdMap.get(item.category_id) : undefined
            const itemAge = getAgeCategory(age, categoryThreshold ? {
              aging: categoryThreshold.fresh_max_seconds,
              late: categoryThreshold.aging_max_seconds,
              critical: categoryThreshold.late_max_seconds,
            } : undefined)
            itemAgeCategories.push(itemAge)
            return { ...item, item_age_category: itemAge }
          })

          // Ticket-level aging is worst of any item
          const ticketAge = itemAgeCategories.length > 0
            ? getWorstAgeCategory(itemAgeCategories)
            : getAgeCategory(age)

          return { ...t, items: updatedItems, age_seconds: age, age_category: ticketAge }
        }),
      }))
    },
    getActiveTickets: () => {
      const { tickets, activeStationId } = get()
      if (!activeStationId) return tickets
      return tickets.filter((t) => t.station_id === activeStationId)
    },
    getSortedActiveTickets: () => {
      const { tickets, activeStationId } = get()
      const filtered = activeStationId
        ? tickets.filter((t) => t.station_id === activeStationId)
        : tickets
      return sortTicketsByPriority(filtered)
    },
    getAllDayCounts: () => {
      const { tickets, activeStationId } = get()
      const filtered = activeStationId
        ? tickets.filter((t) => t.station_id === activeStationId)
        : tickets
      const counts: Record<string, number> = {}
      filtered.forEach((t) => {
        t.items.forEach((item) => {
          if (!item.is_void && !item.is_bumped) {
            counts[item.name] = (counts[item.name] ?? 0) + item.quantity
          }
        })
      })
      return counts
    },
    getAllDayCountsByCategory: () => {
      const { tickets, activeStationId } = get()
      const filtered = activeStationId
        ? tickets.filter((t) => t.station_id === activeStationId)
        : tickets
      const categories: Record<string, Record<string, number>> = {}
      filtered.forEach((t) => {
        t.items.forEach((item) => {
          if (!item.is_void && !item.is_bumped) {
            const cat = item.station_label ?? item.prep_station ?? 'Other'
            if (!categories[cat]) categories[cat] = {}
            categories[cat][item.name] = (categories[cat][item.name] ?? 0) + item.quantity
          }
        })
      })
      return categories
    },
    getCapacity: () => {
      const { tickets, activeStationId, stations } = get()
      const filtered = activeStationId
        ? tickets.filter((t) => t.station_id === activeStationId)
        : tickets
      const activeStation = stations.find((s) => s.id === activeStationId)
      const maxCapacity = activeStation?.max_capacity ?? activeStation?.display_settings?.max_capacity ?? 30
      const totalItems = filtered.reduce(
        (sum, t) => sum + t.items.filter((i) => !i.is_void && !i.is_bumped).length,
        0
      )
      const utilization = maxCapacity > 0 ? Math.round((totalItems / maxCapacity) * 100) : 0

      return {
        activeTickets: filtered.length,
        totalItems,
        maxCapacity,
        utilization,
      }
    },
    getPriorityCount: () => {
      const { tickets, activeStationId } = get()
      const filtered = activeStationId
        ? tickets.filter((t) => t.station_id === activeStationId)
        : tickets
      return filtered.filter(
        (t) => t.priority === 'refire' || t.priority === 'rush' || t.priority === 'vip'
      ).length
    },
    getActiveStation: () => {
      const { stations, activeStationId } = get()
      return stations.find((s) => s.id === activeStationId)
    },
    setKitchenClosed: (closed) => set({ isKitchenClosed: closed }),
    setCategoryThresholds: (thresholds) => set({ categoryThresholds: thresholds }),
    // Message actions
    setMessages: (messages) => {
      const { activeStationId } = get()
      const unread = activeStationId
        ? messages.filter(
            (m) =>
              m.from_station_id !== activeStationId &&
              !(m.read_by ?? []).includes(activeStationId)
          ).length
        : 0
      set({ messages, unreadCount: unread })
    },
    addMessage: (message) => {
      const { activeStationId } = get()
      set((state) => {
        const messages = [...state.messages, message]
        const isFromMe = message.from_station_id === activeStationId
        const unreadCount = isFromMe ? state.unreadCount : state.unreadCount + 1
        return { messages, unreadCount }
      })
    },
    markMessageRead: (messageId) => {
      const { activeStationId } = get()
      set((state) => {
        const messages = state.messages.map((m) => {
          if (m.id !== messageId) return m
          const readBy = [...(m.read_by ?? [])]
          if (activeStationId && !readBy.includes(activeStationId)) {
            readBy.push(activeStationId)
          }
          return { ...m, read_by: readBy, is_read: true }
        })
        const unread = activeStationId
          ? messages.filter(
              (m) =>
                m.from_station_id !== activeStationId &&
                !(m.read_by ?? []).includes(activeStationId)
            ).length
          : 0
        return { messages, unreadCount: unread }
      })
    },
    getUnreadCount: () => {
      const { messages, activeStationId } = get()
      if (!activeStationId) return 0
      return messages.filter(
        (m) =>
          m.from_station_id !== activeStationId &&
          !(m.read_by ?? []).includes(activeStationId)
      ).length
    },
    // Station health actions
    setStationHealth: (stationId, health) =>
      set((state) => ({
        stationHealth: { ...state.stationHealth, [stationId]: health },
      })),
    setStationOnline: (stationId) =>
      set((state) => ({
        stationHealth: {
          ...state.stationHealth,
          [stationId]: {
            health: 'online' as StationHealth,
            failoverActive: false,
            lastHeartbeatAt: new Date().toISOString(),
          },
        },
      })),
    setStationOffline: (stationId, failoverActive) =>
      set((state) => ({
        stationHealth: {
          ...state.stationHealth,
          [stationId]: {
            health: 'offline' as StationHealth,
            failoverActive,
            lastHeartbeatAt: state.stationHealth[stationId]?.lastHeartbeatAt ?? null,
          },
        },
      })),
    /**
     * Start listening for offline orders via BroadcastChannel.
     * Offline orders from other tabs are pushed here for KDS display.
     */
    startOfflineListener: () => {
      if (typeof BroadcastChannel === 'undefined') return
      const channel = new BroadcastChannel('sear-kds-offline')
      channel.addEventListener('message', (event: MessageEvent) => {
        if (event.data?.type === 'offline_order') {
          const order = event.data.order
          if (!order) return
          // Convert offline order to KDS ticket
          const ticket: KdsTicket = {
            id: `ofl-${order.id}`,
            order_id: order.id,
            order_number: order.offline_number ?? order.order_number ?? 'OFL',
            order_type: order.order_type ?? 'dine_in',
            server_name: order.server_name ?? '',
            table_name: order.table_name ?? null,
            items: (order.items ?? []).map((item: Record<string, unknown>) => ({
              id: item.id as string,
              name: item.name as string,
              quantity: (item.quantity as number) ?? 1,
              modifiers: ((item.modifiers as { name: string }[]) ?? []).map((m) => m.name),
              special_instructions: (item.special_instructions as string) ?? '',
              seat_number: (item.seat_number as number | null) ?? null,
              course: (item.course as number) ?? 1,
              status: 'pending' as ItemStatus,
            })),
            created_at: order.created_at ?? new Date().toISOString(),
            age_seconds: 0,
            age_category: 'fresh' as TicketAge,
            is_rush: false,
            station_id: get().activeStationId ?? '',
            priority: 'normal' as TicketPriority,
            allergens: null,
            has_allergens: false,
          }
          get().actions.addTicket(ticket)
        }
      })
      // Store channel reference for cleanup (attached to window for simplicity)
      ;(window as unknown as Record<string, unknown>).__searKdsChannel = channel
    },
  },
}))
