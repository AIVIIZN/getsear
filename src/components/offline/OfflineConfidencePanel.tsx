'use client'

import { useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { AlertTriangle, Clock3, CreditCard, ListChecks, ShieldCheck, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOfflineStore } from '@/stores/offline-store'
import { useSyncQueue } from '@/hooks/use-sync-queue'
import { getOfflineConfidence, type PaymentRiskLevel, type SyncRiskLevel } from '@/lib/offline/offline-confidence'
import { PendingMutationsDrawer } from './PendingMutationsDrawer'

const riskTone: Record<SyncRiskLevel | PaymentRiskLevel, string> = {
  clear: 'text-[var(--color-success-text)]',
  watch: 'text-[var(--color-marketing-accent-deep)]',
  high: 'text-[var(--color-danger-800)]',
  blocked: 'text-[var(--color-danger-800)]',
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function formatLastSync(lastSyncAt: string | null): string {
  if (!lastSyncAt) return 'No sync yet'
  const parsed = new Date(lastSyncAt)
  if (Number.isNaN(parsed.getTime())) return 'Sync time unknown'
  return `${formatDistanceToNow(parsed, { addSuffix: true })}`
}

export function OfflineConfidencePanel() {
  const connectionState = useOfflineStore((s) => s.connectionState)
  const storeForwardCount = useOfflineStore((s) => s.storeForwardCount)
  const storeForwardTotal = useOfflineStore((s) => s.storeForwardTotal)
  const quotaPercent = useOfflineStore((s) => s.quotaPercent)
  const {
    pendingEntries,
    failedEntries,
    conflicts,
    isSyncing,
    lastSyncAt,
  } = useSyncQueue()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const snapshot = useMemo(
    () => getOfflineConfidence({
      connectionState,
      isSyncing,
      lastSyncAt,
      pendingEntries,
      failedEntries,
      conflicts,
      storeForwardCount,
      storeForwardTotal,
      quotaPercent,
    }),
    [
      connectionState,
      isSyncing,
      lastSyncAt,
      pendingEntries,
      failedEntries,
      conflicts,
      storeForwardCount,
      storeForwardTotal,
      quotaPercent,
    ]
  )

  const StatusIcon = snapshot.safeToSell ? ShieldCheck : AlertTriangle
  const statusClass = snapshot.safeToSell
    ? 'border-[var(--color-success-vivid)]/20 bg-[var(--color-success-vivid)]/8 text-[var(--color-success-text)]'
    : 'border-[var(--color-danger-strong)]/20 bg-[var(--color-danger-strong)]/8 text-[var(--color-danger-800)]'
  const hasQueueDetail = snapshot.queuedOperations > 0 || failedEntries.length > 0

  return (
    <>
      <section
        aria-label="Offline confidence"
        className="border-b border-[var(--border)] bg-[var(--color-neutral-100-alt)]/90 px-4 py-2"
      >
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={cn(
              'inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-3 py-2',
              statusClass
            )}
          >
            <StatusIcon className="h-4 w-4 shrink-0" strokeWidth={2.2} />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-tight">{snapshot.headline}</p>
              <p className="max-w-[360px] truncate text-[12px] leading-tight text-[var(--color-text-muted)]">
                {snapshot.guidance}
              </p>
            </div>
          </div>

          <Metric icon={ListChecks} label="Queued orders" value={`${snapshot.queuedOrders}`} />
          <Metric icon={CreditCard} label="Queued dollars" value={formatMoney(snapshot.queuedDollarsCents)} />
          <Metric
            icon={CreditCard}
            label="Payment risk"
            value={formatMoney(snapshot.paymentRiskCents)}
            tone={riskTone[snapshot.paymentRiskLevel]}
          />
          <Metric icon={Clock3} label="Last sync" value={formatLastSync(lastSyncAt)} />
          <Metric label="Sync risk" value={snapshot.syncRiskLevel} tone={riskTone[snapshot.syncRiskLevel]} />

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            disabled={!hasQueueDetail}
            className={cn(
              'ml-auto inline-flex min-h-[44px] items-center justify-center rounded-lg border px-3 py-2 text-[13px] font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/50',
              hasQueueDetail
                ? 'border-[var(--color-primary)]/20 bg-white text-[var(--color-primary-deep)] hover:bg-[var(--color-primary)]/8 active:bg-[var(--color-primary)]/12'
                : 'pointer-events-none border-[var(--border)] bg-white/60 text-[var(--color-text-muted)] opacity-40'
            )}
          >
            Review queue
          </button>
        </div>

        {snapshot.unresolvedConflicts.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-[var(--color-danger-800)]">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
            {snapshot.unresolvedConflicts.slice(0, 2).map((conflict) => (
              <span key={conflict} className="rounded-full bg-[var(--color-danger-strong)]/8 px-2 py-1">
                {conflict}
              </span>
            ))}
          </div>
        )}
      </section>

      <PendingMutationsDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = 'text-[var(--color-text)]',
}: {
  icon?: LucideIcon
  label: string
  value: string
  tone?: string
}) {
  return (
    <div className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2">
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" strokeWidth={2.2} />}
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase leading-tight text-[var(--color-text-muted)]">{label}</p>
        <p className={cn('max-w-[160px] truncate text-[13px] font-semibold leading-tight capitalize', tone)}>
          {value}
        </p>
      </div>
    </div>
  )
}
