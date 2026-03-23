'use client'

import { AlertTriangle } from 'lucide-react'

interface EmployeeFlagBadgeProps {
  rate: number // multiplier vs average (e.g., 2.3x)
}

export function EmployeeFlagBadge({ rate }: EmployeeFlagBadgeProps) {
  if (rate <= 2) return null

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-[var(--error)]">
      <AlertTriangle className="h-3 w-3" />
      {rate.toFixed(1)}x avg
    </span>
  )
}
