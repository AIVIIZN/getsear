'use client'

import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui-v2/data/Badge'

interface EmployeeFlagBadgeProps {
  rate: number // multiplier vs average (e.g., 2.3x)
}

export function EmployeeFlagBadge({ rate }: EmployeeFlagBadgeProps) {
  if (rate <= 2) return null

  return (
    <Badge variant="danger" shape="pill">
      <AlertTriangle className="h-3 w-3" />
      {rate.toFixed(1)}x avg
    </Badge>
  )
}
