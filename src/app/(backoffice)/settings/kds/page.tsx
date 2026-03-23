'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Monitor,
  Plus,
  Save,
  Trash2,
  ChevronDown,
  ChevronRight,
  Printer,
  Clock,
  Settings2,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface StationConfig {
  id: string
  name: string
  station_type: 'prep' | 'expo'
  location_id: string
  is_active: boolean
  sort_order: number
  prep_stations: string[]
  display_columns: number
  font_size: string
  sound_enabled: boolean
  sound_volume: number
  failover_printer_id: string | null
  max_capacity: number
  default_fresh_max: number
  default_aging_max: number
  default_critical_max: number
  category_thresholds: CategoryThreshold[]
  kitchen_close_auto_minutes: number
  last_heartbeat_at: string | null
}

interface CategoryThreshold {
  menu_category_id: string
  menu_category_name?: string
  fresh_max_seconds: number
  aging_max_seconds: number
  critical_max_seconds: number
}

interface Printer {
  id: string
  name: string
}

const DEFAULT_CATEGORY_THRESHOLDS: Array<{ name: string; fresh: number; aging: number; critical: number }> = [
  { name: 'Appetizers', fresh: 300, aging: 480, critical: 720 },
  { name: 'Entrees', fresh: 480, aging: 900, critical: 1320 },
  { name: 'Desserts', fresh: 300, aging: 600, critical: 900 },
  { name: 'Drinks', fresh: 120, aging: 300, critical: 480 },
]

