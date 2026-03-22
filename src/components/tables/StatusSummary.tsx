'use client'

import { StatusBadge } from '@/components/shared/StatusBadge'

interface StatusSummaryProps {
  counts: Record<string, number>
}

const STATUS_ORDER = [
  'available',
  'seated',
  'ordered',
  'served',
  'check_presented',
  'dirty',
  'reserved',
  'needs_attention',
] as const

const STATUS_LABELS: Record<string, string> = {
  available: 'Available',
  seated: 'Seated',
  ordered: 'Ordered',
  served: 'Served',
  check_presented: 'Check',
  dirty: 'Dirty',
  reserved: 'Reserved',
  needs_attention: 'Attention',
}

export function StatusSummary({ counts }: StatusSummaryProps) {
  const visibleStatuses = STATUS_ORDER.filter((s) => (counts[s] ?? 0) > 0)

  if (visibleStatuses.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
      {visibleStatuses.map((status) => (
        <StatusBadge
          key={status}
          status={status}
          label={`${counts[status]} ${STATUS_LABELS[status]}`}
          className="flex-shrink-0"
        />
      ))}
    </div>
  )
}
