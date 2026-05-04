'use client'

import { useEffect, useCallback, useState, useRef, useMemo } from 'react'
import { MessageSquare } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { itemSpawn, useReducedMotion } from '@/lib/motion/transitions'
import { Button } from '@/components/ui-v2/Button'
import { Badge } from '@/components/ui-v2/data/Badge'
import { useKdsStore } from '@/stores/kds-store'
import { useShallow } from 'zustand/react/shallow'
import { useRealtimeKds, useRealtimeTable } from '@/hooks/use-realtime'
import {
  useRealtimeKdsMessages,
  useRealtimeKdsStations,
  useRealtimeKitchenStatus,
} from '@/hooks/use-kds-realtime'
import { useKdsHeartbeat } from '@/hooks/use-kds-heartbeat'
import { KdsTicket } from '@/components/kds/KdsTicket'
import { KdsExpoTicket } from '@/components/kds/KdsExpoTicket'
import { KdsStationTabs } from '@/components/kds/KdsStationTabs'
import { KdsAllDay } from '@/components/kds/KdsAllDay'
import { KdsRecallDrawer } from '@/components/kds/KdsRecallDrawer'
import { KdsCapacityIndicator } from '@/components/kds/KdsCapacityIndicator'
import { KdsMessagePanel } from '@/components/kds/KdsMessagePanel'
import { KdsMessageBanner, showKdsBanner } from '@/components/kds/KdsMessageBanner'
import {
  playNewTicketSound,
  playRushSound,
  playVipSound,
  playRefireSound,
  playReadyToRunSound,
  processTicketAgingAlert,
  setMuted,
  resetAlertTracking,
} from '@/lib/kds/audio-alerts'
import { type RefireReasonCode, type KdsMessageData } from '@/stores/kds-store'

