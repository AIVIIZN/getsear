'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Monitor,
  Save,
  ChevronDown,
  ChevronRight,
  Printer,
  Clock,
  Settings2,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui-v2/Card'
import { Button } from '@/components/ui-v2/Button'
import { Text } from '@/components/ui-v2/inputs/Text'
import { NumberInput } from '@/components/ui-v2/inputs/Number'
import { Select } from '@/components/ui-v2/inputs/Select'
import { Toggle } from '@/components/ui-v2/inputs/Toggle'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import { Alert } from '@/components/ui-v2/feedback/Alert'

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

interface PrinterRecord {
  id: string
  name: string
}

const DEFAULT_CATEGORY_THRESHOLDS: Array<{
  name: string
  fresh: number
  aging: number
  critical: number
}> = [
  { name: 'Appetizers', fresh: 300, aging: 480, critical: 720 },
  { name: 'Entrees', fresh: 480, aging: 900, critical: 1320 },
  { name: 'Desserts', fresh: 300, aging: 600, critical: 900 },
  { name: 'Drinks', fresh: 120, aging: 300, critical: 480 },
]

const STATION_TYPE_OPTIONS = [
  { value: 'prep', label: 'Prep Station' },
  { value: 'expo', label: 'Expo Station' },
]

const FONT_SIZE_OPTIONS = [
  { value: 'small', label: 'Small (14px / 12px)' },
  { value: 'medium', label: 'Medium (16px / 14px)' },
  { value: 'large', label: 'Large (18px / 16px)' },
  { value: 'xlarge', label: 'X-Large (22px / 18px)' },
]

