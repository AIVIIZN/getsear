import { Badge } from '@/components/ui/badge'

const STATUS_STYLES: Record<string, string> = {
  // Order statuses
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  open: 'bg-blue-50 text-blue-700 border-blue-200',
  fired: 'bg-orange-50 text-orange-700 border-orange-200',
  ready: 'bg-green-50 text-green-700 border-green-200',
  served: 'bg-teal-50 text-teal-700 border-teal-200',
  closed: 'bg-gray-50 text-gray-500 border-gray-200',
  voided: 'bg-red-50 text-red-700 border-red-200',

  // Table statuses
  available: 'bg-green-50 text-green-700 border-green-200',
  seated: 'bg-blue-50 text-blue-700 border-blue-200',
  ordered: 'bg-purple-50 text-purple-700 border-purple-200',
  check_presented: 'bg-amber-50 text-amber-700 border-amber-200',
  dirty: 'bg-gray-100 text-gray-500 border-gray-200',
  reserved: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  needs_attention: 'bg-red-50 text-red-700 border-red-200',

  // Payment statuses
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  authorized: 'bg-blue-50 text-blue-700 border-blue-200',
  captured: 'bg-green-50 text-green-700 border-green-200',
  settled: 'bg-gray-50 text-gray-600 border-gray-200',
  declined: 'bg-red-50 text-red-700 border-red-200',
  refunded: 'bg-orange-50 text-orange-700 border-orange-200',

  // Generic
  active: 'bg-green-50 text-green-700 border-green-200',
  inactive: 'bg-gray-100 text-gray-500 border-gray-200',
}

interface StatusBadgeProps {
  status: string
  label?: string
  className?: string
}

export function StatusBadge({ status, label, className = '' }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700 border-gray-200'
  const displayLabel = label ?? status.replace(/_/g, ' ')

  return (
    <Badge
      variant="outline"
      className={`capitalize text-xs font-medium ${style} ${className}`}
    >
      {displayLabel}
    </Badge>
  )
}
