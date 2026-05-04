'use client'

import { cn } from '@/lib/utils'
import { KdsStationStatus, getStationHealth } from './KdsStationStatus'
import { useKdsStore } from '@/stores/kds-store'
import { useShallow } from 'zustand/react/shallow'

interface KdsStation {
  id: string
  name: string
  station_type: string
  sort_order: number
  is_active: boolean
  is_online?: boolean
  last_heartbeat_at?: string
}

interface KdsStationTabsProps {
  stations: KdsStation[]
  activeStationId: string | null
  onSelect: (stationId: string) => void
}

export function KdsStationTabs({ stations, activeStationId, onSelect }: KdsStationTabsProps) {
  const stationHealth = useKdsStore(useShallow((s) => s.stationHealth))
  const activeStations = stations.filter((s) => s.is_active)

  if (activeStations.length === 0) {
    return (
      <div className="flex items-center px-3 text-sm text-[var(--color-text-muted)]">
        No stations configured
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
      {activeStations.map((station) => {
        const isActive = station.id === activeStationId

        // Determine health: prefer realtime stationHealth store, fall back to heartbeat timestamp
        const healthInfo = stationHealth[station.id]
        const health = healthInfo?.health ?? getStationHealth(station.last_heartbeat_at ?? null)
        const failoverActive = healthInfo?.failoverActive ?? false

        return (
          <button
            key={station.id}
            type="button"
            onClick={() => onSelect(station.id)}
            className={cn(
              'btn-press touch-target flex-shrink-0 rounded-[var(--radius-sm)] px-4 py-2 text-sm font-semibold transition-colors',
              'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-border-focus)]',
              isActive
                ? 'text-[var(--color-primary-fg)]'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]',
              health === 'offline' && !isActive && 'opacity-50'
            )}
            style={{
              minHeight: 44,
              backgroundColor: isActive ? 'var(--color-primary)' : 'var(--color-surface)',
            }}
          >
            <span className="flex items-center gap-1.5">
              {station.name}
              {station.station_type === 'expo' && (
                <span className={cn(
                  'text-xs font-bold',
                  isActive ? 'opacity-80' : 'opacity-60'
                )}>
                  EXPO
                </span>
              )}
              <KdsStationStatus
                stationId={station.id}
                health={health}
                failoverActive={failoverActive}
              />
            </span>
          </button>
        )
      })}
    </div>
  )
}
