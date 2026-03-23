'use client'

import { useEffect, useCallback, useState, useRef } from 'react'
import { MessageSquare } from 'lucide-react'
import { useKdsStore } from '@/stores/kds-store'
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

// Default location -- comes from URL params
const DEFAULT_LOCATION_ID = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search).get('location_id') ?? ''
  : ''

export default function KdsPage() {
  const {
    stations,
    tickets,
    activeStationId,
    soundEnabled,
    isKitchenClosed,
    messages,
    unreadCount,
    stationHealth,
    actions,
  } = useKdsStore()

  const [allDayOpen, setAllDayOpen] = useState(false)
  const [recallOpen, setRecallOpen] = useState(false)
  const [messagePanelOpen, setMessagePanelOpen] = useState(false)
  const [locationId, setLocationId] = useState(DEFAULT_LOCATION_ID)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const prevTicketIdsRef = useRef<Set<string>>(new Set())

  // Apply dark class to html element on mount, remove on unmount
  useEffect(() => {
    document.documentElement.classList.add('dark')
    return () => {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  // Sync mute state with audio module
  useEffect(() => {
    setMuted(!soundEnabled)
  }, [soundEnabled])

  // Fetch stations on mount
  useEffect(() => {
    async function fetchStations() {
      try {
        const url = locationId
          ? `/api/kds/stations?location_id=${locationId}`
          : '/api/kds/stations'
        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed to fetch stations')
        const json = await res.json()
        const stationList = json.data ?? []
        actions.setStations(stationList)

        // Check URL for station param
        const urlStationId = typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('station')
          : null

        if (urlStationId && stationList.some((s: { id: string }) => s.id === urlStationId)) {
          actions.setActiveStation(urlStationId)
        } else if (stationList.length > 0 && !activeStationId) {
          actions.setActiveStation(stationList[0].id)
        }

        // If no location_id was provided, grab from first station
        if (!locationId && stationList.length > 0 && stationList[0].location_id) {
          setLocationId(stationList[0].location_id)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stations')
      }
    }

    fetchStations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      actions.setTickets(json.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tickets')
    } finally {
      setLoading(false)
    }
  }, [activeStationId, locationId, actions])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  // Update ticket ages every second + process aging alerts
  useEffect(() => {
    const interval = setInterval(() => {
      actions.updateTicketAges()

      // Process aging alerts for each ticket
      if (soundEnabled) {
        const activeTickets = actions.getActiveTickets()
        for (const ticket of activeTickets) {
          processTicketAgingAlert(ticket.id, ticket.age_category)
        }
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [actions, soundEnabled])

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
        actions.setKitchenClosed(record.is_kitchen_closed as boolean)
      }
    },
    [actions]
  )

  useRealtimeTable(
    'locations',
    locationId ? `id=eq.${locationId}` : undefined,
    undefined,
    handleLocationUpdate
  )

  // --- KDS Heartbeat ---
  const getHeartbeatMetrics = useCallback(() => {
    const capacity = actions.getCapacity()
    return {
      active_ticket_count: capacity.activeTickets,
      active_item_count: capacity.totalItems,
      utilization_pct: capacity.utilization,
    }
  }, [actions])

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
      actions.addMessage(message)

      // Show banner notification
      if (activeStationId) {
        showKdsBanner(activeStationId, message)
      }

      // Play notification sound for incoming messages
      if (soundEnabled && message.from_station_id !== activeStationId) {
        playNewTicketSound()
      }
    },
    [actions, activeStationId, soundEnabled]
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
          actions.setMessages(json.data ?? [])
        }
      } catch {
        // Messages fetch failure is non-critical
      }
    }
    fetchMessages()
  }, [activeStationId, locationId, actions])

  // --- Station Status Realtime ---
  const handleStationOnline = useCallback(
    (event: { station_id: string }) => {
      actions.setStationOnline(event.station_id)
    },
    [actions]
  )

  const handleStationOffline = useCallback(
    (event: { station_id: string; failover_active?: boolean }) => {
      actions.setStationOffline(event.station_id, event.failover_active ?? false)
    },
    [actions]
  )

  useRealtimeKdsStations(locationId, handleStationOnline, handleStationOffline)

  // --- Kitchen Close Realtime (broadcast channel) ---
  const handleKitchenStatusChange = useCallback(
    (event: { kitchen_closed: boolean }) => {
      actions.setKitchenClosed(event.kitchen_closed)
    },
    [actions]
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
            actions.setKitchenClosed(settings.kitchen_closed)
          }
        }
      } catch {
        // Non-critical
      }
    }
    fetchKitchenStatus()
  }, [locationId, actions])

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
          actions.addMessage(json.data)
        }
      } catch {
        console.error('[KDS] Failed to send message')
      }
    },
    [activeStationId, locationId, actions]
  )

  // --- Mark Message Read ---
  const handleMarkMessageRead = useCallback(
    async (messageId: string) => {
      if (!activeStationId) return
      actions.markMessageRead(messageId)
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
    [activeStationId, actions]
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
          actions.bumpTicket(ticketId)
        }
      } catch {
        console.error('[KDS] Failed to bump ticket')
      }
    },
    [activeStationId, actions]
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
          actions.bumpItem(ticketId, itemId)

          // If all items bumped, auto-bump the ticket after animation
          if (data.data?.all_bumped) {
            setTimeout(() => {
              actions.bumpTicket(ticketId)
            }, 400)
          }
        }
      } catch {
        console.error('[KDS] Failed to bump item')
      }
    },
    [activeStationId, actions]
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
          actions.refireItem(ticketId, itemId, reason)
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
    [activeStationId, actions, soundEnabled, fetchTickets]
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
          actions.bumpTicket(ticketId)
          if (soundEnabled) {
            playReadyToRunSound()
          }
        }
      } catch {
        console.error('[KDS] Failed to expo bump ticket')
      }
    },
    [activeStationId, actions, soundEnabled]
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
        actions.bumpAll()
      }
    } catch {
      console.error('[KDS] Failed to bump all tickets')
    }
  }, [activeStationId, locationId, actions])

  // Get sorted active tickets and other derived state
  const sortedTickets = actions.getSortedActiveTickets()
  const activeStation = actions.getActiveStation()
  const isExpo = activeStation?.station_type === 'expo'
  const priorityCount = actions.getPriorityCount()
  const allDayCounts = actions.getAllDayCounts()
  const allDayByCategory = actions.getAllDayCountsByCategory()

  return (
    <div className="flex h-full w-full flex-col bg-[#0a0a0a] no-select no-overscroll">
      {/* Kitchen closed banner */}
      {isKitchenClosed && (
        <div className="z-40 flex items-center justify-center bg-red-600 px-4 py-2">
          <span className="text-subhead font-black uppercase tracking-wider text-white">
            KITCHEN CLOSED
          </span>
        </div>
      )}

      {/* Top bar -- 48px */}
      <header className="z-30 flex flex-shrink-0 items-center gap-2 bg-[#1a1a1a] px-4" style={{ height: 48, borderBottom: '0.5px solid #2a2a2a' }}>
        {/* Station tabs */}
        <KdsStationTabs
          stations={stations}
          activeStationId={activeStationId}
          onSelect={actions.setActiveStation}
        />

        <div className="flex-1" />

        {/* Capacity indicator */}
        <KdsCapacityIndicator />

        {/* Priority queue count */}
        {priorityCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg border border-red-600/40 bg-red-900/60 px-3 py-1.5 text-caption-1 font-bold text-red-300 animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
            <span>Priority: {priorityCount}</span>
          </div>
        )}

        {/* All-Day button */}
        <button
          onClick={() => setAllDayOpen(true)}
          className="btn-press flex h-10 items-center gap-2 rounded-xl bg-[#2a2a2a] px-4 text-subhead font-semibold text-white transition-colors hover:bg-[#333]"
          style={{ minHeight: 44 }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M3 3v18h18" />
            <path d="M7 16h2v-4H7zM12 16h2V8h-2zM17 16h2v-6h-2z" />
          </svg>
          All-Day
        </button>

        {/* Recall button */}
        <button
          onClick={() => setRecallOpen(true)}
          className="btn-press flex h-10 items-center gap-2 rounded-xl bg-[#2a2a2a] px-4 text-subhead font-semibold text-white transition-colors hover:bg-[#333]"
          style={{ minHeight: 44 }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          Recall
        </button>

        {/* Messages button */}
        <button
          onClick={() => setMessagePanelOpen(true)}
          className="btn-press relative flex h-10 items-center gap-2 rounded-xl bg-[#2a2a2a] px-4 text-subhead font-semibold text-white transition-colors hover:bg-[#333]"
          style={{ minHeight: 44 }}
        >
          <MessageSquare className="h-4 w-4" />
          Messages
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#F06B18] px-1 text-[10px] font-bold text-white animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Sound toggle */}
        <button
          onClick={actions.toggleSound}
          className={`flex h-10 items-center gap-1.5 rounded-xl px-3 text-subhead font-semibold transition-colors ${
            soundEnabled
              ? 'bg-[#F06B18] text-white'
              : 'bg-[#2a2a2a] text-[#666]'
          }`}
          style={{ minHeight: 44 }}
        >
          {soundEnabled ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M11 5 6 9H2v6h4l5 4V5Z" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M11 5 6 9H2v6h4l5 4V5Z" />
              <line x1="22" y1="9" x2="16" y2="15" />
              <line x1="16" y1="9" x2="22" y2="15" />
            </svg>
          )}
          {soundEnabled ? 'Sound' : 'Muted'}
        </button>

        {/* Bump All button */}
        {sortedTickets.length > 0 && !isExpo && (
          <button
            onClick={handleBumpAll}
            className="btn-press flex h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-subhead font-bold text-white transition-colors hover:bg-red-500"
            style={{ minHeight: 44 }}
          >
            Bump All
          </button>
        )}
      </header>

      {/* Main ticket area */}
      <main className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        {error ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-semibold text-red-400">{error}</p>
              <button
                onClick={() => {
                  setError(null)
                  fetchTickets()
                }}
                className="mt-3 rounded-lg bg-[#F06B18] px-4 py-2 text-sm font-semibold text-white"
              >
                Retry
              </button>
            </div>
          </div>
        ) : loading && tickets.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#F06B18] border-t-transparent" />
              <p className="text-sm text-[#888]">Loading tickets...</p>
            </div>
          </div>
        ) : sortedTickets.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 h-20 w-20 text-[#444]">
                <rect x="2" y="3" width="20" height="18" rx="2" />
                <path d="M8 7h8M8 11h6M8 15h4" />
              </svg>
              <p className="text-xl font-bold text-[#666]">
                All clear
              </p>
              <p className="mt-1 text-sm text-[#555]">
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
            {sortedTickets.map((ticket) =>
              isExpo ? (
                <KdsExpoTicket
                  key={ticket.id}
                  ticket={ticket}
                  onExpoBump={handleExpoBump}
                  onRefire={handleRefire}
                  onFireCourse={handleFireCourse}
                />
              ) : (
                <KdsTicket
                  key={ticket.id}
                  ticket={ticket}
                  onBump={handleBump}
                  onItemBump={handleItemBump}
                  onRefire={handleRefire}
                />
              )
            )}
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
            className="fixed bottom-4 left-4 right-4 z-50 flex items-center gap-3 rounded-xl border border-yellow-600/40 bg-yellow-900/90 px-4 py-3 shadow-lg"
          >
            <div className="h-3 w-3 rounded-full bg-[#FF3B30] animate-pulse" />
            <span className="text-sm font-semibold text-yellow-200">
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
