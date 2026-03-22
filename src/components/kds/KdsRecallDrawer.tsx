'use client'

import { useEffect, useState, useCallback } from 'react'

interface RecalledTicket {
  ticket_id: string
  order_id: string
  order_number: string
  order_type: string
  bumped_at: string
  item_count: number
}

interface KdsRecallDrawerProps {
  isOpen: boolean
  onClose: () => void
  stationId: string | null
  locationId: string
  onRecall: (ticketId: string) => void
}

export function KdsRecallDrawer({
  isOpen,
  onClose,
  stationId,
  locationId,
  onRecall,
}: KdsRecallDrawerProps) {
  const [recentBumps, setRecentBumps] = useState<RecalledTicket[]>([])
  const [loading, setLoading] = useState(false)

  const fetchRecentBumps = useCallback(async () => {
    if (!stationId) return

    setLoading(true)
    try {
      const res = await fetch(
        `/api/kds/tickets?station_id=${stationId}&location_id=${locationId}&_bumped=true`
      )
      if (!res.ok) {
        // Fallback: fetch bump events directly
        // This is a simplified approach — in production you'd have a dedicated endpoint
        setRecentBumps([])
        return
      }
      const json = await res.json()
      setRecentBumps(json.data ?? [])
    } catch {
      setRecentBumps([])
    } finally {
      setLoading(false)
    }
  }, [stationId, locationId])

  useEffect(() => {
    if (isOpen) {
      fetchRecentBumps()
    }
  }, [isOpen, fetchRecentBumps])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Drawer */}
      <div className="relative z-10 flex h-full w-full max-w-md flex-col bg-[var(--card)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h3 className="text-lg font-bold text-[var(--foreground)]">Recall Ticket</h3>
          <button
            onClick={onClose}
            className="touch-target flex h-10 w-10 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
            </div>
          ) : recentBumps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="mb-3 h-12 w-12 text-[var(--muted-foreground)]">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              <p className="text-sm text-[var(--muted-foreground)]">
                No recently bumped tickets to recall.
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Tickets can be recalled within 30 minutes of being bumped.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentBumps.map((bump) => (
                <button
                  key={bump.ticket_id}
                  onClick={() => {
                    onRecall(bump.ticket_id)
                    onClose()
                  }}
                  className="btn-press touch-target-lg flex w-full items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-3 text-left transition-colors hover:bg-[var(--accent)]"
                >
                  <div>
                    <span className="text-lg font-bold text-[var(--foreground)]">
                      #{bump.order_number}
                    </span>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {bump.item_count} item{bump.item_count !== 1 ? 's' : ''} &middot;{' '}
                      {bump.order_type}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Bumped {formatTimeAgo(bump.bumped_at)}
                    </p>
                    <span className="text-sm font-semibold text-[var(--primary)]">Recall</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatTimeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}
