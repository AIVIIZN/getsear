'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Clock,
  CalendarDays,
  AlertTriangle,
  Ban,
  Infinity,
  Package,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { AVAILABILITY_TYPES, type AvailabilityType } from '@/lib/menu/price-resolver'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AvailabilityTabMenuItem {
  id: string
  is_86d: boolean
  is_running_low: boolean
  availability_type?: string
  available_dayparts?: string[] | null
  available_days?: number[] | null
  available_start_date?: string | null
  available_end_date?: string | null
  quantity_available?: number | null
  quantity_low_threshold?: number | null
}

export interface DaypartOption {
  id: string
  name: string
  start_time: string
  end_time: string
}

export interface AvailabilityTabProps {
  item: AvailabilityTabMenuItem
  locationId: string
  onSave: (data: AvailabilityTabSaveData) => void
}

export interface AvailabilityTabSaveData {
  is_86d: boolean
  is_running_low: boolean
  availability_type: AvailabilityType
  available_dayparts: string[] | null
  available_days: number[] | null
  available_start_date: string | null
  available_end_date: string | null
  quantity_available: number | null
  quantity_low_threshold: number | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun', full: 'Sunday' },
  { value: 1, label: 'Mon', full: 'Monday' },
  { value: 2, label: 'Tue', full: 'Tuesday' },
  { value: 3, label: 'Wed', full: 'Wednesday' },
  { value: 4, label: 'Thu', full: 'Thursday' },
  { value: 5, label: 'Fri', full: 'Friday' },
  { value: 6, label: 'Sat', full: 'Saturday' },
] as const