export default function KdsPage() {
  // Zustand v5 fix: useShallow prevents re-render when values haven't changed
  const { stations, tickets, activeStationId, soundEnabled, isKitchenClosed, messages, unreadCount, stationHealth } = useKdsStore(
    useShallow((s) => ({
      stations: s.stations,
      tickets: s.tickets,
      activeStationId: s.activeStationId,
      soundEnabled: s.soundEnabled,
      isKitchenClosed: s.isKitchenClosed,
      messages: s.messages,
      unreadCount: s.unreadCount,
      stationHealth: s.stationHealth,
    }))
  )
  // Actions via ref — initialized once, never causes re-render
  const actions = useRef(useKdsStore.getState().actions).current

  const [allDayOpen, setAllDayOpen] = useState(false)
  const [recallOpen, setRecallOpen] = useState(false)
  const [messagePanelOpen, setMessagePanelOpen] = useState(false)
  const [locationId, setLocationId] = useState('')
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const prevTicketIdsRef = useRef<Set<string>>(new Set())

  // Client-only mount: read URL params and apply dark theme
  useEffect(() => {
    setMounted(true)
    document.documentElement.classList.add('dark')
    const urlParams = new URLSearchParams(window.location.search)
    const urlLocationId = urlParams.get('location_id')
    if (urlLocationId) setLocationId(urlLocationId)
    return () => {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  // Stable ref for store actions — prevents dependency cascades
  const actionsRef = useRef(actions)
  actionsRef.current = actions

  // Sync mute state with audio module
  useEffect(() => {
    setMuted(!soundEnabled)
  }, [soundEnabled])

  // Fetch stations on mount
  const initializedRef = useRef(false)
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    async function fetchStations() {
      try {
        const urlParams = new URLSearchParams(window.location.search)
        const urlLocId = urlParams.get('location_id') ?? ''
        const url = urlLocId
          ? `/api/kds/stations?location_id=${urlLocId}`
          : '/api/kds/stations'
        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed to fetch stations')
        const json = await res.json()
        const stationList = json.data ?? []
        actionsRef.current.setStations(stationList)

        // Check URL for station param
        const urlStationId = urlParams.get('station')

        if (urlStationId && stationList.some((s: { id: string }) => s.id === urlStationId)) {
          actionsRef.current.setActiveStation(urlStationId)
        } else if (stationList.length > 0) {
          actionsRef.current.setActiveStation(stationList[0].id)
        }

        // If no location_id was provided, grab from first station
        const finalLocId = urlLocId || (stationList.length > 0 ? stationList[0].location_id : '')
        if (finalLocId) {
          setLocationId(finalLocId)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stations')
      }
    }

    fetchStations()
     
  }, [])

  // Reset alert tracking when station changes
  useEffect(() => {
    resetAlertTracking()
  }, [activeStationId])

  // Fetch tickets when active station changes
  const fetchTickets = useCallback(async () => {
    if (!activeStationId || !locationId) return

    try {
      setLoading(true)
      const res = await fetch(
        `/api/kds/tickets?station_id=${activeStationId}&location_id=${locationId}`
      )
      if (!res.ok) throw new Error('Failed to fetch tickets')
      const json = await res.json()
      actionsRef.current.setTickets(json.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tickets')
    } finally {
      setLoading(false)
    }
  }, [activeStationId, locationId])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  // Force re-render every 5 seconds for timer updates (not every 1s to avoid perf issues)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 5000)
    return () => clearInterval(interval)
  }, [])

  // Detect new tickets for sound alerts
  useEffect(() => {
    const currentIds = new Set(tickets.map((t) => t.id))
    const prevIds = prevTicketIdsRef.current

    if (soundEnabled && prevIds.size > 0) {
      for (const ticket of tickets) {
        if (!prevIds.has(ticket.id)) {
          // New ticket appeared
          if (ticket.priority === 'refire') {
            playRefireSound()
          } else if (ticket.priority === 'rush') {
            playRushSound()
          } else if (ticket.priority === 'vip') {
            playVipSound()
          } else {
            playNewTicketSound()
          }
          break // only one sound per update cycle
        }
      }
    }

    prevTicketIdsRef.current = currentIds
  }, [tickets, soundEnabled])

  // Real-time: subscribe to KDS ticket events for this station
  const handleKdsEvent = useCallback(
    (_record: Record<string, unknown>, _eventType: 'INSERT' | 'UPDATE' | 'DELETE') => {
      fetchTickets()
    },
    [fetchTickets]
  )

  useRealtimeKds(activeStationId ?? '', handleKdsEvent)

  // Real-time: subscribe to order changes
  const handleOrderInsert = useCallback(
    (_record: Record<string, unknown>) => {
      fetchTickets()
    },
    [fetchTickets]
  )

  const handleOrderUpdate = useCallback(
    (_record: Record<string, unknown>) => {
      fetchTickets()
    },
    [fetchTickets]
  )

  useRealtimeTable(
    'orders',
    locationId ? `location_id=eq.${locationId}` : undefined,
    handleOrderInsert,
    handleOrderUpdate
  )

  // Real-time: subscribe to kitchen close state
  const handleLocationUpdate = useCallback(
    (record: Record<string, unknown>) => {
      if (typeof record.is_kitchen_closed === 'boolean') {
        actionsRef.current.setKitchenClosed(record.is_kitchen_closed as boolean)
      }
    },
    []
  )

  useRealtimeTable(
    'locations',
    locationId ? `id=eq.${locationId}` : undefined,
    undefined,
    handleLocationUpdate
  )

  // --- KDS Heartbeat ---
  const getHeartbeatMetrics = useCallback(() => {
    const capacity = actionsRef.current.getCapacity()
    return {
      active_ticket_count: capacity.activeTickets,
      active_item_count: capacity.totalItems,
      utilization_pct: capacity.utilization,
    }
  }, [])

  const handleHeartbeatConfigUpdate = useCallback(
    (config: Record<string, unknown>) => {
      // Could update local station config here if needed
      void config
    },
    []
  )

  const handleHeartbeatRecovery = useCallback(() => {
    // Re-fetch tickets when recovering from offline
    fetchTickets()
  }, [fetchTickets])

  useKdsHeartbeat(
    activeStationId,
    getHeartbeatMetrics,
    handleHeartbeatConfigUpdate,
    handleHeartbeatRecovery
  )

  // --- KDS Messages Realtime ---
  const handleMessageReceived = useCallback(
    (message: KdsMessageData) => {
      actionsRef.current.addMessage(message)

      // Show banner notification
      if (activeStationId) {
        showKdsBanner(activeStationId, message)
      }

      // Play notification sound for incoming messages
      if (soundEnabled && message.from_station_id !== activeStationId) {
        playNewTicketSound()
      }
    },
    [activeStationId, soundEnabled]
  )

  useRealtimeKdsMessages(locationId, handleMessageReceived)

  // Fetch initial messages
  useEffect(() => {
    async function fetchMessages() {
      if (!activeStationId || !locationId) return
      try {
        const res = await fetch(
          `/api/kds/messages?station_id=${activeStationId}&location_id=${locationId}`
        )
        if (res.ok) {
          const json = await res.json()
          actionsRef.current.setMessages(json.data ?? [])
        }
      } catch {
        // Messages fetch failure is non-critical
      }
    }
    fetchMessages()
  }, [activeStationId, locationId])

  // --- Station Status Realtime ---
  const handleStationOnline = useCallback(
    (event: { station_id: string }) => {
      actionsRef.current.setStationOnline(event.station_id)
    },
    []
  )

  const handleStationOffline = useCallback(
    (event: { station_id: string; failover_active?: boolean }) => {
      actionsRef.current.setStationOffline(event.station_id, event.failover_active ?? false)
    },
    []
  )

  useRealtimeKdsStations(locationId, handleStationOnline, handleStationOffline)

  // --- Kitchen Close Realtime (broadcast channel) ---
  const handleKitchenStatusChange = useCallback(
    (event: { kitchen_closed: boolean }) => {
      actionsRef.current.setKitchenClosed(event.kitchen_closed)
    },
    []
  )

  useRealtimeKitchenStatus(locationId, handleKitchenStatusChange)

  // Fetch initial kitchen status
  useEffect(() => {
    async function fetchKitchenStatus() {
      if (!locationId) return
      try {
        const res = await fetch(`/api/settings/locations/${locationId}`)
        if (res.ok) {
          const json = await res.json()
          const settings = json.data?.settings
          if (settings && typeof settings.kitchen_closed === 'boolean') {
            actionsRef.current.setKitchenClosed(settings.kitchen_closed)
          }
        }
      } catch {
        // Non-critical
      }
    }
    fetchKitchenStatus()
  }, [locationId])

  // --- Message Send Handler ---
  const handleSendMessage = useCallback(
    async (message: string, toStationId: string | null, messageType: 'quick' | 'custom') => {
      if (!activeStationId || !locationId) return
      try {
        const res = await fetch('/api/kds/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from_station_id: activeStationId,
            to_station_id: toStationId,
            message,
            message_type: messageType,
            location_id: locationId,
          }),
        })
        if (res.ok) {
          const json = await res.json()
          actionsRef.current.addMessage(json.data)
        }
      } catch {
        console.error('[KDS] Failed to send message')
      }
    },
    [activeStationId, locationId]
  )

  // --- Mark Message Read ---
  const handleMarkMessageRead = useCallback(
    async (messageId: string) => {
      if (!activeStationId) return
      actionsRef.current.markMessageRead(messageId)
      try {
        await fetch(`/api/kds/messages/${messageId}/read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ station_id: activeStationId }),
        })
      } catch {
        // Non-critical
      }
    },
    [activeStationId]
  )

  // Bump a ticket
  const handleBump = useCallback(
    async (ticketId: string) => {
      try {
        const res = await fetch(`/api/kds/tickets/${ticketId}/bump`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ station_id: activeStationId }),
        })

        if (res.ok) {
          actionsRef.current.bumpTicket(ticketId)
        }
      } catch {
        console.error('[KDS] Failed to bump ticket')
      }
    },
    [activeStationId]
  )

  // Bump individual item
  const handleItemBump = useCallback(
    async (ticketId: string, itemId: string) => {
      try {
        const res = await fetch(
          `/api/kds/tickets/${ticketId}/items/${itemId}/bump`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ station_id: activeStationId }),
          }
        )

        if (res.ok) {
          const data = await res.json()
          actionsRef.current.bumpItem(ticketId, itemId)

          // If all items bumped, auto-bump the ticket after animation
          if (data.data?.all_bumped) {
            setTimeout(() => {
              actionsRef.current.bumpTicket(ticketId)
            }, 400)
          }
        }
      } catch {
        console.error('[KDS] Failed to bump item')
      }
    },
    [activeStationId]
  )

  // Re-fire item
  const handleRefire = useCallback(
    async (ticketId: string, itemId: string, reason: RefireReasonCode) => {
      try {
        const res = await fetch(
          `/api/kds/tickets/${ticketId}/items/${itemId}/refire`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              station_id: activeStationId,
              reason_code: reason,
            }),
          }
        )

        if (res.ok) {
          actionsRef.current.refireItem(ticketId, itemId, reason)
          if (soundEnabled) {
            playRefireSound()
          }
          // Re-fetch to get updated state
          fetchTickets()
        }
      } catch {
        console.error('[KDS] Failed to refire item')
      }
    },
    [activeStationId, soundEnabled, fetchTickets]
  )

  // Expo bump (final bump)
  const handleExpoBump = useCallback(
    async (ticketId: string) => {
      try {
        const res = await fetch(`/api/kds/tickets/${ticketId}/bump`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ station_id: activeStationId }),
        })

        if (res.ok) {
          actionsRef.current.bumpTicket(ticketId)
          if (soundEnabled) {
            playReadyToRunSound()
          }
        }
      } catch {
        console.error('[KDS] Failed to expo bump ticket')
      }
    },
    [activeStationId, soundEnabled]
  )

  // Fire course from expo
  const handleFireCourse = useCallback(
    async (_ticketId: string, orderId: string, course: number) => {
      try {
        await fetch(`/api/orders/${orderId}/fire-course`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ course }),
        })
        fetchTickets()
      } catch {
        console.error('[KDS] Failed to fire course')
      }
    },
    [fetchTickets]
  )

  // Recall a ticket
  const handleRecall = useCallback(
    async (ticketId: string) => {
      try {
        const res = await fetch(`/api/kds/tickets/${ticketId}/recall`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ station_id: activeStationId }),
        })

        if (res.ok) {
          fetchTickets()
        }
      } catch {
        console.error('[KDS] Failed to recall ticket')
      }
    },
    [activeStationId, fetchTickets]
  )

  // Bump all tickets
  const handleBumpAll = useCallback(async () => {
    if (!activeStationId || !locationId) return

    try {
      const res = await fetch('/api/kds/tickets/bump-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station_id: activeStationId,
          location_id: locationId,
        }),
      })

      if (res.ok) {
        actionsRef.current.bumpAll()
      }
    } catch {
      console.error('[KDS] Failed to bump all tickets')
    }
  }, [activeStationId, locationId])

  const reducedMotion = useReducedMotion()

  // Get sorted active tickets and other derived state via getState()
  // Called once per render — stable because tickets/stations are the dependency
  const { sortedTickets, activeStation, isExpo, priorityCount, allDayCounts, allDayByCategory } = useMemo(() => {
    const storeActions = useKdsStore.getState().actions
    return {
      sortedTickets: storeActions.getSortedActiveTickets(),
      activeStation: storeActions.getActiveStation(),
      isExpo: storeActions.getActiveStation()?.station_type === 'expo',
      priorityCount: storeActions.getPriorityCount(),
      allDayCounts: storeActions.getAllDayCounts(),
      allDayByCategory: storeActions.getAllDayCountsByCategory(),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets, stations, activeStationId])

  return (
    <div
      className="kds-dark flex h-full w-full flex-col no-select no-overscroll"
      style={{ backgroundColor: 'var(--kds-bg)' }}
    >
      {/* Kitchen closed banner */}
      {isKitchenClosed && (
        <div
          className="z-40 flex items-center justify-center px-4 py-2"
          style={{ backgroundColor: 'var(--color-danger-strong)' }}
        >
          <span className="text-subhead font-black uppercase tracking-wider text-[var(--color-primary-fg)]">
            KITCHEN CLOSED
          </span>
        </div>
      )}

      {/* Top bar -- 48px */}
      <header
        className="z-30 flex flex-shrink-0 items-center gap-2 px-4"
        style={{
          height: 48,
          backgroundColor: 'var(--kds-topbar)',
          borderBottom: '0.5px solid var(--color-border)',
        }}
      >
        {/* Station tabs */}
        <KdsStationTabs
          stations={stations}
          activeStationId={activeStationId}
          onSelect={(id: string) => useKdsStore.getState().actions.setActiveStation(id)}
        />

        <div className="flex-1" />

        {/* Capacity indicator */}
        <KdsCapacityIndicator />

        {/* Priority queue count */}
        {priorityCount > 0 && (
          <Badge
            variant="danger"
            size="md"
            className="animate-pulse gap-[var(--space-1)] !h-auto py-[var(--space-1)] px-[var(--space-3)] font-[number:var(--weight-bold)]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
            Priority: {priorityCount}
          </Badge>
        )}

        {/* All-Day button */}
        <Button
          variant="secondary"
          size="lg"
          onClick={() => setAllDayOpen(true)}
          leadingIcon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="M7 16h2v-4H7zM12 16h2V8h-2zM17 16h2v-6h-2z" />
            </svg>
          }
        >
          All-Day
        </Button>

        {/* Recall button */}
        <Button
          variant="secondary"
          size="lg"
          onClick={() => setRecallOpen(true)}
          leadingIcon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          }
        >
          Recall
        </Button>

        {/* Messages button */}
        <div className="relative">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => setMessagePanelOpen(true)}
            leadingIcon={<MessageSquare />}
          >
            Messages
          </Button>
          {unreadCount > 0 && (
            <span
              className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-[var(--color-primary-fg)] animate-pulse"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {unreadCount}
            </span>
          )}
        </div>

        {/* Sound toggle */}
        <Button
          variant={soundEnabled ? 'primary' : 'secondary'}
          size="lg"
          onClick={() => useKdsStore.getState().actions.toggleSound()}
          leadingIcon={
            soundEnabled ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 5 6 9H2v6h4l5 4V5Z" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 5 6 9H2v6h4l5 4V5Z" />
                <line x1="22" y1="9" x2="16" y2="15" />
                <line x1="16" y1="9" x2="22" y2="15" />
              </svg>
            )
          }
        >
          {soundEnabled ? 'Sound' : 'Muted'}
        </Button>

        {/* Bump All button */}
        {sortedTickets.length > 0 && !isExpo && (
          <Button
            variant="destructive"
            size="lg"
            onClick={handleBumpAll}
          >
            Bump All
          </Button>
        )}
      </header>

      {/* Main ticket area */}
      <main className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        {error ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-semibold" style={{ color: 'var(--color-danger-strong)' }}>
                {error}
              </p>
              <Button
                variant="primary"
                size="md"
                className="mt-3"
                onClick={() => {
                  setError(null)
                  fetchTickets()
                }}
              >
                Retry
              </Button>
            </div>
          </div>
        ) : loading && tickets.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div
                className="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
                style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
              />
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Loading tickets...
              </p>
            </div>
          </div>
        ) : sortedTickets.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 h-20 w-20" style={{ color: 'var(--color-border-strong)' }}>
                <rect x="2" y="3" width="20" height="18" rx="2" />
                <path d="M8 7h8M8 11h6M8 15h4" />
              </svg>
              <p className="text-xl font-bold" style={{ color: 'var(--color-text-muted)' }}>
                All clear
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--color-text-subtle)' }}>
                No active tickets at this station
              </p>
            </div>
          </div>
        ) : (
          <div
            className="grid h-full auto-cols-fr gap-3"
            style={{
              gridTemplateColumns: `repeat(${Math.min(sortedTickets.length, 6)}, minmax(260px, 1fr))`,
              gridTemplateRows: '1fr',
            }}
          >
            <AnimatePresence initial={false}>
              {sortedTickets.map((ticket) => (
                <motion.div
                  key={ticket.id}
                  layout={!reducedMotion}
                  initial={reducedMotion ? false : itemSpawn.initial}
                  animate={itemSpawn.animate}
                  exit={reducedMotion ? undefined : itemSpawn.exit}
                  transition={reducedMotion ? { duration: 0 } : itemSpawn.transition}
                  className="h-full"
                >
                  {isExpo ? (
                    <KdsExpoTicket
                      ticket={ticket}
                      onExpoBump={handleExpoBump}
                      onRefire={handleRefire}
                      onFireCourse={handleFireCourse}
                    />
                  ) : (
                    <KdsTicket
                      ticket={ticket}
                      onBump={handleBump}
                      onItemBump={handleItemBump}
                      onRefire={handleRefire}
                    />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* All-Day overlay */}
      <KdsAllDay
        counts={allDayCounts}
        countsByCategory={allDayByCategory}
        isOpen={allDayOpen}
        onClose={() => setAllDayOpen(false)}
      />

      {/* Recall drawer */}
      <KdsRecallDrawer
        isOpen={recallOpen}
        onClose={() => setRecallOpen(false)}
        stationId={activeStationId}
        locationId={locationId}
        onRecall={handleRecall}
      />

      {/* Message banner — incoming messages popup */}
      <KdsMessageBanner
        stationId={activeStationId}
      />

      {/* Message panel — slide-out conversation thread */}
      <KdsMessagePanel
        isOpen={messagePanelOpen}
        onClose={() => setMessagePanelOpen(false)}
        stationId={activeStationId}
        stationName={activeStation?.name ?? 'Station'}
        locationId={locationId}
        messages={messages}
        stations={stations}
        onSendMessage={handleSendMessage}
        onMarkRead={handleMarkMessageRead}
      />

      {/* Station offline banners */}
      {Object.entries(stationHealth).map(([stationId, info]) => {
        if (info.health !== 'offline') return null
        const stationName = stations.find((s) => s.id === stationId)?.name ?? 'Unknown'
        return (
          <div
            key={`offline-${stationId}`}
            className="fixed bottom-4 left-4 right-4 z-50 flex items-center gap-3 rounded-[var(--radius-md)] border px-4 py-3 shadow-[var(--shadow-mid)]"
            style={{
              backgroundColor: 'var(--color-warning-bg)',
              borderColor: 'var(--color-warning-strong)',
            }}
          >
            <div
              className="h-3 w-3 rounded-full animate-pulse"
              style={{ backgroundColor: 'var(--color-danger-strong)' }}
            />
            <span className="text-sm font-semibold" style={{ color: 'var(--color-warning-strong)' }}>
              KDS Station &quot;{stationName}&quot; is offline
              {info.failoverActive
                ? ' — tickets redirecting to backup printer'
                : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}
