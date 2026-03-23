'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { DeliveryLogTable, type DeliveryLogEntry, type DeliveryStatus } from '@/components/integrations/DeliveryLogTable'

export default function WebhookDeliveryLogPage() {
  const [entries, setEntries] = useState<DeliveryLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | 'all'>('all')
  const [total, setTotal] = useState(0)

  const locationId = '00000000-0000-0000-0000-000000000001'

  const fetchLog = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ location_id: locationId, limit: '50' })
      if (statusFilter !== 'all') params.set('status', statusFilter)

      const res = await fetch(`/api/integrations/webhooks/log?${params}`)
      const json = await res.json()
      if (json.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setEntries(json.data.map((e: any) => ({
          id: e.id,
          timestamp: e.created_at,
          recipient: e.endpoint_name ?? e.endpoint_url,
          templateType: e.event_type,
          status: e.status,
          responseCode: e.response_status,
          responseTimeMs: e.response_time_ms,
          requestPayload: e.request_payload,
          responseBody: e.response_body,
          error: e.error_message,
          attempt: e.attempt,
        })))
        setTotal(json.meta?.total ?? 0)
      }
    } catch {
      toast.error('Failed to load delivery log')
    } finally {
      setLoading(false)
    }
  }, [locationId, statusFilter])

  useEffect(() => { fetchLog() }, [fetchLog])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/settings/integrations/webhooks"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white hover:bg-[var(--secondary)] transition-colors touch-target"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Webhook Delivery Log</h2>
          <p className="text-sm text-muted-foreground">{total} total deliveries</p>
        </div>
      </div>

      <DeliveryLogTable
        entries={entries}
        loading={loading}
        onRefresh={fetchLog}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        showPayload={true}
        type="webhook"
      />
    </div>
  )
}