export default function KdsSettingsPage() {
  const [stations, setStations] = useState<StationConfig[]>([])
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['display', 'aging']))
  const [printers, setPrinters] = useState<Printer[]>([])

  // Fetch stations
  useEffect(() => {
    async function fetchStations() {
      try {
        setLoading(true)
        const res = await fetch('/api/kds/stations')
        if (!res.ok) throw new Error('Failed to fetch stations')
        const json = await res.json()
        const stationList = json.data ?? []

        // Fetch config for each station
        const configs: StationConfig[] = await Promise.all(
          stationList.map(async (s: { id: string }) => {
            const configRes = await fetch(`/api/kds/stations/${s.id}/config`)
            if (configRes.ok) {
              const configJson = await configRes.json()
              return configJson.data
            }
            return null
          })
        )

        setStations(configs.filter(Boolean))

        if (configs.length > 0 && !selectedStationId) {
          setSelectedStationId(configs[0]?.id ?? null)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stations')
      } finally {
        setLoading(false)
      }
    }

    fetchStations()
  }, [])

  // Fetch printers for failover dropdown
  useEffect(() => {
    async function fetchPrinters() {
      try {
        const res = await fetch('/api/settings/printers')
        if (res.ok) {
          const json = await res.json()
          setPrinters(json.data ?? [])
        }
      } catch {
        // Printers endpoint may not exist yet — that is fine
      }
    }
    fetchPrinters()
  }, [])

  const selectedStation = stations.find((s) => s.id === selectedStationId) ?? null

  const updateStation = useCallback(
    (field: keyof StationConfig, value: unknown) => {
      if (!selectedStationId) return
      setStations((prev) =>
        prev.map((s) =>
          s.id === selectedStationId ? { ...s, [field]: value } : s
        )
      )
    },
    [selectedStationId]
  )

  const updateCategoryThreshold = useCallback(
    (index: number, field: keyof CategoryThreshold, value: unknown) => {
      if (!selectedStation) return
      const thresholds = [...selectedStation.category_thresholds]
      thresholds[index] = { ...thresholds[index], [field]: value }
      updateStation('category_thresholds', thresholds)
    },
    [selectedStation, updateStation]
  )

  const saveStation = useCallback(async () => {
    if (!selectedStation) return

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const res = await fetch(`/api/kds/stations/${selectedStation.id}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedStation.name,
          station_type: selectedStation.station_type,
          display_columns: selectedStation.display_columns,
          font_size: selectedStation.font_size,
          sound_enabled: selectedStation.sound_enabled,
          sound_volume: selectedStation.sound_volume,
          failover_printer_id: selectedStation.failover_printer_id,
          max_capacity: selectedStation.max_capacity,
          default_fresh_max: selectedStation.default_fresh_max,
          default_aging_max: selectedStation.default_aging_max,
          default_critical_max: selectedStation.default_critical_max,
          category_thresholds: selectedStation.category_thresholds,
          kitchen_close_auto_minutes: selectedStation.kitchen_close_auto_minutes,
        }),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to save')
      }

      setSuccess('Station configuration saved')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [selectedStation])

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }, [])

  const secondsToMinutes = (seconds: number) => Math.round(seconds / 60)
  const minutesToSeconds = (minutes: number) => minutes * 60

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="page-title">KDS Configuration</h1>
          <p className="page-subtitle">Configure kitchen display stations</p>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">KDS Configuration</h1>
          <p className="page-subtitle">Configure kitchen display stations, aging thresholds, and printer failover</p>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="flex gap-6">
        {/* Station list — left sidebar */}
        <div className="w-64 flex-shrink-0">
          <div className="rounded-2xl border border-[var(--border)] bg-white shadow-warm-sm">
            <div className="border-b border-[var(--border)] px-4 py-3">
              <h3 className="text-headline font-semibold">Stations</h3>
            </div>
            <div className="p-2">
              {stations.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-[var(--text-muted)]">
                  No stations configured
                </p>
              ) : (
                stations.map((station) => (
                  <button
                    key={station.id}
                    onClick={() => setSelectedStationId(station.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                      station.id === selectedStationId
                        ? 'bg-[var(--primary-subtle)] text-[var(--primary)]'
                        : 'hover:bg-[var(--background-subtle)]'
                    )}
                  >
                    <Monitor className="h-4 w-4 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{station.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {station.station_type === 'expo' ? 'Expo' : 'Prep'} station
                      </p>
                    </div>
                    {station.is_active ? (
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-gray-300" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Station config — right panel */}
        <div className="flex-1">
          {!selectedStation ? (
            <div className="flex items-center justify-center rounded-2xl border border-[var(--border)] bg-white py-20 shadow-warm-sm">
              <p className="text-sm text-[var(--text-muted)]">Select a station to configure</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Station Name & Type */}
              <div className="rounded-2xl border border-[var(--border)] bg-white shadow-warm-sm">
                <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
                  <h3 className="text-headline font-semibold">Station Settings</h3>
                  <button
                    onClick={saveStation}
                    disabled={saving}
                    className={cn(
                      'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors',
                      saving
                        ? 'bg-gray-400'
                        : 'bg-[var(--primary)] hover:bg-[var(--primary-hover)]'
                    )}
                  >
                    <Save className="h-4 w-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4 p-5">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Station Name
                    </label>
                    <input
                      type="text"
                      value={selectedStation.name}
                      onChange={(e) => updateStation('name', e.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Station Type
                    </label>
                    <select
                      value={selectedStation.station_type}
                      onChange={(e) => updateStation('station_type', e.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
                    >
                      <option value="prep">Prep Station</option>
                      <option value="expo">Expo Station</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Display Settings */}
              <CollapsibleSection
                title="Display Settings"
                icon={<Settings2 className="h-4 w-4" />}
                isExpanded={expandedSections.has('display')}
                onToggle={() => toggleSection('display')}
              >
                <div className="grid grid-cols-2 gap-4 p-5">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Display Columns (2-6)
                    </label>
                    <input
                      type="number"
                      min={2}
                      max={6}
                      value={selectedStation.display_columns}
                      onChange={(e) => updateStation('display_columns', parseInt(e.target.value, 10) || 4)}
                      className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Font Size
                    </label>
                    <select
                      value={selectedStation.font_size}
                      onChange={(e) => updateStation('font_size', e.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
                    >
                      <option value="small">Small (14px / 12px)</option>
                      <option value="medium">Medium (16px / 14px)</option>
                      <option value="large">Large (18px / 16px)</option>
                      <option value="xlarge">X-Large (22px / 18px)</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Sound Enabled
                    </label>
                    <div className="flex items-center gap-3 py-1.5">
                      <button
                        onClick={() => updateStation('sound_enabled', !selectedStation.sound_enabled)}
                        className={cn(
                          'relative h-7 w-12 rounded-full transition-colors',
                          selectedStation.sound_enabled ? 'bg-[var(--primary)]' : 'bg-gray-300'
                        )}
                      >
                        <span
                          className={cn(
                            'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform',
                            selectedStation.sound_enabled ? 'left-[22px]' : 'left-0.5'
                          )}
                        />
                      </button>
                      <span className="text-sm">{selectedStation.sound_enabled ? 'On' : 'Off'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Max Capacity (items)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={selectedStation.max_capacity}
                      onChange={(e) => updateStation('max_capacity', parseInt(e.target.value, 10) || 50)}
                      className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                </div>
              </CollapsibleSection>

              {/* Aging Thresholds */}
              <CollapsibleSection
                title="Aging Thresholds"
                icon={<Clock className="h-4 w-4" />}
                isExpanded={expandedSections.has('aging')}
                onToggle={() => toggleSection('aging')}
              >
                <div className="p-5">
                  <p className="mb-4 text-xs text-[var(--text-muted)]">
                    Default thresholds for this station. Override per menu category below.
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#34C759]">
                        Fresh Threshold (min)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={secondsToMinutes(selectedStation.default_fresh_max)}
                        onChange={(e) =>
                          updateStation('default_fresh_max', minutesToSeconds(parseInt(e.target.value, 10) || 5))
                        }
                        className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#FFCC00]">
                        Aging Threshold (min)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={secondsToMinutes(selectedStation.default_aging_max)}
                        onChange={(e) =>
                          updateStation('default_aging_max', minutesToSeconds(parseInt(e.target.value, 10) || 10))
                        }
                        className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#FF3B30]">
                        Critical Threshold (min)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={secondsToMinutes(selectedStation.default_critical_max)}
                        onChange={(e) =>
                          updateStation('default_critical_max', minutesToSeconds(parseInt(e.target.value, 10) || 15))
                        }
                        className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
                      />
                    </div>
                  </div>

                  {/* Category-specific thresholds */}
                  <div className="mt-6">
                    <h4 className="mb-3 text-sm font-semibold">Category-Specific Overrides</h4>
                    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[var(--border)] bg-[var(--background-subtle)]">
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                              Category
                            </th>
                            <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-[#34C759]">
                              Fresh (min)
                            </th>
                            <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-[#FFCC00]">
                              Aging (min)
                            </th>
                            <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-[#FF3B30]">
                              Critical (min)
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(selectedStation.category_thresholds.length > 0
                            ? selectedStation.category_thresholds
                            : DEFAULT_CATEGORY_THRESHOLDS.map((d) => ({
                                menu_category_id: d.name.toLowerCase(),
                                menu_category_name: d.name,
                                fresh_max_seconds: d.fresh,
                                aging_max_seconds: d.aging,
                                critical_max_seconds: d.critical,
                              }))
                          ).map((threshold, idx) => (
                            <tr key={idx} className="border-b border-[var(--border)] last:border-0">
                              <td className="px-4 py-2 font-medium">
                                {threshold.menu_category_name ?? threshold.menu_category_id}
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="number"
                                  min={1}
                                  max={120}
                                  value={secondsToMinutes(threshold.fresh_max_seconds)}
                                  onChange={(e) =>
                                    updateCategoryThreshold(
                                      idx,
                                      'fresh_max_seconds',
                                      minutesToSeconds(parseInt(e.target.value, 10) || 5)
                                    )
                                  }
                                  className="w-20 rounded-lg border border-[var(--border)] px-2 py-1.5 text-center text-sm outline-none focus:border-[var(--primary)]"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="number"
                                  min={1}
                                  max={120}
                                  value={secondsToMinutes(threshold.aging_max_seconds)}
                                  onChange={(e) =>
                                    updateCategoryThreshold(
                                      idx,
                                      'aging_max_seconds',
                                      minutesToSeconds(parseInt(e.target.value, 10) || 10)
                                    )
                                  }
                                  className="w-20 rounded-lg border border-[var(--border)] px-2 py-1.5 text-center text-sm outline-none focus:border-[var(--primary)]"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="number"
                                  min={1}
                                  max={120}
                                  value={secondsToMinutes(threshold.critical_max_seconds)}
                                  onChange={(e) =>
                                    updateCategoryThreshold(
                                      idx,
                                      'critical_max_seconds',
                                      minutesToSeconds(parseInt(e.target.value, 10) || 15)
                                    )
                                  }
                                  className="w-20 rounded-lg border border-[var(--border)] px-2 py-1.5 text-center text-sm outline-none focus:border-[var(--primary)]"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </CollapsibleSection>

              {/* Printer Failover */}
              <CollapsibleSection
                title="Printer Failover"
                icon={<Printer className="h-4 w-4" />}
                isExpanded={expandedSections.has('failover')}
                onToggle={() => toggleSection('failover')}
              >
                <div className="p-5">
                  <p className="mb-4 text-xs text-[var(--text-muted)]">
                    When this KDS station goes offline (misses 3 heartbeats / 90 seconds),
                    tickets will automatically route to the backup kitchen printer.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Backup Printer
                      </label>
                      <select
                        value={selectedStation.failover_printer_id ?? ''}
                        onChange={(e) =>
                          updateStation(
                            'failover_printer_id',
                            e.target.value || null
                          )
                        }
                        className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
                      >
                        <option value="">No backup printer</option>
                        {printers.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Kitchen Close Auto-Timer (min)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={480}
                        value={selectedStation.kitchen_close_auto_minutes}
                        onChange={(e) =>
                          updateStation(
                            'kitchen_close_auto_minutes',
                            parseInt(e.target.value, 10) || 0
                          )
                        }
                        className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
                      />
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        0 = manual only. Set to auto-close kitchen after X minutes.
                      </p>
                    </div>
                  </div>
                </div>
              </CollapsibleSection>

              {/* Station Health */}
              <CollapsibleSection
                title="Station Health"
                icon={<Activity className="h-4 w-4" />}
                isExpanded={expandedSections.has('health')}
                onToggle={() => toggleSection('health')}
              >
                <div className="p-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Last Heartbeat
                      </label>
                      <p className="text-sm">
                        {selectedStation.last_heartbeat_at
                          ? new Date(selectedStation.last_heartbeat_at).toLocaleString()
                          : 'Never'}
                      </p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Status
                      </label>
                      <p className="text-sm">
                        {(() => {
                          if (!selectedStation.last_heartbeat_at) return 'Offline'
                          const elapsed = Date.now() - new Date(selectedStation.last_heartbeat_at).getTime()
                          if (elapsed < 60000) return 'Online'
                          if (elapsed < 90000) return 'Degraded'
                          return 'Offline'
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              </CollapsibleSection>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Collapsible section used in the config panel */
function CollapsibleSection({
  title,
  icon,
  isExpanded,
  onToggle,
  children,
}: {
  title: string
  icon: React.ReactNode
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white shadow-warm-sm">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-[var(--background-subtle)]"
      >
        {icon}
        <span className="flex-1 text-headline font-semibold">{title}</span>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
        ) : (
          <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
        )}
      </button>
      {isExpanded && <div className="border-t border-[var(--border)]">{children}</div>}
    </div>
  )
}
