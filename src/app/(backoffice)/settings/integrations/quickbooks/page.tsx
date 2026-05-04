'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  BookOpen,
  Map,
  ScrollText,
  ExternalLink,
  Unplug,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui-v2/Button'
import { Card } from '@/components/ui-v2/Card'
import { Toggle } from '@/components/ui-v2/inputs/Toggle'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import { Badge } from '@/components/ui-v2/data/Badge'
import { ConfirmDialog } from '@/components/ui-v2/feedback/ConfirmDialog'
import { ConnectionStatus } from '@/components/integrations/ConnectionStatus'
import { useIntegrationsStore } from '@/stores/integrations-store'

interface QboConnectionData {
  company_name: string
  connected_at: string
  last_sync_at: string | null
  is_sandbox: boolean
  sync_frequency: 'daily' | 'manual'
  is_active: boolean
}

export default function QuickBooksPage() {
  const { setStatus } = useIntegrationsStore()
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [connection, setConnection] = useState<QboConnectionData | null>(null)
  const [isSandbox, setIsSandbox] = useState(true)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

  const locationId = '00000000-0000-0000-0000-000000000001'

  const fetchConnection = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('connected') === 'true') {
        toast.success('QuickBooks connected successfully!')
        window.history.replaceState({}, '', window.location.pathname)
      }
      if (params.get('error')) {
        toast.error(`Connection failed: ${params.get('error')?.replace(/_/g, ' ')}`)
        window.history.replaceState({}, '', window.location.pathname)
      }

      const res = await fetch(`/api/accounting/status?location_id=${locationId}`)
      const json = await res.json()
      if (json.data?.is_active) {
        setConnection(json.data)
        setStatus('quickbooks', 'connected')
      } else {
        setConnection(null)
        setStatus('quickbooks', 'disconnected')
      }
    } catch {
      setConnection(null)
      setStatus('quickbooks', 'disconnected')
    } finally {
      setLoading(false)
    }
  }, [locationId, setStatus])

  useEffect(() => {
    fetchConnection()
  }, [fetchConnection])

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const res = await fetch('/api/integrations/quickbooks/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId, is_sandbox: isSandbox }),
      })
      const json = await res.json()
      if (json.data?.authorization_url) {
        window.location.href = json.data.authorization_url
      } else {
        toast.error(json.error ?? 'Failed to start connection')
      }
    } catch {
      toast.error('Failed to connect')
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      const res = await fetch('/api/integrations/quickbooks/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setConnection(null)
      setStatus('quickbooks', 'disconnected')
      toast.success('QuickBooks disconnected')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to disconnect')
    } finally {
      setDisconnecting(false)
    }
  }

  const handleSyncNow = async () => {
    setSyncing(true)
    try {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const businessDate = yesterday.toISOString().split('T')[0]

      const res = await fetch('/api/integrations/quickbooks/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId, business_date: businessDate }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(`Synced $${json.data.total_synced?.toLocaleString() ?? '0'} for ${businessDate}`)
      fetchConnection()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-[var(--space-6)] max-w-2xl">
        <Skeleton className="h-9 w-64" />
        <Skeleton variant="card" />
      </div>
    )
  }

  return (
    <div className="flex max-w-2xl flex-col gap-[var(--space-6)]">
      {/* Header */}
      <div className="flex items-center gap-[var(--space-3)]">
        <Link
          href="/settings/integrations"
          className="btn-press touch-target flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:bg-[color:var(--color-surface-hover)]"
          aria-label="Back to integrations"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h2 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
            QuickBooks Online
          </h2>
          <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
            Sync daily sales to QuickBooks automatically
          </p>
        </div>
        <ConnectionStatus status={connection ? 'connected' : 'disconnected'} />
      </div>

      {connection ? (
        <>
          {/* Connected State */}
          <Card variant="flat" padding="default">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-[var(--space-4)]">
                <div className="flex h-14 w-14 items-center justify-center rounded-[var(--radius-lg)] bg-[color:var(--color-success-bg)]">
                  <BookOpen className="h-7 w-7 text-[color:var(--color-success)]" />
                </div>
                <div>
                  <p className="text-[length:var(--type-callout-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
                    {connection.company_name}
                  </p>
                  <div className="mt-[2px] flex items-center gap-[var(--space-2)] text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
                    <span>
                      Connected{' '}
                      {new Date(connection.connected_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    {connection.is_sandbox && (
                      <Badge variant="warning" size="sm">
                        Sandbox
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="md"
                onClick={() => setConfirmDisconnect(true)}
                leadingIcon={<Unplug className="h-4 w-4" />}
                className="text-[color:var(--color-danger)]"
              >
                Disconnect
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-[var(--space-4)]">
              <div className="rounded-[var(--radius-md)] bg-[color:var(--color-bg-subtle)] p-[var(--space-4)]">
                <p className="mb-[var(--space-1)] text-[length:var(--type-footnote-size)] uppercase tracking-wider text-[color:var(--color-text-muted)]">
                  Sync Frequency
                </p>
                <p className="text-[length:var(--type-subhead-size)] font-[var(--weight-semibold)] capitalize text-[color:var(--color-text)]">
                  {connection.sync_frequency} at 2:00 AM
                </p>
              </div>
              <div className="rounded-[var(--radius-md)] bg-[color:var(--color-bg-subtle)] p-[var(--space-4)]">
                <p className="mb-[var(--space-1)] text-[length:var(--type-footnote-size)] uppercase tracking-wider text-[color:var(--color-text-muted)]">
                  Last Sync
                </p>
                <p className="text-[length:var(--type-subhead-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
                  {connection.last_sync_at
                    ? new Date(connection.last_sync_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : 'Never'}
                </p>
              </div>
            </div>

            <Button
              onClick={handleSyncNow}
              loading={syncing}
              size="lg"
              className="w-full"
              leadingIcon={<RefreshCw className="h-4 w-4" />}
            >
              Sync Now
            </Button>
          </Card>

          {/* Sub-nav */}
          <div className="flex gap-[var(--space-2)]">
            <Link href="/settings/integrations/quickbooks/mapping" className="block">
              <Button variant="secondary" size="md" leadingIcon={<Map className="h-4 w-4" />}>
                Chart of Accounts Mapping
              </Button>
            </Link>
            <Link href="/settings/integrations/quickbooks/log" className="block">
              <Button
                variant="secondary"
                size="md"
                leadingIcon={<ScrollText className="h-4 w-4" />}
              >
                Sync Log
              </Button>
            </Link>
          </div>
        </>
      ) : (
        /* Disconnected State */
        <Card variant="flat" padding="spacious" className="items-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-[var(--radius-xl)] bg-[color:var(--color-success-bg)]">
            <BookOpen className="h-10 w-10 text-[color:var(--color-success)]" />
          </div>
          <div>
            <h3 className="text-[length:var(--type-title-3-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
              Connect to QuickBooks Online
            </h3>
            <p className="mx-auto mt-[var(--space-2)] max-w-md text-[length:var(--type-subhead-size)] leading-[var(--type-line-height-relaxed)] text-[color:var(--color-text-muted)]">
              Automatically sync your daily sales to QuickBooks. Food revenue, beverage revenue, tips, tax, and refunds are mapped to your chart of accounts as journal entries.
            </p>
          </div>

          <Toggle
            checked={!isSandbox}
            onChange={(v) => setIsSandbox(!v)}
            label={isSandbox ? 'Sandbox Mode' : 'Production Mode'}
          />

          <Button
            onClick={handleConnect}
            loading={connecting}
            size="xl"
            leadingIcon={<ExternalLink className="h-4 w-4" />}
          >
            Connect to QuickBooks
          </Button>
        </Card>
      )}

      <ConfirmDialog
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
        title="Disconnect QuickBooks?"
        description="This will stop all automatic syncing. Existing data in QuickBooks will not be affected. You can reconnect at any time."
        confirmLabel="Disconnect"
        variant="destructive"
        loading={disconnecting}
        onConfirm={handleDisconnect}
      />
    </div>
  )
}
