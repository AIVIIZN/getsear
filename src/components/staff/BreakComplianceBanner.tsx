'use client'

import { useState } from 'react'
import { ShieldAlert, ChevronDown, ChevronUp, Coffee } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ComplianceAlert {
  userId: string
  userName: string
  type: 'pre_alert' | 'violation'
  breakType: 'meal' | 'rest'
  message: string
  minutesUntilDeadline: number
}

interface BreakComplianceBannerProps {
  alerts: ComplianceAlert[]
}

export function BreakComplianceBanner({ alerts }: BreakComplianceBannerProps) {
  const [expanded, setExpanded] = useState(false)

  if (alerts.length === 0) return null

  const violations = alerts.filter((a) => a.type === 'violation')
  const preAlerts = alerts.filter((a) => a.type === 'pre_alert')
  const hasViolations = violations.length > 0

  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        hasViolations ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
      )}
    >
      <button
        type="button"
        className="flex items-center justify-between w-full text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <ShieldAlert
            className={cn(
              'h-4 w-4',
              hasViolations ? 'text-red-600' : 'text-amber-600'
            )}
          />
          <span
            className={cn(
              'text-sm font-medium',
              hasViolations ? 'text-red-800' : 'text-amber-800'
            )}
          >
            {hasViolations && `${violations.length} break violation${violations.length > 1 ? 's' : ''}`}
            {hasViolations && preAlerts.length > 0 && ' — '}
            {preAlerts.length > 0 &&
              `${preAlerts.length} break${preAlerts.length > 1 ? 's' : ''} due soon`}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {violations.map((a, i) => (
            <div key={`v-${i}`} className="flex items-start gap-2 text-sm">
              <Coffee className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
              <span className="text-red-700">{a.message}</span>
            </div>
          ))}
          {preAlerts.map((a, i) => (
            <div key={`p-${i}`} className="flex items-start gap-2 text-sm">
              <Coffee className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
              <span className="text-amber-700">{a.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
