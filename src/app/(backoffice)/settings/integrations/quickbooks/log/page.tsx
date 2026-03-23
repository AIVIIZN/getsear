'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, RefreshCw, ExternalLink, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface SyncLogEntry {
  id: string
  business_date: string
  total_revenue: number
  qbo_journal_entry_id: string | null
  status: 'success' | 'partial' | 'failed'
  error_message: string | null
  created_at: string
}

export default function QboSyncLogPage() {
  const [entries, setEntries] = useState<SyncLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)

  const locationId = '00000000-0000-0000-0000-000000000001'

  const fetchLog = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/integrations/quickbooks/log?location_id=${locationId}`)
      const json = await res.json()
      if (json.data) setEntries(json.data)
    } catch {
      toast.error('Failed to load sync log')
    } finally {
      setLoading(false)
    }
  }, [locationId])

  useEffect(() => { fetchLog() }, [fetchLog])

  const handleResync = async (businessDate: string) => {
    setSyncing(businessDate)
    try {
      const res = await fetch('/api/integrations/quickbooks/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId, business_date: businessDate }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(`Re-synced $${json.data.total_synced?.toLocaleString() ?? '0'} for ${businessDate}`)
      fetchLog()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Re-sync failed')
    } finally {
      setSyncing(null)
    }
  }

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />
      case 'partial': return <AlertTriangle className="h-4 w-4 text-[var(--warning)]" />
      case 'failed': return <XCircle className="h-4 w-4 text-[var(--error)]" />
      default: return null
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/settings/integrations/quickbooks"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white hover:bg-[var(--secondary)] transition-colors touch-target"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-xl font-semibold text-foreground">QuickBooks Sync Log</h2>
            <p className="text-sm text-muted-foreground">{entries.length} sync attempts</p>
          </div>
        </div>
        <button
          onClick={fetchLog}
          className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-foreground hover:bg-[var(--secondary)] transition-colors touch-target"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-white overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--secondary)]">
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Business Date</th>
              <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Revenue</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">QBO Entry ID</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--muted)]">
                      <RefreshCw className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground">No sync attempts yet</p>
                    <p className="text-xs text-muted-foreground">Sync logs will appear here once daily syncs run.</p>
                  </div>
                </td>
              </tr>
            )}
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="px-5 py-3">
                  <span className="font-mono text-xs text-muted-foreground">
                    {new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className="text-sm font-medium text-foreground">{entry.business_date}</span>
                </td>
                <td className="px-5 py-3 text-right">
                  <span className="text-sm font-semibold text-foreground">
                    ${Number(entry.total_revenue ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </td>
                <td className="px-5 py-3">
                  {entry.qbo_journal_entry_id ? (
                    <span className="font-mono text-xs text-[var(--info)]">{entry.qbo_journal_entry_id}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1.5">
                    <StatusIcon status={entry.status} />
                    <span className={cn(
                      'text-xs font-medium capitalize',
                      entry.status === 'success' && 'text-[var(--success)]',
                      entry.status === 'failed' && 'text-[var(--error)]',
                      entry.status === 'partial' && 'text-[var(--warning)]'
                    )}>
                      {entry.status}
                    </span>
                  </div>
                  {entry.error_message && (
                    <p className="text-xs text-[var(--error)] mt-0.5">{entry.error_message}</p>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {entry.status === 'failed' && (
                      <button
                        onClick={() => handleResync(entry.business_date)}
                        disabled={syncing === entry.business_date}
                        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-[var(--primary)] hover:bg-[var(--accent)] transition-colors touch-target"
                      >
                        {syncing === entry.business_date ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        Re-sync
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
