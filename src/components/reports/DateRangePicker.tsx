'use client'

/**
 * DateRangePicker — V6 ui-v2 build.
 *
 * Preset menu via ui-v2 Select; custom range via ui-v2 Text inputs of
 * type="date". Same height + token-driven styling as the rest of the
 * back-office filter bars.
 */

import { useState, useEffect, useRef } from 'react'
import { Calendar } from 'lucide-react'
import { Select } from '@/components/ui-v2/inputs/Select'
import { Text } from '@/components/ui-v2/inputs/Text'
import { Button } from '@/components/ui-v2/Button'

export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'custom'

interface DateRangePickerProps {
  onRangeChange: (preset: DatePreset, dateFrom: string, dateTo: string) => void
  initialPreset?: DatePreset
}

function getDateRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date()
  const today = now.toISOString().split('T')[0]

  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case 'yesterday': {
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      const yd = yesterday.toISOString().split('T')[0]
      return { from: yd, to: yd }
    }
    case 'this_week': {
      const weekStart = new Date(now)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      return { from: weekStart.toISOString().split('T')[0], to: today }
    }
    case 'last_week': {
      const lastWeekEnd = new Date(now)
      lastWeekEnd.setDate(lastWeekEnd.getDate() - lastWeekEnd.getDay() - 1)
      const lastWeekStart = new Date(lastWeekEnd)
      lastWeekStart.setDate(lastWeekStart.getDate() - 6)
      return {
        from: lastWeekStart.toISOString().split('T')[0],
        to: lastWeekEnd.toISOString().split('T')[0],
      }
    }
    case 'this_month': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: monthStart.toISOString().split('T')[0], to: today }
    }
    case 'last_month': {
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
      return {
        from: lastMonthStart.toISOString().split('T')[0],
        to: lastMonthEnd.toISOString().split('T')[0],
      }
    }
    case 'custom':
      return { from: today, to: today }
  }
}

const PRESET_OPTIONS: { value: DatePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'custom', label: 'Custom Range' },
]

export function DateRangePicker({
  onRangeChange,
  initialPreset = 'today',
}: DateRangePickerProps) {
  const [activePreset, setActivePreset] = useState<DatePreset>(initialPreset)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  // Keep onRangeChange in a ref so the user-supplied callback doesn't trigger
  // re-fires when the parent re-renders with an inline arrow function.
  const onRangeChangeRef = useRef(onRangeChange)
  useEffect(() => {
    onRangeChangeRef.current = onRangeChange
  }, [onRangeChange])

  const handlePresetChange = (preset: DatePreset) => {
    setActivePreset(preset)
    if (preset === 'custom') return
    const range = getDateRange(preset)
    onRangeChangeRef.current(preset, range.from, range.to)
  }

  const handleCustomApply = () => {
    if (customFrom && customTo) {
      onRangeChangeRef.current('custom', customFrom, customTo)
    }
  }

  return (
    <div className="flex items-center gap-[var(--space-2)]">
      <div className="min-w-[160px]">
        <Select<DatePreset>
          options={PRESET_OPTIONS}
          value={activePreset}
          onChange={handlePresetChange}
          ariaLabel="Date range preset"
        />
      </div>

      {activePreset === 'custom' && (
        <div className="flex items-center gap-[var(--space-2)]">
          <Text
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            aria-label="Custom range from"
            leadingIcon={<Calendar className="h-4 w-4" />}
          />
          <span className="text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
            to
          </span>
          <Text
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            aria-label="Custom range to"
            leadingIcon={<Calendar className="h-4 w-4" />}
          />
          <Button
            size="md"
            variant="primary"
            onClick={handleCustomApply}
            disabled={!customFrom || !customTo}
          >
            Apply
          </Button>
        </div>
      )}
    </div>
  )
}
