'use client'

interface KdsStation {
  id: string
  name: string
  type: string
  sort_order: number
  is_active: boolean
}

interface KdsStationTabsProps {
  stations: KdsStation[]
  activeStationId: string | null
  onSelect: (stationId: string) => void
}

export function KdsStationTabs({ stations, activeStationId, onSelect }: KdsStationTabsProps) {
  const activeStations = stations.filter((s) => s.is_active)

  if (activeStations.length === 0) {
    return (
      <div className="flex items-center px-3 text-sm text-[var(--muted-foreground)]">
        No stations configured
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
      {activeStations.map((station) => {
        const isActive = station.id === activeStationId
        return (
          <button
            key={station.id}
            onClick={() => onSelect(station.id)}
            className={`touch-target-lg flex-shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              isActive
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                : 'bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--accent)]'
            }`}
          >
            {station.name}
            {station.type === 'expo' && (
              <span className="ml-1.5 text-xs opacity-70">EXPO</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
