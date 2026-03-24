'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Clock,
  Plus,
  Pencil,
  Trash2,
  Eye,
  X,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { centsToDollars, dollarsToCents } from '@/lib/menu/price-resolver'
import type { Daypart } from '@/lib/menu/daypart-engine'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DaypartConfigProps {
  locationId: string
  orgId: string
  onClose?: () => void
}

interface ActivePricePreview {
  itemId: string
  itemName: string
  effectivePriceCents: number
  source: string
  priceLevelName: string | null
  daypartName: string | null
}

interface DaypartFormData {
  name: string
  start_time: string
  end_time: string
  days: number[]
  sections: string[]
  is_active: boolean
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun', full: 'Sunday' },
  { value: 1, label: 'Mon', full: 'Monday' },
  { value: 2, label: 'Tue', full: 'Tuesday' },
  { value: 3, label: 'Wed', full: 'Wednesday' },
  { value: 4, label: 'Thu', full: 'Thursday' },
  { value: 5, label: 'Fri', full: 'Friday' },
  { value: 6, label: 'Sat', full: 'Saturday' },
] as const

const SECTIONS = ['Bar', 'Dining', 'Patio', 'Lounge', 'Private Dining'] as const

const EMPTY_FORM: DaypartFormData = {
  name: '',
  start_time: '',
  end_time: '',
  days: [0, 1, 2, 3, 4, 5, 6],
  sections: [],
  is_active: true,
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DaypartConfig({ locationId, orgId, onClose }: DaypartConfigProps) {
  const [dayparts, setDayparts] = useState<Daypart[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<DaypartFormData>(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)

  // Preview state
  const [showPreview, setShowPreview] = useState(false)
  const [previewData, setPreviewData] = useState<ActivePricePreview[]>([])
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // -----------------------------------------------------------------------
  // Fetch
  // -----------------------------------------------------------------------

  const fetchDayparts = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/menu/dayparts?location_id=${locationId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to fetch')
      setDayparts(json.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dayparts')
    } finally {
      setIsLoading(false)
    }
  }, [locationId])

  useEffect(() => {
    fetchDayparts()
  }, [fetchDayparts])

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  function formatTimeDisplay(time: string): string {
    const [h, m] = time.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`
  }

  function daysLabel(days: number[]): string {
    if (days.length === 7) return 'Every day'
    if (
      days.length === 5 &&
      [1, 2, 3, 4, 5].every((d) => days.includes(d))
    )
      return 'Weekdays'
    if (
      days.length === 2 &&
      days.includes(0) &&
      days.includes(6)
    )
      return 'Weekends'
    return days
      .sort((a, b) => a - b)
      .map((d) => DAYS_OF_WEEK[d].label)
      .join(', ')
  }

  // -----------------------------------------------------------------------
  // Form actions
  // -----------------------------------------------------------------------

  function openNewForm() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setIsFormOpen(true)
  }

  function openEditForm(dp: Daypart) {
    setForm({
      name: dp.name,
      start_time: dp.start_time,
      end_time: dp.end_time,
      days: [...dp.days],
      sections: [...dp.sections],
      is_active: dp.is_active,
    })
    setEditingId(dp.id)
    setIsFormOpen(true)
  }

  function closeForm() {
    setIsFormOpen(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  function toggleFormDay(day: number) {
    setForm((prev) => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter((d) => d !== day)
        : [...prev.days, day],
    }))
  }

  function toggleFormSection(section: string) {
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.includes(section)
        ? prev.sections.filter((s) => s !== section)
        : [...prev.sections, section],
    }))
  }

  async function handleSaveForm() {
    if (!form.name.trim() || !form.start_time || !form.end_time) return

    setIsSaving(true)
    setError(null)
    try {
      const url = editingId
        ? `/api/menu/dayparts/${editingId}`
        : '/api/menu/dayparts'
      const method = editingId ? 'PATCH' : 'POST'

      const payload = editingId
        ? form
        : { ...form, location_id: locationId }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save')

      closeForm()
      await fetchDayparts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save daypart')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setError(null)
    try {
      const res = await fetch(`/api/menu/dayparts/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to delete')
      setDeletingId(null)
      await fetchDayparts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete daypart')
      setDeletingId(null)
    }
  }

  // -----------------------------------------------------------------------
  // Preview
  // -----------------------------------------------------------------------

  async function loadPreview() {
    setIsPreviewLoading(true)
    setShowPreview(true)
    try {
      const res = await fetch(
        `/api/menu/dayparts/active?location_id=${locationId}`,
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to fetch')

      setPreviewData(
        (json.data?.item_prices ?? []).map(
          (p: {
            itemId: string
            itemName: string
            effectivePriceCents: number
            source: string
            priceLevelName: string | null
            daypartName: string | null
          }) => ({
            itemId: p.itemId,
            itemName: p.itemName,
            effectivePriceCents: p.effectivePriceCents,
            source: p.source,
            priceLevelName: p.priceLevelName,
            daypartName: p.daypartName,
          }),
        ),
      )
    } catch {
      setPreviewData([])
    } finally {
      setIsPreviewLoading(false)
    }
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Clock className="size-5 text-[#007AFF]" />
          <h2 className="text-lg font-semibold">Daypart Configuration</h2>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3">
            <AlertCircle className="size-4 text-red-600 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button onClick={openNewForm} className="bg-[#007AFF] hover:bg-[#E05A0D] text-white gap-1.5">
            <Plus className="size-4" />
            Add Daypart
          </Button>
          <Button variant="outline" onClick={loadPreview} className="gap-1.5">
            <Eye className="size-4" />
            Active Prices Now
          </Button>
        </div>

        {/* Priority Legend */}
        <div className="rounded-lg border border-border p-3 bg-muted/30">
          <p className="text-xs font-medium text-muted-foreground mb-1.5">
            Pricing Priority
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[
              'Manual Override',
              'Promotion',
              'Daypart',
              'Menu-Specific',
              'Base Price',
            ].map((label, i) => (
              <Badge
                key={label}
                variant="outline"
                className="text-[10px] font-normal"
              >
                {i + 1}. {label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Daypart List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : dayparts.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="size-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No dayparts configured yet.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Add dayparts to enable time-based pricing.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {dayparts.map((dp) => (
              <div
                key={dp.id}
                className={cn(
                  'rounded-lg border border-border p-4 transition-all',
                  dp.is_active
                    ? 'bg-background'
                    : 'bg-muted/50 opacity-60',
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{dp.name}</h3>
                      {!dp.is_active && (
                        <Badge variant="secondary" className="text-[10px]">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatTimeDisplay(dp.start_time)} -{' '}
                      {formatTimeDisplay(dp.end_time)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {daysLabel(dp.days)}
                    </p>
                    {dp.sections.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {dp.sections.map((s) => (
                          <Badge
                            key={s}
                            variant="outline"
                            className="text-[10px]"
                          >
                            {s}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {dp.sections.length === 0 && (
                      <p className="text-xs text-muted-foreground/60">
                        All sections
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEditForm(dp)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    {deletingId === dp.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="destructive"
                          size="xs"
                          onClick={() => handleDelete(dp.id)}
                        >
                          Confirm
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setDeletingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeletingId(dp.id)}
                      >
                        <Trash2 className="size-3.5 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create/Edit Form */}
        {isFormOpen && (
          <div className="rounded-lg border-2 border-[#007AFF]/30 bg-[#007AFF]/5 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {editingId ? 'Edit Daypart' : 'New Daypart'}
              </h3>
              <Button variant="ghost" size="icon-xs" onClick={closeForm}>
                <X className="size-3.5" />
              </Button>
            </div>

            {/* Name */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Name
              </label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Happy Hour"
                className="h-10"
              />
            </div>

            {/* Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Start Time
                </label>
                <Input
                  type="time"
                  value={form.start_time}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, start_time: e.target.value }))
                  }
                  className="h-10"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  End Time
                </label>
                <Input
                  type="time"
                  value={form.end_time}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, end_time: e.target.value }))
                  }
                  className="h-10"
                />
              </div>
            </div>

            {/* Days */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Days of Week
              </label>
              <div className="flex gap-1.5">
                {DAYS_OF_WEEK.map((day) => {
                  const isSelected = form.days.includes(day.value)
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleFormDay(day.value)}
                      title={day.full}
                      className={cn(
                        'flex-1 rounded-md border py-2 text-xs font-medium transition-all min-h-[40px]',
                        isSelected
                          ? 'border-[#007AFF] bg-[#007AFF] text-white'
                          : 'border-border bg-background text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {day.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Sections */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Sections (leave empty for all)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {SECTIONS.map((section) => {
                  const isSelected = form.sections.includes(section)
                  return (
                    <button
                      key={section}
                      type="button"
                      onClick={() => toggleFormSection(section)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs font-medium transition-all min-h-[32px]',
                        isSelected
                          ? 'border-[#007AFF] bg-[#007AFF]/10 text-[#007AFF]'
                          : 'border-border bg-background text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {section}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Save */}
            <Button
              onClick={handleSaveForm}
              disabled={
                isSaving ||
                !form.name.trim() ||
                !form.start_time ||
                !form.end_time ||
                form.days.length === 0
              }
              className="w-full h-10 bg-[#007AFF] hover:bg-[#E05A0D] text-white"
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : editingId ? (
                'Update Daypart'
              ) : (
                'Create Daypart'
              )}
            </Button>
          </div>
        )}

        {/* Active Prices Preview */}
        {showPreview && (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="flex items-center justify-between bg-muted/50 px-4 py-2">
              <h3 className="text-sm font-semibold">
                Active Prices Right Now
              </h3>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setShowPreview(false)}
              >
                <X className="size-3.5" />
              </Button>
            </div>

            {isPreviewLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : previewData.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">
                  No active menu items found.
                </p>
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b border-border">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Item</th>
                      <th className="text-right px-4 py-2 font-medium">
                        Price
                      </th>
                      <th className="text-left px-4 py-2 font-medium">
                        Source
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((item) => (
                      <tr
                        key={item.itemId}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-4 py-2 font-medium">
                          {item.itemName}
                        </td>
                        <td className="px-4 py-2 text-right font-mono">
                          ${centsToDollars(item.effectivePriceCents)}
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant="outline" className="text-[10px]">
                            {item.source.replace(/_/g, ' ')}
                          </Badge>
                          {item.daypartName && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({item.daypartName})
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
