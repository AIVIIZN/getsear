'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Map, ScrollText, Loader2, ExternalLink, Unplug, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
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

  const locationId = '00000000-0000-0000-0000-000000000001'

  const fetchConnection = useCallback(async () => {
    setLoading(true)
    try {
      // Check for query params from OAuth callback
      const params = new URLSearchParams(window.location.search)
      if (params.get('connected') === 'true') {
        toast.success('QuickBooks connected successfully!')
        window.history.replaceState({}, '', window.location.pathname)
      }
      if (params.get('error')) {
        toast.error(`Connection failed: ${params.get('error')?.replace(/_/g, ' ')}`)
        window.history.replaceState({}, '', window.location.pathname)
      }

      // Fetch connection status from the accounting API that already exists
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

  useEffect(() => { fetchConnection() }, [fetchConnection])

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
    if (!confirm('Disconnect QuickBooks? This will stop all automatic syncing.')) return
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
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/settings/integrations"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white hover:bg-[var(--secondary)] transition-colors touch-target"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-foreground">QuickBooks Online</h2>
          <p className="text-sm text-muted-foreground">Sync daily sales to QuickBooks automatically</p>
        </div>
        <ConnectionStatus status={connection ? 'connected' : 'disconnected'} />
      </div>

      {connection ? (
        <>
          {/* Connected State */}
          <div className="rounded-2xl border border-[var(--border)] bg-white p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2CA01C]/10">
                  <BookOpen className="h-7 w-7 text-[#2CA01C]" />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">{connection.company_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Connected {new Date(connection.connected_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {connection.is_sandbox && <span className="ml-2 rounded-full bg-[var(--warning-bg)] px-2 py-0.5 text-[10px] font-medium text-[#b45309]">Sandbox</span>}
                  </p>
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-[var(--error)] hover:bg-[var(--error-bg)] transition-colors touch-target"
              >
                {disconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
                Disconnect
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="rounded-xl bg-[var(--secondary)] p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Sync Frequency</p>
                <p className="text-sm font-semibold text-foreground capitalize">{connection.sync_frequency} at 2:00 AM</p>
              </div>
              <div className="rounded-xl bg-[var(--secondary)] p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Last Sync</p>
                <p className="text-sm font-semibold text-foreground">
                  {connection.last_sync_at
                    ? new Date(connection.last_sync_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                    : 'Never'
                  }
                </p>
              </div>
            </div>

            <button
              onClick={handleSyncNow}
              disabled={syncing}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-colors touch-target',
                'bg-[#2CA01C] hover:bg-[#228B17]',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sync Now
            </button>
          </div>

          {/* Sub-nav */}
          <div className="flex gap-2">
            <Link
              href="/settings/integrations/quickbooks/mapping"
              className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-foreground hover:bg-[var(--secondary)] transition-colors touch-target"
            >
              <Map className="h-4 w-4" />
              Chart of Accounts Mapping
            </Link>
            <Link
              href="/settings/integrations/quickbooks/log"
              className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-foreground hover:bg-[var(--secondary)] transition-colors touch-target"
            >
              <ScrollText className="h-4 w-4" />
              Sync Log
            </Link>
          </div>
        </>
      ) : (
        /* Disconnected State */
        <div className="rounded-2xl border border-[var(--border)] bg-white p-8 text-center space-y-6">
          <div className="flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#2CA01C]/10">
              <BookOpen className="h-10 w-10 text-[#2CA01C]" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Connect to QuickBooks Online</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
              Automatically sync your daily sales to QuickBooks. Food revenue, beverage revenue, tips, tax, and refunds are mapped to your chart of accounts as journal entries.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={!isSandbox}
              onClick={() => setIsSandbox(!isSandbox)}
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors touch-target',
                !isSandbox ? 'bg-[var(--primary)]' : 'bg-[var(--muted)]'
              )}
            >
              <span className={cn('pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg transition-transform', !isSandbox ? 'translate-x-5' : 'translate-x-0')} />
            </button>
            <span className="text-xs text-muted-foreground">{isSandbox ? 'Sandbox Mode' : 'Production Mode'}</span>
          </div>

          <button
            onClick={handleConnect}
            disabled={connecting}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold text-white transition-colors touch-target',
              'bg-[#2CA01C] hover:bg-[#228B17] shadow-sm',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            Connect to QuickBooks
          </button>
        </div>
      )}
    </div>
  )
}
