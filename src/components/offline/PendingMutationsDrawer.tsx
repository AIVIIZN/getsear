'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { RefreshCw, X, AlertCircle, Clock, Loader2, Trash2, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { ManagerPinDialog } from '@/components/pos/ManagerPinDialog'
import { useSyncQueue } from '@/hooks/use-sync-queue'
import {
  retryEntry,
  removeEntry,
  getPendingEntries,
} from '@/lib/offline/sync-queue'
import type { SyncQueueEntry, SyncOperation } from '@/lib/offline/db'

interface PendingMutationsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const OPERATION_LABELS: Record<SyncOperation, string> = {
  create_order: 'New order',
  update_order: 'Update order',
  add_order_items: 'Add items to order',
  void_order: 'Void order',
  close_order: 'Close order',
  create_payment: 'Create payment',
  settle_payment: 'Settle payment',
  clock_in: 'Clock in',
  clock_out: 'Clock out',
  update_table: 'Update table',
}

function operationLabel(op: SyncOperation): string {
  return OPERATION_LABELS[op] ?? op
}

type RowStatus = 'queued' | 'syncing' | 'failed'

function statusOf(entry: SyncQueueEntry): RowStatus {
  if (entry.status === 'syncing') return 'syncing'
  if (entry.status === 'failed') return 'failed'
  return 'queued'
}

function StatusPill({ status }: { status: RowStatus }) {
  const styles: Record<RowStatus, string> = {
    queued: 'bg-[var(--color-marketing-accent)]/10 text-[var(--color-marketing-accent-deep)] border-[var(--color-marketing-accent)]/20',
    syncing: 'bg-[var(--color-blue-legacy)]/10 text-[var(--color-blue-deep)] border-[var(--color-blue-legacy)]/20',
    failed: 'bg-[var(--color-danger-strong)]/10 text-[var(--color-danger-800)] border-[var(--color-danger-strong)]/20',
  }
  const Icon = status === 'syncing' ? Loader2 : status === 'failed' ? AlertCircle : Clock
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize',
        styles[status]
      )}
    >
      <Icon className={cn('h-3 w-3', status === 'syncing' && 'animate-spin')} strokeWidth={2.5} />
      {status}
    </span>
  )
}