const AVAILABILITY_ICONS: Record<AvailabilityType, typeof Infinity> = {
  always: Infinity,
  specific_dayparts: Clock,
  specific_days: CalendarDays,
  date_range: CalendarDays,
  until_86d: Ban,
  quantity_limited: Package,
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AvailabilityTab({
  item,
  locationId,
  onSave,
}: AvailabilityTabProps) {
  const [is86d, setIs86d] = useState(item.is_86d)
  const [isRunningLow, setIsRunningLow] = useState(item.is_running_low)
  const [availabilityType, setAvailabilityType] = useState<AvailabilityType>(
    (item.availability_type as AvailabilityType) || 'always',
  )
  const [selectedDayparts, setSelectedDayparts] = useState<string[]>(
    item.available_dayparts ?? [],
  )
  const [selectedDays, setSelectedDays] = useState<number[]>(
    item.available_days ?? [0, 1, 2, 3, 4, 5, 6],
  )
  const [startDate, setStartDate] = useState(item.available_start_date ?? '')
  const [endDate, setEndDate] = useState(item.available_end_date ?? '')
  const [quantityAvailable, setQuantityAvailable] = useState<string>(
    item.quantity_available?.toString() ?? '',
  )
  const [lowThreshold, setLowThreshold] = useState<string>(
    item.quantity_low_threshold?.toString() ?? '',
  )
  const [dayparts, setDayparts] = useState<DaypartOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // -----------------------------------------------------------------------
  // Fetch dayparts
  // -----------------------------------------------------------------------

  const fetchDayparts = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/menu/dayparts?location_id=${locationId}`)
      const json = await res.json()
      setDayparts(
        (json.data ?? []).map(
          (d: { id: string; name: string; start_time: string; end_time: string }) => ({
            id: d.id,
            name: d.name,
            start_time: d.start_time,
            end_time: d.end_time,
          }),
        ),
      )
    } catch {
      // Silent fail
    } finally {
      setIsLoading(false)
    }
  }, [locationId])

  useEffect(() => {
    fetchDayparts()
  }, [fetchDayparts])

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  function toggle86() {
    setIs86d((prev) => !prev)
  }

  function toggleDaypart(daypartId: string) {
    setSelectedDayparts((prev) =>
      prev.includes(daypartId)
        ? prev.filter((id) => id !== daypartId)
        : [...prev, daypartId],
    )
  }

  function toggleDay(day: number) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    )
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const qtyVal =
        quantityAvailable !== '' ? parseInt(quantityAvailable, 10) : null
      const threshVal =
        lowThreshold !== '' ? parseInt(lowThreshold, 10) : null

      // Auto-86 if quantity hits 0
      const shouldAuto86 =
        availabilityType === 'quantity_limited' &&
        qtyVal !== null &&
        qtyVal <= 0

      onSave({
        is_86d: is86d || shouldAuto86,
        is_running_low:
          isRunningLow ||
          (qtyVal !== null && threshVal !== null && qtyVal <= threshVal && qtyVal > 0),
        availability_type: availabilityType,
        available_dayparts:
          availabilityType === 'specific_dayparts'
            ? selectedDayparts
            : null,
        available_days:
          availabilityType === 'specific_days' ? selectedDays : null,
        available_start_date:
          availabilityType === 'date_range' && startDate ? startDate : null,
        available_end_date:
          availabilityType === 'date_range' && endDate ? endDate : null,
        quantity_available: qtyVal,
        quantity_low_threshold: threshVal,
      })
    } finally {
      setIsSaving(false)
    }
  }

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  function formatTimeDisplay(time: string): string {
    const [h, m] = time.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading availability data...
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-4">
      {/* 86 Toggle — prominent at top */}
      <button
        type="button"
        onClick={toggle86}
        className={cn(
          'w-full flex items-center justify-between rounded-lg border p-4 transition-all min-h-[56px]',
          is86d
            ? 'border-red-300 bg-red-50 text-red-700'
            : 'border-border bg-background text-foreground hover:bg-muted/50',
        )}
      >
        <div className="flex items-center gap-3">
          <Ban
            className={cn(
              'size-5',
              is86d ? 'text-red-600' : 'text-muted-foreground',
            )}
          />
          <div className="text-left">
            <p className="text-sm font-semibold">86 This Item</p>
            <p className="text-xs text-muted-foreground">
              {is86d
                ? 'Item is currently unavailable on all terminals'
                : 'Mark as unavailable across all POS terminals'}
            </p>
          </div>
        </div>
        <div
          className={cn(
            'w-10 h-6 rounded-full transition-colors relative',
            is86d ? 'bg-red-600' : 'bg-gray-300',
          )}
        >
          <div
            className={cn(
              'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
              is86d ? 'translate-x-5' : 'translate-x-1',
            )}
          />
        </div>
      </button>

      {/* Running Low indicator */}
      {isRunningLow && !is86d && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <AlertTriangle className="size-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-700">
            Running Low
          </span>
        </div>
      )}

      {/* Availability Type Selector */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">
          Availability Schedule
        </label>
        <div className="grid grid-cols-2 gap-2">
          {AVAILABILITY_TYPES.map((at) => {
            const Icon = AVAILABILITY_ICONS[at.value]
            return (
              <button
                key={at.value}
                type="button"
                onClick={() => setAvailabilityType(at.value)}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-3 text-left transition-all min-h-[48px]',
                  availabilityType === at.value
                    ? 'border-[#F06B18] bg-[#F06B18]/10 text-[#F06B18]'
                    : 'border-border bg-background text-foreground hover:bg-muted',
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="text-sm font-medium">{at.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Conditional Fields */}

      {/* Specific Dayparts */}
      {availabilityType === 'specific_dayparts' && (
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">
            Available During
          </label>
          {dayparts.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border p-4 text-center">
              No dayparts configured.{' '}
              <span className="text-[#F06B18] font-medium">
                Configure dayparts first
              </span>{' '}
              from the menu toolbar.
            </p>
          ) : (
            <div className="space-y-2">
              {dayparts.map((dp) => {
                const isSelected = selectedDayparts.includes(dp.id)
                return (
                  <button
                    key={dp.id}
                    type="button"
                    onClick={() => toggleDaypart(dp.id)}
                    className={cn(
                      'w-full flex items-center justify-between rounded-lg border px-4 py-3 transition-all min-h-[48px]',
                      isSelected
                        ? 'border-[#F06B18] bg-[#F06B18]/5'
                        : 'border-border bg-background hover:bg-muted/50',
                    )}
                  >
                    <div>
                      <p className="text-sm font-medium text-left">
                        {dp.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatTimeDisplay(dp.start_time)} -{' '}
                        {formatTimeDisplay(dp.end_time)}
                      </p>
                    </div>
                    <div
                      className={cn(
                        'size-5 rounded border-2 flex items-center justify-center transition-colors',
                        isSelected
                          ? 'border-[#F06B18] bg-[#F06B18]'
                          : 'border-gray-300',
                      )}
                    >
                      {isSelected && (
                        <svg
                          className="size-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Specific Days */}
      {availabilityType === 'specific_days' && (
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">
            Available On
          </label>
          <div className="flex gap-2">
            {DAYS_OF_WEEK.map((day) => {
              const isSelected = selectedDays.includes(day.value)
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  title={day.full}
                  className={cn(
                    'flex-1 flex items-center justify-center rounded-lg border py-3 text-sm font-medium transition-all min-h-[48px]',
                    isSelected
                      ? 'border-[#F06B18] bg-[#F06B18]/10 text-[#F06B18]'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted',
                  )}
                >
                  {day.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Date Range */}
      {availabilityType === 'date_range' && (
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">
            Date Range
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Start Date
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10"
              />
            </div>
          </div>
          {startDate && endDate && endDate < startDate && (
            <p className="text-xs text-red-600">
              End date must be after start date.
            </p>
          )}
        </div>
      )}

      {/* Quantity Limited */}
      {availabilityType === 'quantity_limited' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Quantity Available
            </label>
            <Input
              type="number"
              value={quantityAvailable}
              onChange={(e) => setQuantityAvailable(e.target.value)}
              placeholder="e.g. 25"
              className="h-10"
              min={0}
            />
            <p className="text-xs text-muted-foreground">
              Item will be automatically 86'd when quantity reaches 0.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              "Running Low" Threshold
            </label>
            <Input
              type="number"
              value={lowThreshold}
              onChange={(e) => setLowThreshold(e.target.value)}
              placeholder="e.g. 5"
              className="h-10"
              min={0}
            />
            <p className="text-xs text-muted-foreground">
              Shows "LOW" badge on POS when quantity drops to this number.
            </p>
          </div>

          {/* Quantity status */}
          {quantityAvailable !== '' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              {parseInt(quantityAvailable, 10) <= 0 ? (
                <Badge variant="destructive">Auto-86'd (0 remaining)</Badge>
              ) : lowThreshold !== '' &&
                parseInt(quantityAvailable, 10) <=
                  parseInt(lowThreshold, 10) ? (
                <Badge className="bg-amber-100 text-amber-700 border-amber-300">
                  Running Low ({quantityAvailable} remaining)
                </Badge>
              ) : (
                <Badge variant="secondary">
                  {quantityAvailable} remaining
                </Badge>
              )}
            </div>
          )}
        </div>
      )}

      {/* Until 86'd */}
      {availabilityType === 'until_86d' && (
        <div className="rounded-lg border border-dashed border-border p-4 text-center">
          <Ban className="size-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Item will remain available until manually 86'd using the toggle
            above or via the KDS 86 button.
          </p>
        </div>
      )}

      {/* Always */}
      {availabilityType === 'always' && (
        <div className="rounded-lg border border-dashed border-border p-4 text-center">
          <Infinity className="size-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Item is available at all times, on all days, in all sections.
          </p>
        </div>
      )}

      {/* Save */}
      <Button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full h-12 bg-[#F06B18] hover:bg-[#E05A0D] text-white font-medium"
      >
        {isSaving ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Saving...
          </>
        ) : (
          'Save Availability'
        )}
      </Button>
    </div>
  )
}
