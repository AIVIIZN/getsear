'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui-v2/Button'
import { Card } from '@/components/ui-v2/Card'
import { Badge } from '@/components/ui-v2/data/Badge'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import { EmptyState } from '@/components/ui-v2/feedback/EmptyState'
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui-v2/data/Table'
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

  useEffect(() => {
    fetchLog()
  }, [fetchLog])

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
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-[color:var(--color-success)]" />
      case 'partial':
        return <AlertTriangle className="h-4 w-4 text-[color:var(--color-warning)]" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-[color:var(--color-danger)]" />
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-[var(--space-6)]">
        <Skeleton className="h-9 w-64" />
        <Skeleton variant="card" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[var(--space-3)]">
          <Link
            href="/settings/integrations/quickbooks"
            className="btn-press touch-target flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:bg-[color:var(--color-surface-hover)]"
            aria-label="Back to QuickBooks"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
              QuickBooks Sync Log
            </h2>
            <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
              {entries.length} sync attempts
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="md"
          onClick={fetchLog}
          leadingIcon={<RefreshCw className="h-4 w-4" />}
        >
          Refresh
        </Button>
      </div>

      <Card variant="flat" padding="default" className="gap-0 p-0 overflow-hidden">
        {entries.length === 0 ? (
          <EmptyState
            icon={RefreshCw}
            title="No sync attempts yet"
            description="Sync logs will appear here once daily syncs run."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell header>Date</TableCell>
                <TableCell header>Business Date</TableCell>
                <TableCell header align="right">Revenue</TableCell>
                <TableCell header>QBO Entry ID</TableCell>
                <TableCell header>Status</TableCell>
                <TableCell header align="right">Actions</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <span className="font-mono text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
                      {new Date(entry.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  </TableCell>
                  <TableCell className="font-[var(--weight-medium)]">
                    {entry.business_date}
                  </TableCell>
                  <TableCell align="right" className="font-[var(--weight-semibold)] tabular-nums">
                    ${Number(entry.total_revenue ?? 0).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell>
                    {entry.qbo_journal_entry_id ? (
                      <span className="font-mono text-[length:var(--type-footnote-size)] text-[color:var(--color-primary)]">
                        {entry.qbo_journal_entry_id}
                      </span>
                    ) : (
                      <span className="text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
                        --
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-[var(--space-1)]">
                      <StatusIcon status={entry.status} />
                      <span
                        className={cn(
                          'text-[length:var(--type-footnote-size)] font-[var(--weight-medium)] capitalize',
                          entry.status === 'success' && 'text-[color:var(--color-success)]',
                          entry.status === 'failed' && 'text-[color:var(--color-danger)]',
                          entry.status === 'partial' && 'text-[color:var(--color-warning)]',
                        )}
                      >
                        {entry.status}
                      </span>
                    </div>
                    {entry.error_message && (
                      <p className="mt-[2px] text-[length:var(--type-footnote-size)] text-[color:var(--color-danger)]">
                        {entry.error_message}
                      </p>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {entry.status === 'failed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResync(entry.business_date)}
                        loading={syncing === entry.business_date}
                        leadingIcon={<RefreshCw className="h-3 w-3" />}
                      >
                        Re-sync
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
