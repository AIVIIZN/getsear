'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, Clock, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ForecastData {
  totalScheduledHours: number
  projectedLaborCostCents: number
  projectedRevenueCents: number
  laborPercentage: number
  thresholdColor: 'green' | 'amber' | 'red'
}

interface LaborForecastBarProps {
  weekStart: string
}

const COLOR_MAP = {
  green: { bg: 'bg-green-100', text: 'text-green-700', bar: 'bg-green-500' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-700', bar: 'bg-amber-500' },
  red: { bg: 'bg-red-100', text: 'text-red-700', bar: 'bg-red-500' },
}

export function LaborForecastBar({ weekStart }: LaborForecastBarProps) {
  const [data, setData] = useState<ForecastData | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/staff/labor-forecast?location_id=default&week_start=${weekStart}`)
        if (res.ok) {
          const json = await res.json()
          setData(json.data)
        }
      } catch { /* silent */ }
    }
    load()
  }, [weekStart])

  if (!data) return null

  const colors = COLOR_MAP[data.thresholdColor]
  const barWidth = Math.min(100, data.laborPercentage)

  return (
    <div className={cn('rounded-lg border p-3', colors.bg)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Hours:</span>
            <span className="text-xs font-semibold">{data.totalScheduledHours.toFixed(0)}h</span>
          </div>
          <div className="flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Labor Cost:</span>
            <span className="text-xs font-semibold font-mono">
              ${(data.projectedLaborCostCents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Revenue:</span>
            <span className="text-xs font-semibold font-mono">
              ${(data.projectedRevenueCents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </span>
          </div>
        </div>
        <div className={cn('text-sm font-bold', colors.text)}>
          {data.laborPercentage.toFixed(1)}% Labor
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-white/50 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', colors.bar)}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-muted-foreground">0%</span>
        <span className="text-[10px] text-muted-foreground">28%</span>
        <span className="text-[10px] text-muted-foreground">32%</span>
        <span className="text-[10px] text-muted-foreground">50%</span>
      </div>
    </div>
  )
}
