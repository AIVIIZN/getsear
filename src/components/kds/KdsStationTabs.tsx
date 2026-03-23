'use client'

import { cn } from '@/lib/utils'
import { KdsStationStatus, getStationHealth } from './KdsStationStatus'
import { useKdsStore } from '@/stores/kds-store'

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
  const stationHealth = useKdsStore((s) => s.stationHealth)
  const activeStations = stations.filter((s) => s.is_active)

  if (activeStations.length === 0) {
    return (
      <div className="flex items-center px-3 text-sm text-[#888]">
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
            onClick={() => onSelect(station.id)}
            className={cn(
              'flex-shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
              isActive
                ? 'bg-[#F06B18] text-white'
                : 'bg-[#2a2a2a] text-[#999] hover:bg-[#333]',
              health === 'offline' && !isActive && 'opacity-50'
            )}
            style={{ minHeight: 44 }}
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
