'use client'

import { type TicketPriority } from '@/lib/kds/priority-sort'
import { type RefireReasonCode, REFIRE_REASON_LABELS } from '@/stores/kds-store'

/**
 * KDS Priority Banner Component
 *
 * RE-FIRE: --color-kds-priority-refire, pulsing animation
 * RUSH: --color-kds-priority-rush, pulsing animation
 * VIP: --color-kds-priority-vip, subtle shimmer
 */

interface KdsPriorityBannerProps {
  priority: TicketPriority
  refireReason?: RefireReasonCode
  refireCount?: number
}

export function KdsPriorityBanner({ priority, refireReason, refireCount }: KdsPriorityBannerProps) {
  if (priority === 'normal') return null

  if (priority === 'refire') {
    return (
      <div className="flex items-center justify-center gap-2 bg-[var(--color-kds-priority-refire)] px-3 py-2 animate-pulse-attention">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 text-white"
        >
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
        </svg>
        <span className="text-subhead font-black uppercase tracking-wider text-white">
          RE-FIRE{refireReason ? `: ${REFIRE_REASON_LABELS[refireReason]}` : ''}
        </span>
        {(refireCount ?? 0) > 1 && (
          <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/30 text-caption-2 font-black text-white">
            {refireCount}
          </span>
        )}
      </div>
    )
  }

  if (priority === 'rush') {
    return (
      <div className="flex items-center justify-center bg-[var(--color-kds-priority-rush)] px-3 py-2 animate-pulse-attention">
        <span className="text-subhead font-black uppercase tracking-wider text-white">
          RUSH
        </span>
      </div>
    )
  }

  if (priority === 'vip') {
    return (
      <div className="flex items-center justify-center gap-2 bg-[var(--color-kds-priority-vip)] px-3 py-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-4 w-4 text-[var(--color-kds-priority-vip-fg)]"
        >
          <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
        <span className="text-subhead font-black uppercase tracking-wider text-[var(--color-kds-priority-vip-fg)]">
          VIP
        </span>
      </div>
    )
  }

  return null
}
