'use client'

import { useState, useCallback, useEffect } from 'react'
import { RefreshCw, ChevronDown, ChevronUp, RotateCw, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export type DeliveryStatus = 'delivered' | 'sent' | 'pending' | 'failed' | 'opted_out' | 'opened' | 'bounced' | 'retrying'

export interface DeliveryLogEntry {
  id: string
  timestamp: string
  recipient: string
  templateType?: string
  templateName?: string
  subject?: string
  status: DeliveryStatus
  externalId?: string
  error?: string
  responseCode?: number
  responseTimeMs?: number
  requestPayload?: string
  responseBody?: string
  attempt?: number
}

interface DeliveryLogTableProps {
  entries: DeliveryLogEntry[]
  loading: boolean
  onRefresh: () => void
  onRetry?: (id: string) => Promise<void>
  onLoadMore?: () => void
  hasMore?: boolean
  statusFilter?: DeliveryStatus | 'all'
  onStatusFilterChange?: (status: DeliveryStatus | 'all') => void
  showPayload?: boolean
  type: 'sms' | 'email' | 'webhook'
}

const STATUS_STYLES: Record<DeliveryStatus, { bg: string; text: string; label: string }> = {
  delivered: { bg: 'bg-[var(--success-bg)]', text: 'text-[var(--color-success-600)]', label: 'Delivered' },
  sent: { bg: 'bg-[var(--info-bg)]', text: 'text-[var(--info)]', label: 'Sent' },
  pending: { bg: 'bg-[var(--warning-bg)]', text: 'text-[var(--color-marketing-warning-dark)]', label: 'Pending' },
  failed: { bg: 'bg-[var(--error-bg)]', text: 'text-[var(--error)]', label: 'Failed' },
  opted_out: { bg: 'bg-[var(--muted)]', text: 'text-[var(--muted-foreground)]', label: 'Opted Out' },
  opened: { bg: 'bg-[var(--success-bg)]', text: 'text-[var(--color-success-600)]', label: 'Opened' },
  bounced: { bg: 'bg-[var(--error-bg)]', text: 'text-[var(--error)]', label: 'Bounced' },
  retrying: { bg: 'bg-[var(--warning-bg)]', text: 'text-[var(--color-marketing-warning-dark)]', label: 'Retrying' },
}

function StatusPill({ status }: { status: DeliveryStatus }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', style.bg, style.text)}>
      {style.label}
    </span>
  )
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function DeliveryLogTable({
  entries,
  loading,
  onRefresh,
  onRetry,
  onLoadMore,
  hasMore,
  statusFilter = 'all',
  onStatusFilterChange,
  showPayload = false,
  type,
}: DeliveryLogTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [retrying, setRetrying] = useState<Set<string>>(new Set())

  const toggleRow = useCallback((id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleRetry = useCallback(async (id: string) => {
    if (!onRetry) return
    setRetrying(prev => new Set(prev).add(id))
    try {
      await onRetry(id)
      toast.success('Retry queued')
    } catch {
      toast.error('Retry failed')
    } finally {
      setRetrying(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }, [onRetry])

  const statuses: Array<DeliveryStatus | 'all'> = ['all', 'delivered', 'sent', 'pending', 'failed']
  if (type === 'email') statuses.push('opened', 'bounced')
  if (type === 'sms') statuses.push('opted_out')
  if (type === 'webhook') statuses.push('retrying')

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className="flex gap-1">
            {statuses.map(s => (
              <button
                key={s}
                onClick={() => onStatusFilterChange?.(s)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-medium transition-colors touch-target',
                  statusFilter === s
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)]'
                )}
              >
                {s === 'all' ? 'All' : STATUS_STYLES[s]?.label ?? s}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-[var(--secondary)] touch-target"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[var(--border)] bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--secondary)]">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Recipient
                </th>
                {type !== 'webhook' && (
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {type === 'email' ? 'Subject' : 'Template'}
                  </th>
                )}
                {type === 'webhook' && (
                  <>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Event
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Response
                    </th>
                  </>
                )}
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  ID
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {entries.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--muted)]">
                        <RefreshCw className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium text-foreground">No messages sent yet</p>
                      <p className="text-xs text-muted-foreground">
                        {type === 'sms' && 'SMS delivery logs will appear here once you start sending notifications.'}
                        {type === 'email' && 'Email delivery logs will appear here once you send receipts or campaigns.'}
                        {type === 'webhook' && 'Webhook deliveries will appear here once events are triggered.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
              {loading && entries.length === 0 && (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><div className="h-4 w-24 animate-pulse rounded bg-[var(--muted)]" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-28 animate-pulse rounded bg-[var(--muted)]" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-20 animate-pulse rounded bg-[var(--muted)]" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-16 animate-pulse rounded bg-[var(--muted)]" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-32 animate-pulse rounded bg-[var(--muted)]" /></td>
                    <td className="px-4 py-3" />
                  </tr>
                ))
              )}
              {entries.map((entry) => {
                const isExpanded = expandedRows.has(entry.id)
                const canRetry = entry.status === 'failed' && onRetry
                const isRetrying = retrying.has(entry.id)

                return (
                  <tr key={entry.id} className="group">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimestamp(entry.timestamp)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-foreground">{entry.recipient}</span>
                    </td>
                    {type !== 'webhook' && (
                      <td className="px-4 py-3">
                        <span className="text-sm text-muted-foreground">
                          {entry.subject ?? entry.templateName ?? entry.templateType ?? '-'}
                        </span>
                      </td>
                    )}
                    {type === 'webhook' && (
                      <>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-foreground">{entry.templateType}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {entry.responseCode !== undefined && entry.responseCode > 0 && (
                              <span className={cn(
                                'font-mono text-xs font-medium',
                                entry.responseCode >= 200 && entry.responseCode < 300
                                  ? 'text-[var(--success)]'
                                  : 'text-[var(--error)]'
                              )}>
                                {entry.responseCode}
                              </span>
                            )}
                            {entry.responseTimeMs !== undefined && (
                              <span className="text-xs text-muted-foreground">{entry.responseTimeMs}ms</span>
                            )}
                          </div>
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3">
                      <StatusPill status={entry.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-muted-foreground">
                        {entry.externalId ? entry.externalId.slice(0, 16) + '...' : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canRetry && (
                          <button
                            onClick={() => handleRetry(entry.id)}
                            disabled={isRetrying}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--muted)] hover:text-foreground transition-colors touch-target"
                            title="Retry"
                          >
                            <RotateCw className={cn('h-3.5 w-3.5', isRetrying && 'animate-spin')} />
                          </button>
                        )}
                        {(showPayload || entry.error) && (
                          <button
                            onClick={() => toggleRow(entry.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--muted)] hover:text-foreground transition-colors touch-target"
                            title={isExpanded ? 'Collapse' : 'Expand'}
                          >
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </div>
                    </td>
                    {isExpanded && (
                      <td colSpan={7} className="border-t border-[var(--border)] bg-[var(--secondary)] px-4 py-3">
                        {entry.error && (
                          <div className="mb-3 rounded-lg bg-[var(--error-bg)] px-3 py-2">
                            <p className="text-xs font-medium text-[var(--error)]">Error</p>
                            <p className="text-xs text-[var(--error)] font-mono mt-0.5">{entry.error}</p>
                          </div>
                        )}
                        {entry.requestPayload && (
                          <div className="mb-3">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Request Payload</p>
                            <pre className="rounded-lg bg-[var(--color-text)] p-3 text-xs text-green-400 font-mono overflow-x-auto max-h-48">
                              {formatJson(entry.requestPayload)}
                            </pre>
                          </div>
                        )}
                        {entry.responseBody && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Response</p>
                            <pre className="rounded-lg bg-[var(--color-text)] p-3 text-xs text-green-400 font-mono overflow-x-auto max-h-48">
                              {formatJson(entry.responseBody)}
                            </pre>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {hasMore && (
          <div className="border-t border-[var(--border)] p-3 text-center">
            <button
              onClick={onLoadMore}
              className="text-sm font-medium text-[var(--primary)] hover:underline touch-target"
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}
