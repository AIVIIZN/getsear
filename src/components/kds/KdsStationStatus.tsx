'use client'

import { cn } from '@/lib/utils'

type StationHealth = 'online' | 'degraded' | 'offline'

interface KdsStationStatusProps {
  stationId: string
  health: StationHealth
  failoverActive?: boolean
}

/**
 * Small indicator dot showing station online/offline status.
 * - Green dot = online (heartbeat within 90s)
 * - Yellow dot = degraded (intermittent heartbeats, 60-90s)
 * - Red dot = offline (missed 3+ heartbeats, >90s)
 *
 * Placed on each station tab in the KDS toolbar.
 */
export function KdsStationStatus({ stationId, health, failoverActive }: KdsStationStatusProps) {
  return (
    <span
      className="relative inline-flex"
      title={getStatusTitle(health, failoverActive)}
    >
      <span
        className={cn(
          'inline-block h-2.5 w-2.5 rounded-full',
          health === 'online' && 'bg-[var(--color-kds-aging-fresh)]',
          health === 'degraded' && 'bg-[var(--color-kds-aging-aging)]',
          health === 'offline' && 'bg-[var(--color-kds-priority-rush)]'
        )}
      />
      {/* Ping animation for degraded/offline */}
      {health !== 'online' && (
        <span
          className={cn(
            'absolute inset-0 inline-flex h-2.5 w-2.5 animate-ping rounded-full opacity-50',
            health === 'degraded' && 'bg-[var(--color-kds-aging-aging)]',
            health === 'offline' && 'bg-[var(--color-kds-priority-rush)]'
          )}
        />
      )}
    </span>
  )
}

function getStatusTitle(health: StationHealth, failoverActive?: boolean): string {
  switch (health) {
    case 'online':
      return 'Station online'
    case 'degraded':
      return 'Station connection intermittent'
    case 'offline':
      return failoverActive
        ? 'Station offline - tickets routing to backup printer'
        : 'Station offline'
  }
}

/**
 * Determine station health from last heartbeat timestamp.
 */
export function getStationHealth(lastHeartbeatAt: string | null): StationHealth {
  if (!lastHeartbeatAt) return 'offline'

  const elapsed = Date.now() - new Date(lastHeartbeatAt).getTime()

  if (elapsed < 60000) return 'online'
  if (elapsed < 90000) return 'degraded'
  return 'offline'
}
