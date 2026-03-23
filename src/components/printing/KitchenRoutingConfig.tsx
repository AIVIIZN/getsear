'use client'

import { useState, useCallback, useEffect } from 'react'
import { Plus, X, Save, ChefHat, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Printer {
  id: string
  name: string
  role: string
  is_active: boolean
}

interface RoutingRule {
  id: string
  station_name: string
  primary_printer_id: string
  fallback_printer_id: string | null
}

interface KitchenRoutingConfigProps {
  /** Available kitchen printers (pre-filtered to kitchen/bar role) */
  printers: Printer[]
  /** Location ID for saving rules */
  locationId: string
  /** Organization ID for saving rules */
  orgId: string
}

// ---------------------------------------------------------------------------
// Predefined stations
// ---------------------------------------------------------------------------

const DEFAULT_STATIONS = [
  'Grill',
  'Saute',
  'Fry',
  'Cold/Salad',
  'Pizza',
  'Dessert',
  'Expo',
  'Bar',
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KitchenRoutingConfig({
  printers,
  locationId,
  orgId,
}: KitchenRoutingConfigProps) {
  const [rules, setRules] = useState<RoutingRule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [customStation, setCustomStation] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)

  // Load existing rules
  useEffect(() => {
    async function loadRules() {
      try {
        const res = await fetch(`/api/printing/routing?location_id=${locationId}`)
        if (res.ok) {
          const data = await res.json()
          setRules(data.data ?? [])
        }
      } catch {
        // Silently fail — start with empty rules
      } finally {
        setLoading(false)
      }
    }
    loadRules()
  }, [locationId])

  // Available stations: defaults minus already-configured, plus any custom ones in existing rules
  const configuredStations = new Set(rules.map((r) => r.station_name))
  const availableStations = DEFAULT_STATIONS.filter((s) => !configuredStations.has(s))

  const addStation = useCallback(
    (stationName: string) => {
      if (!stationName.trim() || configuredStations.has(stationName.trim())) return

      const newRule: RoutingRule = {
        id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        station_name: stationName.trim(),
        primary_printer_id: printers[0]?.id ?? '',
        fallback_printer_id: null,
      }
      setRules((prev) => [...prev, newRule])
      setCustomStation('')
      setShowCustomInput(false)
    },
    [configuredStations, printers]
  )

  const removeStation = useCallback((stationName: string) => {
    setRules((prev) => prev.filter((r) => r.station_name !== stationName))
  }, [])

  const updateRule = useCallback(
    (stationName: string, field: 'primary_printer_id' | 'fallback_printer_id', value: string) => {
      setRules((prev) =>
        prev.map((r) =>
          r.station_name === stationName
            ? { ...r, [field]: value || null }
            : r
        )
      )
    },
    []
  )

  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaveStatus('idle')

    try {
      const res = await fetch('/api/printing/routing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: locationId,
          rules: rules.map((r) => ({
            station_name: r.station_name,
            primary_printer_id: r.primary_printer_id,
            fallback_printer_id: r.fallback_printer_id,
          })),
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setRules(data.data ?? rules)
        setSaveStatus('saved')
      } else {
        setSaveStatus('error')
      }
    } catch {
      setSaveStatus('error')
    } finally {
      setSaving(false)
      setTimeout(() => setSaveStatus('idle'), 2000)
    }
  }, [locationId, rules])

  const kitchenPrinters = printers.filter(
    (p) => p.is_active && (p.role === 'kitchen' || p.role === 'bar' || p.role === 'receipt')
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[#8E8E93]" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[17px] font-semibold text-[#1C1C1E]">Kitchen Routing</h3>
          <p className="mt-0.5 text-sm text-[#8E8E93]">
            Route kitchen tickets to the correct printer by station
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || rules.length === 0}
          className={cn(
            'h-10 gap-2 px-4',
            saveStatus === 'saved' && 'bg-[#34C759] hover:bg-[#34C759]/90',
            saveStatus === 'error' && 'bg-[#FF3B30] hover:bg-[#FF3B30]/90'
          )}
          style={{ minHeight: 44 }}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {!saving && saveStatus === 'saved' && <Check className="h-4 w-4" />}
          {!saving && saveStatus === 'idle' && <Save className="h-4 w-4" />}
          {saving ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Error' : 'Save'}
        </Button>
      </div>

      {/* Empty state */}
      {rules.length === 0 && kitchenPrinters.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-black/[0.12] bg-black/[0.01] py-12">
          <ChefHat className="mb-3 h-12 w-12 text-[#C7C7CC]" strokeWidth={1.2} />
          <p className="text-sm font-medium text-[#8E8E93]">
            No kitchen printers configured
          </p>
          <p className="mt-1 text-xs text-[#C7C7CC]">
            Add kitchen printers first, then configure routing
          </p>
        </div>
      )}

      {rules.length === 0 && kitchenPrinters.length > 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-black/[0.12] bg-black/[0.01] py-12">
          <ChefHat className="mb-3 h-12 w-12 text-[#C7C7CC]" strokeWidth={1.2} />
          <p className="text-sm font-medium text-[#8E8E93]">
            Configure kitchen routing to direct tickets to the correct printer
          </p>
          <p className="mt-1 text-xs text-[#C7C7CC]">
            Add a station below to get started
          </p>
        </div>
      )}

      {/* Routing table */}
      {rules.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-black/[0.08]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-black/[0.06] bg-black/[0.02]">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8E8E93]">
                  Station
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8E8E93]">
                  Primary Printer
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8E8E93]">
                  Fallback Printer
                </th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {rules.map((rule) => (
                <tr key={rule.station_name} className="hover:bg-black/[0.01]">
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-[#1C1C1E]">
                      {rule.station_name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={rule.primary_printer_id}
                      onChange={(e) =>
                        updateRule(rule.station_name, 'primary_printer_id', e.target.value)
                      }
                      className={cn(
                        'h-10 w-full rounded-lg border border-black/[0.08] bg-white px-3 text-sm text-[#1C1C1E] outline-none',
                        'focus:border-[#F06B18] focus:ring-2 focus:ring-[#F06B18]/20',
                        'transition-colors'
                      )}
                      style={{ minHeight: 44 }}
                    >
                      <option value="">Select printer...</option>
                      {kitchenPrinters.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={rule.fallback_printer_id ?? ''}
                      onChange={(e) =>
                        updateRule(rule.station_name, 'fallback_printer_id', e.target.value)
                      }
                      className={cn(
                        'h-10 w-full rounded-lg border border-black/[0.08] bg-white px-3 text-sm text-[#1C1C1E] outline-none',
                        'focus:border-[#F06B18] focus:ring-2 focus:ring-[#F06B18]/20',
                        'transition-colors'
                      )}
                      style={{ minHeight: 44 }}
                    >
                      <option value="">None</option>
                      {kitchenPrinters
                        .filter((p) => p.id !== rule.primary_printer_id)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => removeStation(rule.station_name)}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-lg',
                        'text-[#FF3B30]/60 hover:bg-[#FF3B30]/[0.06] hover:text-[#FF3B30]',
                        'transition-colors'
                      )}
                      aria-label={`Remove ${rule.station_name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add station buttons */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-[#3C3C43]">Add Station</Label>

        <div className="flex flex-wrap gap-2">
          {availableStations.map((station) => (
            <Button
              key={station}
              variant="outline"
              size="sm"
              onClick={() => addStation(station)}
              className="h-9 gap-1.5"
              style={{ minHeight: 44 }}
            >
              <Plus className="h-3.5 w-3.5" />
              {station}
            </Button>
          ))}

          {!showCustomInput && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCustomInput(true)}
              className="h-9 gap-1.5 border-dashed"
              style={{ minHeight: 44 }}
            >
              <Plus className="h-3.5 w-3.5" />
              Custom...
            </Button>
          )}
        </div>

        {/* Custom station input */}
        {showCustomInput && (
          <div className="flex gap-2">
            <Input
              value={customStation}
              onChange={(e) => setCustomStation(e.target.value)}
              placeholder="Station name"
              className="h-10 flex-1"
              style={{ minHeight: 44 }}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customStation.trim()) {
                  addStation(customStation)
                }
                if (e.key === 'Escape') {
                  setShowCustomInput(false)
                  setCustomStation('')
                }
              }}
            />
            <Button
              onClick={() => addStation(customStation)}
              disabled={!customStation.trim()}
              className="h-10"
              style={{ minHeight: 44 }}
            >
              Add
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setShowCustomInput(false)
                setCustomStation('')
              }}
              className="h-10"
              style={{ minHeight: 44 }}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
