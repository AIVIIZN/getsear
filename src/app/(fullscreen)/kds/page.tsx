'use client'

import { useEffect, useCallback, useState, useRef } from 'react'
import { useKdsStore } from '@/stores/kds-store'
import { useRealtimeKds, useRealtimeTable } from '@/hooks/use-realtime'
import { KdsTicket } from '@/components/kds/KdsTicket'
import { KdsStationTabs } from '@/components/kds/KdsStationTabs'
import { KdsAllDay } from '@/components/kds/KdsAllDay'
import { KdsRecallDrawer } from '@/components/kds/KdsRecallDrawer'

// Default location — in production, this would come from auth context or URL params
const DEFAULT_LOCATION_ID = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search).get('location_id') ?? ''
  : ''

export default function KdsPage() {
  const {
    stations,
    tickets,
    activeStationId,
    soundEnabled,
    actions,
  } = useKdsStore()

  const [allDayOpen, setAllDayOpen] = useState(false)
  const [recallOpen, setRecallOpen] = useState(false)
  const [locationId, setLocationId] = useState(DEFAULT_LOCATION_ID)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const darkRef = useRef<HTMLDivElement>(null)

  // Apply dark class to html element on mount, remove on unmount
  useEffect(() => {
    document.documentElement.classList.add('dark')
    return () => {
      document.documentElement.classList.remove('dark')
    }
  }, [])

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

  // Update ticket ages every second
  useEffect(() => {
    const interval = setInterval(() => {
      actions.updateTicketAges()
    }, 1000)
    return () => clearInterval(interval)
  }, [actions])

  // Real-time: subscribe to KDS ticket events for this station
  const handleKdsEvent = useCallback(
    (_record: Record<string, unknown>, _eventType: 'INSERT' | 'UPDATE' | 'DELETE') => {
      // Re-fetch tickets on any KDS event
      fetchTickets()
      if (soundEnabled) {
        // In production: play audio. For now, log.
        console.log('[KDS] Sound: ticket event')
      }
    },
    [fetchTickets, soundEnabled]
  )

  useRealtimeKds(activeStationId ?? '', handleKdsEvent)

  // Real-time: subscribe to order changes
  const handleOrderInsert = useCallback(
    (_record: Record<string, unknown>) => {
      // Re-fetch tickets when new orders come in
      fetchTickets()
      if (soundEnabled) {
        console.log('[KDS] Sound: new order')
      }
    },
    [fetchTickets, soundEnabled]
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
          if (soundEnabled) {
            console.log('[KDS] Sound: bump')
          }
        }
      } catch {
        console.error('[KDS] Failed to bump ticket')
      }
    },
    [activeStationId, actions, soundEnabled]
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
          // Re-fetch to get the recalled ticket
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

  // Get active tickets and all-day counts
  const activeTickets = actions.getActiveTickets()
  const allDayCounts = actions.getAllDayCounts()

  return (
    <div ref={darkRef} className="flex h-full w-full flex-col bg-[var(--background)] no-select no-overscroll">
      {/* Top bar — 48px */}
      <header className="z-30 flex h-12 flex-shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--card)] px-3">
        {/* Station tabs */}
        <KdsStationTabs
          stations={stations}
          activeStationId={activeStationId}
          onSelect={actions.setActiveStation}
        />

        <div className="flex-1" />

        {/* All-Day button */}
        <button
          onClick={() => setAllDayOpen(true)}
          className="touch-target flex h-9 items-center gap-1.5 rounded-lg bg-[var(--secondary)] px-3 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]"
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
          className="touch-target flex h-9 items-center gap-1.5 rounded-lg bg-[var(--secondary)] px-3 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          Recall
        </button>

        {/* Sound toggle */}
        <button
          onClick={actions.toggleSound}
          className={`touch-target flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
            soundEnabled
              ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
              : 'bg-[var(--secondary)] text-[var(--muted-foreground)]'
          }`}
          title={soundEnabled ? 'Sound on' : 'Sound off'}
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
        </button>

        {/* Bump All button */}
        {activeTickets.length > 0 && (
          <button
            onClick={handleBumpAll}
            className="touch-target flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-sm font-bold text-white transition-colors hover:bg-red-500"
          >
            Bump All
          </button>
        )}
      </header>

      {/* Main ticket area */}
      <main className="flex-1 overflow-x-auto overflow-y-hidden p-3">
        {error ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-semibold text-red-400">{error}</p>
              <button
                onClick={() => {
                  setError(null)
                  fetchTickets()
                }}
                className="mt-3 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)]"
              >
                Retry
              </button>
            </div>
          </div>
        ) : loading && tickets.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
              <p className="text-sm text-[var(--muted-foreground)]">Loading tickets...</p>
            </div>
          </div>
        ) : activeTickets.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 h-20 w-20 text-[var(--muted-foreground)] opacity-30">
                <rect x="2" y="3" width="20" height="18" rx="2" />
                <path d="M8 7h8M8 11h6M8 15h4" />
              </svg>
              <p className="text-xl font-bold text-[var(--muted-foreground)]">
                All clear
              </p>
              <p className="mt-1 text-sm text-[var(--muted-foreground)] opacity-60">
                No active tickets at this station
              </p>
            </div>
          </div>
        ) : (
          <div
            className="grid h-full auto-cols-fr gap-3"
            style={{
              gridTemplateColumns: `repeat(${Math.min(activeTickets.length, 6)}, minmax(240px, 1fr))`,
              gridTemplateRows: '1fr',
            }}
          >
            {activeTickets.map((ticket) => (
              <KdsTicket key={ticket.id} ticket={ticket} onBump={handleBump} />
            ))}
          </div>
        )}
      </main>

      {/* All-Day overlay */}
      <KdsAllDay
        counts={allDayCounts}
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
    </div>
  )
}
