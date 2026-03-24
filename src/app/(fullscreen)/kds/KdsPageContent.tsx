'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { MessageSquare } from 'lucide-react'
import { KdsTicket } from '@/components/kds/KdsTicket'
import { KdsExpoTicket } from '@/components/kds/KdsExpoTicket'
import { KdsStationTabs } from '@/components/kds/KdsStationTabs'
import { KdsAllDay } from '@/components/kds/KdsAllDay'
import { KdsRecallDrawer } from '@/components/kds/KdsRecallDrawer'
import { KdsMessageBanner } from '@/components/kds/KdsMessageBanner'
import { setMuted } from '@/lib/kds/audio-alerts'
import { type RefireReasonCode } from '@/stores/kds-store'

/*
 * KDS Page — Local State Version
 *
 * This component uses local useState + API fetches instead of Zustand store
 * to avoid the production-only infinite render loop caused by Zustand v5 + React 19.
 *
 * The Zustand store (kds-store.ts) is still available for other consumers.
 * This page simply doesn't use it for rendering.
 */

interface KdsStation {
  id: string
  name: string
  station_type: string
  location_id: string
  sort_order: number
  is_active: boolean
}

interface KdsTicketItem {
  id: string
  name: string
  quantity: number
  modifiers: string[]
  special_instructions: string
  seat_number: number | null
  course: number
  status: string
  is_void?: boolean
  is_fired?: boolean
  is_bumped?: boolean
  is_refire?: boolean
  refire_count?: number
  refire_reason?: string
  prep_station?: string
  station_label?: string
  category_id?: string
}

interface KdsTicketData {
  id: string
  check_number: string
  table_name: string
  server_name: string
  order_type: string
  guest_count: number
  items: KdsTicketItem[]
  created_at: string
  priority: string
  age_seconds: number
  age_category: string
  allergens: string[]
  notes: string
  is_rush?: boolean
  is_vip?: boolean
}

