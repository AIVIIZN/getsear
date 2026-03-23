'use client'

import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'

export type DatePreset = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom'

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
      return { from: lastWeekStart.toISOString().split('T')[0], to: lastWeekEnd.toISOString().split('T')[0] }
    }
    case 'this_month': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: monthStart.toISOString().split('T')[0], to: today }
    }
    case 'last_month': {
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: lastMonthStart.toISOString().split('T')[0], to: lastMonthEnd.toISOString().split('T')[0] }
    }
    case 'custom':
      return { from: today, to: today }
  }
}

const PRESETS: { label: string; value: DatePreset }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Week', value: 'this_week' },
  { label: 'Last Week', value: 'last_week' },
  { label: 'This Month', value: 'this_month' },
  { label: 'Last Month', value: 'last_month' },
  { label: 'Custom Range', value: 'custom' },
]

export function DateRangePicker({ onRangeChange, initialPreset = 'today' }: DateRangePickerProps) {
  const [activePreset, setActivePreset] = useState<DatePreset>(initialPreset)
  const [showCustom, setShowCustom] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handlePresetClick = (preset: DatePreset) => {
    setActivePreset(preset)
    setDropdownOpen(false)
    if (preset === 'custom') {
      setShowCustom(true)
      return
    }
    setShowCustom(false)
    const range = getDateRange(preset)
    onRangeChange(preset, range.from, range.to)
  }

  const handleCustomApply = () => {
    if (customFrom && customTo) {
      onRangeChange('custom', customFrom, customTo)
      setShowCustom(false)
    }
  }

  const activeLabel = PRESETS.find((p) => p.value === activePreset)?.label ?? 'Today'

  return (
    <div className="flex items-center gap-2">
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium hover:bg-[var(--secondary)] transition-colors"
          style={{ height: 44, minWidth: 140 }}
        >
          <Calendar className="h-4 w-4 text-[var(--muted-foreground)]" />
          {activeLabel}
          <ChevronDown className="h-3.5 w-3.5 text-[var(--muted-foreground)] ml-auto" />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-xl border border-[var(--border)] bg-white shadow-warm-lg overflow-hidden">
            {PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => handlePresetClick(preset.value)}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--secondary)] transition-colors ${
                  activePreset === preset.value ? 'bg-[var(--accent)] text-[var(--primary)] font-medium' : 'text-[var(--foreground)]'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="rounded-xl border border-[var(--border)] bg-white px-3 text-sm"
            style={{ height: 44 }}
          />
          <span className="text-sm text-[var(--muted-foreground)]">to</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="rounded-xl border border-[var(--border)] bg-white px-3 text-sm"
            style={{ height: 44 }}
          />
          <button
            type="button"
            onClick={handleCustomApply}
            className="rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            style={{ height: 44 }}
          >
            Apply
          </button>
        </div>
      )}
    </div>
  )
}
