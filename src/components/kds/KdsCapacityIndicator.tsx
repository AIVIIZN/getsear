'use client'

import { useKdsStore } from '@/stores/kds-store'
import { useShallow } from 'zustand/react/shallow'
import { useMemo } from 'react'

/**
 * Kitchen Capacity Indicator
 *
 * Live badge showing: "{active_tickets} tickets | {total_items} items | {utilization}%"
 * Color-coded: green (<60%), yellow (60-80%), red (>80%)
 */
export function KdsCapacityIndicator() {
  // Read tickets array via shallow selector — stable reference
  const tickets = useKdsStore(useShallow((s) => s.tickets))

  // Compute capacity from tickets directly — no store getter calls
  const { activeTickets, totalItems, utilization } = useMemo(() => {
    let itemCount = 0
    const active = tickets.filter(t => {
      const items = t.items ?? []
      const pendingItems = items.filter(i => i.status !== 'voided' && !i.is_bumped)
      itemCount += pendingItems.length
      return pendingItems.length > 0
    })
    const maxTickets = 30 // reasonable max for capacity calc
    return {
      activeTickets: active.length,
      totalItems: itemCount,
      utilization: Math.round((active.length / maxTickets) * 100),
    }
  }, [tickets])

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
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${colorClass}`}>
      <div className={`h-2 w-2 rounded-full ${dotColor} animate-pulse`} />
      <span className="text-[11px] font-semibold tabular-nums">
        {activeTickets} tickets · {totalItems} items · {utilization}%
      </span>
    </div>
  )
}
