'use client'

import { useState } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'

export type DatePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom'

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
    case 'this_month': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: monthStart.toISOString().split('T')[0], to: today }
    }
    case 'custom':
      return { from: today, to: today }
  }
}

const PRESETS: { label: string; value: DatePreset }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Week', value: 'this_week' },
  { label: 'This Month', value: 'this_month' },
  { label: 'Custom', value: 'custom' },
]

export function DateRangePicker({ onRangeChange, initialPreset = 'today' }: DateRangePickerProps) {
  const [activePreset, setActivePreset] = useState<DatePreset>(initialPreset)
  const [showCustom, setShowCustom] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)

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
      <div className="relative">
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium hover:bg-[var(--secondary)] transition-colors"
        >
          <Calendar className="h-4 w-4 text-[var(--muted-foreground)]" />
          {activeLabel}
          <ChevronDown className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-lg border border-[var(--border)] bg-white shadow-warm-lg">
            {PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => handlePresetClick(preset.value)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--secondary)] first:rounded-t-lg last:rounded-b-lg ${
                  activePreset === preset.value ? 'bg-[var(--accent)] text-[var(--accent-foreground)] font-medium' : ''
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
            className="rounded-lg border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
          />
          <span className="text-sm text-[var(--muted-foreground)]">to</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={handleCustomApply}
            className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  )
}