export default function KdsSettingsPage() {
  const [stations, setStations] = useState<StationConfig[]>([])
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['display', 'aging']),
  )
  const [printers, setPrinters] = useState<PrinterRecord[]>([])

  useEffect(() => {
    async function fetchStations() {
      try {
        setLoading(true)
        const res = await fetch('/api/kds/stations')
        if (!res.ok) throw new Error('Failed to fetch stations')
        const json = await res.json()
        const stationList = json.data ?? []

        const configs: StationConfig[] = await Promise.all(
          stationList.map(async (s: { id: string }) => {
            const configRes = await fetch(`/api/kds/stations/${s.id}/config`)
            if (configRes.ok) {
              const configJson = await configRes.json()
              return configJson.data
            }
            return null
          }),
        )

        const valid = configs.filter(Boolean)
        setStations(valid)

        if (valid.length > 0 && !selectedStationId) {
          setSelectedStationId(valid[0]?.id ?? null)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stations')
      } finally {
        setLoading(false)
      }
    }

    fetchStations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    async function fetchPrinters() {
      try {
        const res = await fetch('/api/settings/printers')
        if (res.ok) {
          const json = await res.json()
          setPrinters(json.data ?? [])
        }
      } catch {
        // Endpoint may not exist yet
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
          s.id === selectedStationId ? { ...s, [field]: value } : s,
        ),
      )
    },
    [selectedStationId],
  )

  const updateCategoryThreshold = useCallback(
    (index: number, field: keyof CategoryThreshold, value: unknown) => {
      if (!selectedStation) return
      const thresholds = [...selectedStation.category_thresholds]
      thresholds[index] = { ...thresholds[index], [field]: value }
      updateStation('category_thresholds', thresholds)
    },
    [selectedStation, updateStation],
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
      <div className="flex flex-col gap-[var(--space-6)]">
        <div>
          <h1 className="text-[length:var(--type-title-1-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
            KDS Configuration
          </h1>
          <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
            Configure kitchen display stations
          </p>
        </div>
        <Skeleton variant="card" />
      </div>
    )
  }

  const printerOptions = [
    { value: '', label: 'No backup printer' },
    ...printers.map((p) => ({ value: p.id, label: p.name })),
  ]

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[length:var(--type-title-1-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
            KDS Configuration
          </h1>
          <p className="mt-[var(--space-1)] text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
            Configure kitchen display stations, aging thresholds, and printer failover
          </p>
        </div>
      </div>

      {/* Notifications */}
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <div className="flex gap-[var(--space-6)]">
        {/* Station list — left sidebar */}
        <div className="w-[256px] flex-shrink-0">
          <Card variant="flat" padding="default" className="gap-0 p-0">
            <div className="border-b border-[color:var(--color-border)] px-[var(--space-4)] py-[var(--space-3)]">
              <h3 className="text-[length:var(--type-headline-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
                Stations
              </h3>
            </div>
            <div className="p-[var(--space-2)]">
              {stations.length === 0 ? (
                <p className="px-[var(--space-3)] py-[var(--space-4)] text-center text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
                  No stations configured
                </p>
              ) : (
                stations.map((station) => (
                  <button
                    key={station.id}
                    onClick={() => setSelectedStationId(station.id)}
                    className={cn(
                      'btn-press touch-target flex w-full items-center gap-[var(--space-3)]',
                      'rounded-[var(--radius-sm)] px-[var(--space-3)] py-[var(--space-2)] text-left',
                      'transition-colors duration-[var(--duration-quick)] ease-[var(--ease-out)]',
                      station.id === selectedStationId
                        ? 'bg-[color:var(--color-sidebar-active)] text-[color:var(--color-primary)]'
                        : 'hover:bg-[color:var(--color-surface-hover)]',
                    )}
                  >
                    <Monitor className="h-4 w-4 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[length:var(--type-subhead-size)] font-[var(--weight-semibold)] truncate">
                        {station.name}
                      </p>
                      <p className="text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
                        {station.station_type === 'expo' ? 'Expo' : 'Prep'} station
                      </p>
                    </div>
                    <span
                      className={cn(
                        'h-2 w-2 rounded-full',
                        station.is_active
                          ? 'bg-[color:var(--color-success-strong)]'
                          : 'bg-[color:var(--color-border-strong)]',
                      )}
                    />
                  </button>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Station config — right panel */}
        <div className="flex-1">
          {!selectedStation ? (
            <Card variant="flat" padding="default" className="items-center justify-center py-[var(--space-20)]">
              <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
                Select a station to configure
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-[var(--space-4)]">
              {/* Station Name & Type */}
              <Card variant="flat" padding="default" className="gap-0 p-0">
                <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-[var(--space-5)] py-[var(--space-3)]">
                  <h3 className="text-[length:var(--type-headline-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
                    Station Settings
                  </h3>
                  <Button
                    onClick={saveStation}
                    loading={saving}
                    size="md"
                    leadingIcon={<Save className="h-4 w-4" />}
                  >
                    Save Changes
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-[var(--space-4)] p-[var(--space-5)]">
                  <Text
                    size="md"
                    label="Station Name"
                    value={selectedStation.name}
                    onChange={(e) => updateStation('name', e.target.value)}
                  />
                  <Select
                    size="md"
                    label="Station Type"
                    options={STATION_TYPE_OPTIONS}
                    value={selectedStation.station_type}
                    onChange={(v) => updateStation('station_type', v)}
                  />
                </div>
              </Card>

              {/* Display Settings */}
              <CollapsibleSection
                title="Display Settings"
                icon={<Settings2 className="h-4 w-4" />}
                isExpanded={expandedSections.has('display')}
                onToggle={() => toggleSection('display')}
              >
                <div className="grid grid-cols-2 gap-[var(--space-4)] p-[var(--space-5)]">
                  <NumberInput
                    size="md"
                    label="Display Columns (2-6)"
                    min={2}
                    max={6}
                    value={selectedStation.display_columns}
                    onChange={(e) =>
                      updateStation('display_columns', parseInt(e.target.value, 10) || 4)
                    }
                  />
                  <Select
                    size="md"
                    label="Font Size"
                    options={FONT_SIZE_OPTIONS}
                    value={selectedStation.font_size}
                    onChange={(v) => updateStation('font_size', v)}
                  />
                  <div>
                    <label className="mb-[var(--space-2)] block text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[color:var(--color-text)]">
                      Sound Enabled
                    </label>
                    <Toggle
                      checked={selectedStation.sound_enabled}
                      onChange={(v) => updateStation('sound_enabled', v)}
                    />
                  </div>
                  <NumberInput
                    size="md"
                    label="Max Capacity (items)"
                    min={1}
                    max={500}
                    value={selectedStation.max_capacity}
                    onChange={(e) =>
                      updateStation('max_capacity', parseInt(e.target.value, 10) || 50)
                    }
                  />
                </div>
              </CollapsibleSection>

              {/* Aging Thresholds */}
              <CollapsibleSection
                title="Aging Thresholds"
                icon={<Clock className="h-4 w-4" />}
                isExpanded={expandedSections.has('aging')}
                onToggle={() => toggleSection('aging')}
              >
                <div className="p-[var(--space-5)]">
                  <p className="mb-[var(--space-4)] text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
                    Default thresholds for this station. Override per menu category below.
                  </p>
                  <div className="grid grid-cols-3 gap-[var(--space-4)]">
                    <NumberInput
                      size="md"
                      label="Fresh (min)"
                      min={1}
                      max={120}
                      value={secondsToMinutes(selectedStation.default_fresh_max)}
                      onChange={(e) =>
                        updateStation(
                          'default_fresh_max',
                          minutesToSeconds(parseInt(e.target.value, 10) || 5),
                        )
                      }
                    />
                    <NumberInput
                      size="md"
                      label="Aging (min)"
                      min={1}
                      max={120}
                      value={secondsToMinutes(selectedStation.default_aging_max)}
                      onChange={(e) =>
                        updateStation(
                          'default_aging_max',
                          minutesToSeconds(parseInt(e.target.value, 10) || 10),
                        )
                      }
                    />
                    <NumberInput
                      size="md"
                      label="Critical (min)"
                      min={1}
                      max={120}
                      value={secondsToMinutes(selectedStation.default_critical_max)}
                      onChange={(e) =>
                        updateStation(
                          'default_critical_max',
                          minutesToSeconds(parseInt(e.target.value, 10) || 15),
                        )
                      }
                    />
                  </div>

                  {/* Category-specific thresholds */}
                  <div className="mt-[var(--space-6)]">
                    <h4 className="mb-[var(--space-3)] text-[length:var(--type-subhead-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
                      Category-Specific Overrides
                    </h4>
                    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[color:var(--color-border)]">
                      <table className="w-full text-[length:var(--type-subhead-size)]">
                        <thead>
                          <tr className="border-b border-[color:var(--color-border)] bg-[color:var(--color-bg-subtle)]">
                            <th className="px-[var(--space-4)] py-[var(--space-3)] text-left text-[length:var(--type-footnote-size)] font-[var(--weight-semibold)] uppercase tracking-wider text-[color:var(--color-text-muted)]">
                              Category
                            </th>
                            <th className="px-[var(--space-4)] py-[var(--space-3)] text-center text-[length:var(--type-footnote-size)] font-[var(--weight-semibold)] uppercase tracking-wider text-[color:var(--color-success)]">
                              Fresh (min)
                            </th>
                            <th className="px-[var(--space-4)] py-[var(--space-3)] text-center text-[length:var(--type-footnote-size)] font-[var(--weight-semibold)] uppercase tracking-wider text-[color:var(--color-warning)]">
                              Aging (min)
                            </th>
                            <th className="px-[var(--space-4)] py-[var(--space-3)] text-center text-[length:var(--type-footnote-size)] font-[var(--weight-semibold)] uppercase tracking-wider text-[color:var(--color-danger)]">
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
                            <tr
                              key={idx}
                              className="border-b border-[color:var(--color-border)] last:border-0"
                            >
                              <td className="px-[var(--space-4)] py-[var(--space-2)] font-[var(--weight-medium)]">
                                {threshold.menu_category_name ?? threshold.menu_category_id}
                              </td>
                              <td className="px-[var(--space-4)] py-[var(--space-2)]">
                                <NumberInput
                                  size="md"
                                  min={1}
                                  max={120}
                                  value={secondsToMinutes(threshold.fresh_max_seconds)}
                                  onChange={(e) =>
                                    updateCategoryThreshold(
                                      idx,
                                      'fresh_max_seconds',
                                      minutesToSeconds(parseInt(e.target.value, 10) || 5),
                                    )
                                  }
                                  className="w-24 text-center tabular-nums"
                                />
                              </td>
                              <td className="px-[var(--space-4)] py-[var(--space-2)]">
                                <NumberInput
                                  size="md"
                                  min={1}
                                  max={120}
                                  value={secondsToMinutes(threshold.aging_max_seconds)}
                                  onChange={(e) =>
                                    updateCategoryThreshold(
                                      idx,
                                      'aging_max_seconds',
                                      minutesToSeconds(parseInt(e.target.value, 10) || 10),
                                    )
                                  }
                                  className="w-24 text-center tabular-nums"
                                />
                              </td>
                              <td className="px-[var(--space-4)] py-[var(--space-2)]">
                                <NumberInput
                                  size="md"
                                  min={1}
                                  max={120}
                                  value={secondsToMinutes(threshold.critical_max_seconds)}
                                  onChange={(e) =>
                                    updateCategoryThreshold(
                                      idx,
                                      'critical_max_seconds',
                                      minutesToSeconds(parseInt(e.target.value, 10) || 15),
                                    )
                                  }
                                  className="w-24 text-center tabular-nums"
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
                <div className="p-[var(--space-5)]">
                  <p className="mb-[var(--space-4)] text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
                    When this KDS station goes offline (misses 3 heartbeats / 90 seconds),
                    tickets will automatically route to the backup kitchen printer.
                  </p>
                  <div className="grid grid-cols-2 gap-[var(--space-4)]">
                    <Select
                      size="md"
                      label="Backup Printer"
                      options={printerOptions}
                      value={selectedStation.failover_printer_id ?? ''}
                      onChange={(v) =>
                        updateStation('failover_printer_id', v || null)
                      }
                    />
                    <NumberInput
                      size="md"
                      label="Kitchen Close Auto-Timer (min)"
                      min={0}
                      max={480}
                      value={selectedStation.kitchen_close_auto_minutes}
                      onChange={(e) =>
                        updateStation(
                          'kitchen_close_auto_minutes',
                          parseInt(e.target.value, 10) || 0,
                        )
                      }
                      helper="0 = manual only. Set to auto-close kitchen after X minutes."
                    />
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
                <div className="p-[var(--space-5)]">
                  <div className="grid grid-cols-2 gap-[var(--space-4)]">
                    <div>
                      <label className="mb-[var(--space-1)] block text-[length:var(--type-footnote-size)] font-[var(--weight-semibold)] uppercase tracking-wider text-[color:var(--color-text-muted)]">
                        Last Heartbeat
                      </label>
                      <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text)]">
                        {selectedStation.last_heartbeat_at
                          ? new Date(selectedStation.last_heartbeat_at).toLocaleString()
                          : 'Never'}
                      </p>
                    </div>
                    <div>
                      <label className="mb-[var(--space-1)] block text-[length:var(--type-footnote-size)] font-[var(--weight-semibold)] uppercase tracking-wider text-[color:var(--color-text-muted)]">
                        Status
                      </label>
                      <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text)]">
                        {(() => {
                          if (!selectedStation.last_heartbeat_at) return 'Offline'
                          const elapsed =
                            Date.now() - new Date(selectedStation.last_heartbeat_at).getTime()
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
    <Card variant="flat" padding="default" className="gap-0 p-0 overflow-hidden">
      <button
        onClick={onToggle}
        className={cn(
          'btn-press touch-target flex w-full items-center gap-[var(--space-3)]',
          'px-[var(--space-5)] py-[var(--space-3)] text-left',
          'transition-colors duration-[var(--duration-quick)] ease-[var(--ease-out)]',
          'hover:bg-[color:var(--color-surface-hover)]',
        )}
      >
        {icon}
        <span className="flex-1 text-[length:var(--type-headline-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
          {title}
        </span>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-[color:var(--color-text-muted)]" />
        ) : (
          <ChevronRight className="h-4 w-4 text-[color:var(--color-text-muted)]" />
        )}
      </button>
      {isExpanded && <div className="border-t border-[color:var(--color-border)]">{children}</div>}
    </Card>
  )
}
