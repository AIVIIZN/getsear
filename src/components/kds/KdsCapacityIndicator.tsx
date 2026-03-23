'use client'

import { useKdsStore } from '@/stores/kds-store'

/**
 * Kitchen Capacity Indicator
 *
 * Live badge showing: "{active_tickets} tickets | {total_items} items | {utilization}%"
 * Color-coded: green (<60%), yellow (60-80%), red (>80%)
 * Updates in realtime as the store changes.
 */
export function KdsCapacityIndicator() {
  const capacity = useKdsStore((s) => s.actions.getCapacity())

  const { activeTickets, totalItems, utilization } = capacity

  let colorClass: string
  let dotColor: string
  if (utilization >= 80) {
    colorClass = 'bg-red-900/60 text-red-300 border-red-600/40'
    dotColor = 'bg-red-400'
  } else if (utilization >= 60) {
    colorClass = 'bg-yellow-900/60 text-yellow-300 border-yellow-600/40'
    dotColor = 'bg-yellow-400'
  } else {
    colorClass = 'bg-green-900/60 text-green-300 border-green-600/40'
    dotColor = 'bg-green-400'
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-caption-1 font-semibold tabular-nums ${colorClass}`}
    >
      <span className={`h-2 w-2 rounded-full ${dotColor}`} />
      <span>{activeTickets} ticket{activeTickets !== 1 ? 's' : ''}</span>
      <span className="opacity-40">|</span>
      <span>{totalItems} item{totalItems !== 1 ? 's' : ''}</span>
      <span className="opacity-40">|</span>
      <span>{utilization}%</span>
    </div>
  )
}
