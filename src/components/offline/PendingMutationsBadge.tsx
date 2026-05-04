'use client'

import { useState } from 'react'
import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSyncQueue } from '@/hooks/use-sync-queue'
import { PendingMutationsDrawer } from './PendingMutationsDrawer'

/**
 * Counter pill showing number of pending offline mutations.
 * Renders nothing when there are zero pending. Click opens the drawer.
 */
export function PendingMutationsBadge() {
  const { pendingCount, failedEntries } = useSyncQueue()
  const [open, setOpen] = useState(false)

  const totalCount = pendingCount + failedEntries.length
  if (totalCount <= 0) return null

  const hasFailed = failedEntries.length > 0

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${totalCount} pending offline operation${totalCount === 1 ? '' : 's'} — open list`}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border transition-colors',
          'min-h-[44px] min-w-[44px] px-3 py-1.5',
          'sm:min-h-[32px] sm:min-w-0 sm:px-2.5 sm:py-1',
          'text-[13px] font-medium tabular-nums',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
          hasFailed
            ? 'border-[#EF4444]/30 bg-[#EF4444]/10 text-[#991B1B] hover:bg-[#EF4444]/15 active:bg-[#EF4444]/20 focus-visible:ring-[#EF4444]/50'
            : 'border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#92400E] hover:bg-[#F59E0B]/15 active:bg-[#F59E0B]/20 focus-visible:ring-[#F59E0B]/50'
        )}
      >
        <Inbox className="h-[14px] w-[14px] shrink-0" strokeWidth={2} />
        <span className="leading-none">{totalCount > 99 ? '99+' : totalCount}</span>
        <span className="hidden sm:inline leading-none">pending</span>
      </button>

      <PendingMutationsDrawer open={open} onOpenChange={setOpen} />
    </>
  )
}