export default function KdsPage() {
  const [stations, setStations] = useState<KdsStation[]>([])
  const [tickets, setTickets] = useState<KdsTicketData[]>([])
  const [activeStationId, setActiveStationId] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [allDayOpen, setAllDayOpen] = useState(false)
  const [recallOpen, setRecallOpen] = useState(false)
  const [tick, setTick] = useState(0)

  const locationIdRef = useRef('')

  // Dark theme
  useEffect(() => {
    document.documentElement.classList.add('dark')
    return () => { document.documentElement.classList.remove('dark') }
  }, [])

  // Mute sync
  useEffect(() => { setMuted(!soundEnabled) }, [soundEnabled])

  // Fetch stations on mount
  useEffect(() => {
    async function load() {
      try {
        const urlParams = new URLSearchParams(window.location.search)
        const locId = urlParams.get('location_id') ?? ''
        locationIdRef.current = locId

        const url = locId ? `/api/kds/stations?location_id=${locId}` : '/api/kds/stations'
        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed to fetch stations')
        const json = await res.json()
        const list = json.data ?? []
        setStations(list)

        const urlStation = urlParams.get('station')
        if (urlStation && list.some((s: KdsStation) => s.id === urlStation)) {
          setActiveStationId(urlStation)
        } else if (list.length > 0) {
          setActiveStationId(list[0].id)
        }

        if (!locId && list.length > 0 && list[0].location_id) {
          locationIdRef.current = list[0].location_id
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stations')
      }
    }
    load()
  }, [])

  // Fetch tickets when station changes
  const fetchTickets = useCallback(async () => {
    if (!activeStationId) return
    try {
      setLoading(true)
      const locId = locationIdRef.current
      const url = `/api/kds/tickets?station_id=${activeStationId}${locId ? `&location_id=${locId}` : ''}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch tickets')
      const json = await res.json()
      setTickets(json.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tickets')
    } finally {
      setLoading(false)
    }
  }, [activeStationId])

  useEffect(() => { fetchTickets() }, [fetchTickets])

  // Auto-refresh tickets every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1)
      fetchTickets()
    }, 10000)
    return () => clearInterval(interval)
  }, [fetchTickets])

  // Bump ticket
  const handleBump = useCallback(async (ticketId: string) => {
    try {
      await fetch(`/api/kds/tickets/${ticketId}/bump`, { method: 'POST', credentials: 'include' })
      setTickets(prev => prev.filter(t => t.id !== ticketId))
    } catch { /* ignore */ }
  }, [])

  // Bump item
  const handleBumpItem = useCallback(async (ticketId: string, itemId: string) => {
    try {
      await fetch(`/api/kds/tickets/${ticketId}/items/${itemId}/bump`, { method: 'POST', credentials: 'include' })
      fetchTickets()
    } catch { /* ignore */ }
  }, [fetchTickets])

  // Refire item
  const handleRefire = useCallback(async (ticketId: string, itemId: string, reason: RefireReasonCode) => {
    try {
      await fetch(`/api/kds/tickets/${ticketId}/items/${itemId}/refire`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      fetchTickets()
    } catch { /* ignore */ }
  }, [fetchTickets])

  // Bump all
  const handleBumpAll = useCallback(async () => {
    try {
      await fetch('/api/kds/tickets/bump-all', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ station_id: activeStationId }),
      })
      setTickets([])
    } catch { /* ignore */ }
  }, [activeStationId])

  // Derived state
  const activeStation = stations.find(s => s.id === activeStationId)
  const isExpo = activeStation?.station_type === 'expo'
  const priorityCount = tickets.filter(t => t.priority === 'rush' || t.priority === 'vip' || t.priority === 'refire').length

  const allDayCounts: Record<string, number> = {}
  for (const t of tickets) {
    for (const item of t.items ?? []) {
      if (item.status !== 'voided') {
        allDayCounts[item.name] = (allDayCounts[item.name] ?? 0) + item.quantity
      }
    }
  }

  const allDayByCategory: Record<string, Record<string, number>> = {}
  for (const t of tickets) {
    for (const item of t.items ?? []) {
      if (item.status !== 'voided') {
        const cat = item.station_label ?? item.prep_station ?? 'Other'
        if (!allDayByCategory[cat]) allDayByCategory[cat] = {}
        allDayByCategory[cat][item.name] = (allDayByCategory[cat][item.name] ?? 0) + item.quantity
      }
    }
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#0a0a0a] text-white">
        <h2 className="text-xl font-bold mb-2">KDS Error</h2>
        <p className="text-zinc-400">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 px-6 py-3 bg-blue-600 rounded-xl font-semibold">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col bg-[#0a0a0a] no-select no-overscroll">
      {/* Top bar */}
      <header className="z-30 flex flex-shrink-0 items-center gap-2 bg-[#1a1a1a] px-4" style={{ height: 48, borderBottom: '0.5px solid #2a2a2a' }}>
        <KdsStationTabs
          stations={stations}
          activeStationId={activeStationId}
          onSelect={setActiveStationId}
        />

        <div className="flex-1" />

        {priorityCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg border border-red-600/40 bg-red-900/60 px-3 py-1.5 text-xs font-bold text-red-300 animate-pulse">
            Priority: {priorityCount}
          </div>
        )}

        <button onClick={() => setAllDayOpen(true)} className="flex h-10 items-center gap-2 rounded-xl bg-[#2a2a2a] px-4 text-sm font-semibold text-white hover:bg-[#333]" style={{ minHeight: 44 }}>
          All-Day
        </button>

        <button onClick={() => setRecallOpen(true)} className="flex h-10 items-center gap-2 rounded-xl bg-[#2a2a2a] px-4 text-sm font-semibold text-white hover:bg-[#333]" style={{ minHeight: 44 }}>
          Recall
        </button>

        <button
          onClick={() => setSoundEnabled(s => !s)}
          className={`flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-colors ${soundEnabled ? 'bg-[#007AFF] text-white' : 'bg-[#2a2a2a] text-[#666]'}`}
          style={{ minHeight: 44 }}
        >
          {soundEnabled ? '🔊 Sound On' : '🔇 Sound Off'}
        </button>

        <button onClick={handleBumpAll} className="flex h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-600" style={{ minHeight: 44 }}>
          Bump All
        </button>
      </header>

      {/* Ticket grid */}
      <div className="flex-1 overflow-auto p-3">
        {loading && tickets.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-zinc-500 text-lg">Loading tickets...</div>
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="text-zinc-600 text-6xl mb-4">✓</div>
            <div className="text-zinc-400 text-xl font-semibold">All caught up</div>
            <div className="text-zinc-600 text-sm mt-1">No tickets in queue</div>
          </div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(280px, 1fr))` }}>
            {tickets.map((ticket) =>
              isExpo ? (
                <KdsExpoTicket
                  key={ticket.id}
                  ticket={ticket}
                  onBump={handleBump}
                  onBumpItem={handleBumpItem}
                  onRefire={handleRefire}
                />
              ) : (
                <KdsTicket
                  key={ticket.id}
                  ticket={ticket}
                  onBump={handleBump}
                  onBumpItem={handleBumpItem}
                  onRefire={handleRefire}
                />
              )
            )}
          </div>
        )}
      </div>

      {/* All-Day drawer */}
      {allDayOpen && (
        <KdsAllDay
          counts={allDayCounts}
          countsByCategory={allDayByCategory}
          onClose={() => setAllDayOpen(false)}
        />
      )}

      {/* Recall drawer */}
      {recallOpen && (
        <KdsRecallDrawer
          stationId={activeStationId ?? ''}
          onRecall={(ticketId) => {
            fetch(`/api/kds/tickets/${ticketId}/recall`, { method: 'POST', credentials: 'include' }).then(() => fetchTickets())
            setRecallOpen(false)
          }}
          onClose={() => setRecallOpen(false)}
        />
      )}

      {/* Message banner */}
      <KdsMessageBanner />
    </div>
  )
}