export function PendingMutationsDrawer({ open, onOpenChange }: PendingMutationsDrawerProps) {
  const { failedEntries } = useSyncQueue()
  const [pending, setPending] = useState<SyncQueueEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [busyIds, setBusyIds] = useState<Record<string, 'retrying' | 'abandoning'>>({})
  const [pinTargetId, setPinTargetId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const entries = await getPendingEntries()
      setPending(entries)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pending operations')
      setPending([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      void refresh()
    }
  }, [open, refresh])

  // Refresh when queue changes upstream (failedEntries changes via the hook polling).
  useEffect(() => {
    if (open) void refresh()
  }, [failedEntries.length, open, refresh])

  const allEntries = useMemo<SyncQueueEntry[]>(() => {
    const merged = [...(pending ?? []), ...failedEntries]
    // De-dup by id (an entry could appear in both lists during transitions).
    const seen = new Set<string>()
    const unique: SyncQueueEntry[] = []
    for (const e of merged) {
      if (seen.has(e.id)) continue
      seen.add(e.id)
      unique.push(e)
    }
    // Sort: failed first (needs attention), then by created_at desc.
    return unique.sort((a, b) => {
      const aFailed = a.status === 'failed' ? 0 : 1
      const bFailed = b.status === 'failed' ? 0 : 1
      if (aFailed !== bFailed) return aFailed - bFailed
      return b.created_at.localeCompare(a.created_at)
    })
  }, [pending, failedEntries])

  const handleRetry = useCallback(
    async (entryId: string) => {
      setBusyIds((s) => ({ ...s, [entryId]: 'retrying' }))
      setError(null)
      try {
        await retryEntry(entryId)
        await refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Retry failed')
      } finally {
        setBusyIds((s) => {
          const next = { ...s }
          delete next[entryId]
          return next
        })
      }
    },
    [refresh]
  )

  const handleAbandonRequest = useCallback((entryId: string) => {
    setPinTargetId(entryId)
  }, [])

  const handleAbandonVerified = useCallback(async () => {
    const entryId = pinTargetId
    if (!entryId) return
    setPinTargetId(null)
    setBusyIds((s) => ({ ...s, [entryId]: 'abandoning' }))
    setError(null)
    try {
      await removeEntry(entryId)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Abandon failed')
    } finally {
      setBusyIds((s) => {
        const next = { ...s }
        delete next[entryId]
        return next
      })
    }
  }, [pinTargetId, refresh])

  const isInitialLoad = pending === null && loading

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md flex flex-col gap-0 p-0"
          aria-describedby="pending-mutations-description"
        >
          <SheetHeader className="border-b border-[var(--border)] px-5 py-4">
            <SheetTitle className="text-[17px]">Pending offline operations</SheetTitle>
            <SheetDescription id="pending-mutations-description" className="text-[13px]">
              These operations were captured offline and are waiting to sync.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {error && (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-[var(--color-danger-strong)]/20 bg-[var(--color-danger-strong)]/5 px-3 py-2 text-[13px] text-[var(--color-danger-800)]"
              >
                {error}
              </div>
            )}

            {isInitialLoad && (
              <ul className="flex flex-col gap-3" aria-label="Loading pending operations">
                {[0, 1, 2].map((i) => (
                  <li
                    key={i}
                    className="rounded-xl border border-[var(--border)] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {!isInitialLoad && allEntries.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-success-strong)]/10">
                  <Inbox className="h-5 w-5 text-[var(--color-success-strong)]" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-[15px] font-medium text-[var(--color-text)]">All caught up</p>
                  <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
                    No pending offline operations.
                  </p>
                </div>
              </div>
            )}

            {!isInitialLoad && allEntries.length > 0 && (
              <ul className="flex flex-col gap-3">
                {allEntries.map((entry) => {
                  const status = statusOf(entry)
                  const busy = busyIds[entry.id]
                  const created = new Date(entry.created_at)
                  const ageLabel = isNaN(created.getTime())
                    ? 'just now'
                    : formatDistanceToNow(created, { addSuffix: true })
                  return (
                    <li
                      key={entry.id}
                      className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-semibold text-[var(--color-text)]">
                            {operationLabel(entry.operation)}
                          </p>
                          <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)] tabular-nums">
                            {ageLabel}
                            {entry.attempts > 0 && ` · attempt ${entry.attempts} of ${entry.max_attempts}`}
                          </p>
                          {entry.error && status === 'failed' && (
                            <p className="mt-1.5 text-[12px] text-[var(--color-danger-800)] break-words">
                              {entry.error}
                            </p>
                          )}
                        </div>
                        <StatusPill status={status} />
                      </div>

                      <div className="mt-3 flex items-center justify-end gap-2">
                        {status === 'failed' && (
                          <button
                            type="button"
                            onClick={() => void handleRetry(entry.id)}
                            disabled={!!busy}
                            className={cn(
                              'inline-flex items-center justify-center gap-1.5 rounded-lg',
                              'min-h-[44px] px-3 py-2',
                              'sm:min-h-[36px] sm:px-2.5 sm:py-1.5',
                              'text-[13px] font-medium',
                              'border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/10 text-[var(--color-primary-deep)]',
                              'hover:bg-[var(--color-primary)]/15 active:bg-[var(--color-primary)]/20',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/50',
                              'disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                            )}
                          >
                            {busy === 'retrying' ? (
                              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                            ) : (
                              <RefreshCw className="h-4 w-4" strokeWidth={2} />
                            )}
                            Retry
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleAbandonRequest(entry.id)}
                          disabled={!!busy}
                          className={cn(
                            'inline-flex items-center justify-center gap-1.5 rounded-lg',
                            'min-h-[44px] px-3 py-2',
                            'sm:min-h-[36px] sm:px-2.5 sm:py-1.5',
                            'text-[13px] font-medium',
                            'border border-[var(--color-danger-strong)]/20 bg-transparent text-[var(--color-danger-800)]',
                            'hover:bg-[var(--color-danger-strong)]/10 active:bg-[var(--color-danger-strong)]/15',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger-strong)]/50',
                            'disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                          )}
                        >
                          {busy === 'abandoning' ? (
                            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                          ) : (
                            <Trash2 className="h-4 w-4" strokeWidth={2} />
                          )}
                          Abandon
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-[var(--border)] px-5 py-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className={cn(
                'inline-flex w-full items-center justify-center gap-1.5 rounded-lg',
                'min-h-[44px] px-4 py-2 text-[14px] font-medium',
                'border border-[var(--border)] bg-white text-[var(--color-text)]',
                'hover:bg-[var(--muted)] active:bg-[var(--accent)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/50',
                'transition-colors'
              )}
            >
              <X className="h-4 w-4" strokeWidth={2} />
              Close
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <ManagerPinDialog
        open={pinTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setPinTargetId(null)
        }}
        title="Manager approval required"
        description="Abandoning an offline operation will permanently discard it. Enter manager PIN to continue."
        onVerified={() => void handleAbandonVerified()}
      />
    </>
  )
}
