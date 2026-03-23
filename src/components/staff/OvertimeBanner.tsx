'use client'

import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OvertimeAlert {
  userId: string
  name: string
  weeklyTotalHours: number
  hoursUntilOt: number
  isInOvertime: boolean
}

interface OvertimeBannerProps {
  alerts: OvertimeAlert[]
}

export function OvertimeBanner({ alerts }: OvertimeBannerProps) {
  const [expanded, setExpanded] = useState(false)

  if (alerts.length === 0) return null

  const inOt = alerts.filter((a) => a.isInOvertime)
  const approaching = alerts.filter((a) => !a.isInOvertime)

  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        inOt.length > 0
          ? 'bg-red-50 border-red-200'
          : 'bg-amber-50 border-amber-200'
      )}
    >
      <button
        type="button"
        className="flex items-center justify-between w-full text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle
            className={cn(
              'h-4 w-4',
              inOt.length > 0 ? 'text-red-600' : 'text-amber-600'
            )}
          />
          <span
            className={cn(
              'text-sm font-medium',
              inOt.length > 0 ? 'text-red-800' : 'text-amber-800'
            )}
          >
            {inOt.length > 0 && `${inOt.length} employee${inOt.length > 1 ? 's' : ''} in overtime`}
            {inOt.length > 0 && approaching.length > 0 && ' — '}
            {approaching.length > 0 &&
              `${approaching.length} approaching overtime this week`}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-1.5">
          {inOt.map((a) => (
            <div key={a.userId} className="flex items-center justify-between text-sm">
              <span className="font-medium text-red-700">{a.name}</span>
              <span className="text-red-600 font-mono text-xs">
                {a.weeklyTotalHours.toFixed(1)}h this week (IN OT)
              </span>
            </div>
          ))}
          {approaching.map((a) => (
            <div key={a.userId} className="flex items-center justify-between text-sm">
              <span className="font-medium text-amber-700">{a.name}</span>
              <span className="text-amber-600 font-mono text-xs">
                {a.weeklyTotalHours.toFixed(1)}h — OT in {a.hoursUntilOt.toFixed(1)}h
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
