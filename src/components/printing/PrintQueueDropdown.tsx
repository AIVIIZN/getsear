'use client'

import { useEffect, useRef } from 'react'
import { Printer, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { usePrintQueueStore } from '@/stores/print-queue-store'
import { PrintQueueItem } from '@/components/printing/PrintQueueItem'

// ---------------------------------------------------------------------------
// Badge component for the topbar icon
// ---------------------------------------------------------------------------

export function PrintQueueBadge() {
  const pendingCount = usePrintQueueStore((s) => s.pendingCount)
  const failedCount = usePrintQueueStore((s) => s.failedCount)
  const toggleDropdown = usePrintQueueStore((s) => s.toggleDropdown)
  const init = usePrintQueueStore((s) => s.init)

  useEffect(() => {
    const cleanup = init()
    return cleanup
  }, [init])

  const totalCount = pendingCount + failedCount
  const hasFailures = failedCount > 0

  return (
    <button
      onClick={toggleDropdown}
      className={cn(
        'relative flex items-center justify-center rounded-[8px]',
        'text-[#8E8E93] hover:bg-black/[0.04] active:bg-black/[0.06]',
        'transition-colors duration-100'
      )}
      style={{ width: 36, height: 36 }}
      aria-label={`Print queue: ${totalCount} jobs`}
    >
      <Printer className="h-[20px] w-[20px]" strokeWidth={1.8} />

      {/* Badge */}
      {totalCount > 0 && (
        <span
          className={cn(
            'absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-semibold text-white',
            hasFailures ? 'bg-[#FF3B30]' : 'bg-[#007AFF]'
          )}
        >
          {totalCount > 99 ? '99+' : totalCount}
        </span>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Dropdown panel
// ---------------------------------------------------------------------------

export function PrintQueueDropdown() {
  const isOpen = usePrintQueueStore((s) => s.isDropdownOpen)
  const setOpen = usePrintQueueStore((s) => s.setDropdownOpen)
  const pendingJobs = usePrintQueueStore((s) => s.pendingJobs)
  const failedJobs = usePrintQueueStore((s) => s.failedJobs)
  const recentCompletedJobs = usePrintQueueStore((s) => s.recentCompletedJobs)
  const retryJob = usePrintQueueStore((s) => s.retryJob)
  const cancelJob = usePrintQueueStore((s) => s.cancelJob)
  const clearCompleted = usePrintQueueStore((s) => s.clearCompleted)

  const panelRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    // Delay to prevent the toggle click from immediately closing
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, setOpen])

  // Close on escape
  useEffect(() => {
    if (!isOpen) return

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, setOpen])

  if (!isOpen) return null

  const isEmpty =
    pendingJobs.length === 0 &&
    failedJobs.length === 0 &&
    recentCompletedJobs.length === 0

  return (
    <div
      ref={panelRef}
      className={cn(
        'absolute right-0 top-full z-50 mt-1 w-[380px] overflow-hidden rounded-xl bg-white',
        'ring-1 ring-black/[0.08]'
      )}
      style={{
        boxShadow:
          '0 10px 40px -4px rgba(40, 35, 32, 0.12), 0 4px 16px -2px rgba(40, 35, 32, 0.06)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3">
        <h3 className="text-[15px] font-semibold text-[#1C1C1E]">Print Queue</h3>
        {recentCompletedJobs.length > 0 && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => clearCompleted()}
            className="h-6 gap-1 px-2 text-[#8E8E93]"
          >
            <Trash2 className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="max-h-[420px] overflow-y-auto">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-10">
            <Printer className="mb-3 h-10 w-10 text-[#C7C7CC]" strokeWidth={1.2} />
            <p className="text-sm font-medium text-[#8E8E93]">No print jobs</p>
            <p className="mt-0.5 text-xs text-[#C7C7CC]">
              Jobs will appear here when you print
            </p>
          </div>
        ) : (
          <div className="divide-y divide-black/[0.04]">
            {/* Failed jobs first */}
            {failedJobs.length > 0 && (
              <div className="px-2 py-2">
                <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-[#FF3B30]">
                  Failed ({failedJobs.length})
                </p>
                {failedJobs.map((job) => (
                  <PrintQueueItem
                    key={job.id}
                    job={job}
                    onRetry={(id) => retryJob(id)}
                    onCancel={(id) => cancelJob(id)}
                  />
                ))}
              </div>
            )}

            {/* Pending jobs */}
            {pendingJobs.length > 0 && (
              <div className="px-2 py-2">
                <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-[#007AFF]">
                  Pending ({pendingJobs.length})
                </p>
                {pendingJobs.map((job) => (
                  <PrintQueueItem
                    key={job.id}
                    job={job}
                    onRetry={(id) => retryJob(id)}
                    onCancel={(id) => cancelJob(id)}
                  />
                ))}
              </div>
            )}

            {/* Recent completed */}
            {recentCompletedJobs.length > 0 && (
              <div className="px-2 py-2">
                <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                  Recent
                </p>
                {recentCompletedJobs.slice(0, 5).map((job) => (
                  <PrintQueueItem
                    key={job.id}
                    job={job}
                    onRetry={(id) => retryJob(id)}
                    onCancel={(id) => cancelJob(id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
