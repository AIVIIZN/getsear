'use client'

import * as React from 'react'
import { AlertTriangle, CheckCircle2, Clock3, PlugZap, RefreshCw, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui-v2/Button'
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui-v2/Card'
import { Badge } from '@/components/ui-v2/data/Badge'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import { EmptyState } from '@/components/ui-v2/feedback/EmptyState'
import { Text } from '@/components/ui-v2/inputs/Text'
import { Select } from '@/components/ui-v2/inputs/Select'
import { cn } from '@/lib/utils'

type HealthSummary = { severity: 'ok' | 'warning' | 'critical'; label: string; detail: string }
type IntegrationEvent = { id: string; event_type: string; direction: string; status: string; records_imported: number; records_failed: number; error_message?: string | null; occurred_at: string }
type WebhookEvent = { id: string; event_name: string; delivery_id?: string | null; signature_status: string; processing_status: string; error_message?: string | null; received_at: string }
type IntegrationConnection = {
  id: string
  category: string
  provider: string
  display_name: string
  status: string
  sync_status: string
  webhook_status: string
  credential_ref?: string | null
  credential_expires_at?: string | null
  last_sync_at?: string | null
  last_error?: string | null
  records_imported_count: number
  records_failed_count: number
  health_summary: HealthSummary
  crm_integration_events?: IntegrationEvent[]
  crm_webhook_events?: WebhookEvent[]
}

const categories = [
  'email',
  'sms',
  'reservations',
  'online_ordering',
  'delivery',
  'accounting',
  'gift_cards',
  'reviews',
  'data_warehouse',
  'webhooks',
  'automation',
]

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(json.error ?? 'Request failed')
  return json as T
}

function titleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Not yet'
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function healthVariant(severity: HealthSummary['severity']) {
  if (severity === 'ok') return 'success'
  if (severity === 'warning') return 'warning'
  return 'danger'
}

function HealthIcon({ severity }: { severity: HealthSummary['severity'] }) {
  if (severity === 'ok') return <CheckCircle2 className="h-4 w-4" />
  if (severity === 'warning') return <Clock3 className="h-4 w-4" />
  return <AlertTriangle className="h-4 w-4" />
}

export default function CrmIntegrationsPage() {
  const [connections, setConnections] = React.useState<IntegrationConnection[]>([])
  const [state, setState] = React.useState<'loading' | 'ready' | 'error' | 'permission'>('loading')
  const [saveState, setSaveState] = React.useState<'idle' | 'saving'>('idle')
  const [form, setForm] = React.useState({
    category: 'webhooks',
    provider: 'restaurant-webhook',
    display_name: 'Restaurant webhook',
    credential_ref: 'CRM_WEBHOOK_SIGNING_SECRET',
  })

  const loadConnections = React.useCallback(async () => {
    setState('loading')
    try {
      const json = await fetchJson<{ data: IntegrationConnection[] }>('/api/crm/integrations?limit=50')
      setConnections(json.data)
      setState('ready')
    } catch (error) {
      setState(error instanceof Error && /Forbidden|Unauthorized/i.test(error.message) ? 'permission' : 'error')
    }
  }, [])

  React.useEffect(() => {
    loadConnections()
  }, [loadConnections])

  async function saveConnection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaveState('saving')
    try {
      await fetchJson('/api/crm/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          provider: form.provider.trim().toLowerCase(),
          status: 'connected',
          sync_status: 'idle',
          webhook_status: form.category === 'webhooks' ? 'active' : 'not_configured',
          config: { api_surface: ['guest', 'order', 'loyalty', 'campaign', 'report', 'webhook'] },
          health: {},
        }),
      })
      await loadConnections()
    } finally {
      setSaveState('idle')
    }
  }

  const totals = connections.reduce(
    (acc, connection) => {
      acc.imported += connection.records_imported_count ?? 0
      acc.failed += connection.records_failed_count ?? 0
      if (connection.health_summary.severity === 'critical') acc.critical += 1
      if (connection.health_summary.severity === 'warning') acc.warning += 1
      return acc
    },
    { imported: 0, failed: 0, critical: 0, warning: 0 },
  )

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      <div className="flex flex-col gap-[var(--space-4)] lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
            CRM Integrations
          </h2>
          <p className="mt-[var(--space-1)] max-w-3xl text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
            Health for guest, order, loyalty, campaign, report, data warehouse, and inbound webhook connections.
          </p>
        </div>
        <Button variant="secondary" size="md" onClick={loadConnections} leadingIcon={<RefreshCw />}>
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-[var(--space-4)] md:grid-cols-4">
        {[
          ['Connections', connections.length],
          ['Needs attention', totals.critical + totals.warning],
          ['Records imported', totals.imported],
          ['Records failed', totals.failed],
        ].map(([label, value]) => (
          <Card key={label} padding="compact">
            <p className="text-[length:var(--type-caption-1-size)] font-[var(--weight-medium)] text-[color:var(--color-text-muted)]">{label}</p>
            <p className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">{value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Register connection</CardTitle>
          <CardDescription>Creates a real CRM integration connection and records setup in the health event log.</CardDescription>
        </CardHeader>
        <form className="grid grid-cols-1 gap-[var(--space-3)] lg:grid-cols-5" onSubmit={saveConnection}>
          <Select
            label="Category"
            value={form.category}
            options={categories.map((category) => ({ value: category, label: titleCase(category) }))}
            onChange={(category) => setForm((current) => ({ ...current, category }))}
          />
          <Text label="Provider key" value={form.provider} onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value }))} />
          <Text label="Display name" value={form.display_name} onChange={(event) => setForm((current) => ({ ...current, display_name: event.target.value }))} />
          <Text label="Secret env ref" value={form.credential_ref} onChange={(event) => setForm((current) => ({ ...current, credential_ref: event.target.value }))} />
          <div className="flex items-end">
            <Button type="submit" size="md" loading={saveState === 'saving'} leadingIcon={<PlugZap />} className="w-full">
              Save
            </Button>
          </div>
        </form>
      </Card>

      {state === 'loading' ? (
        <div className="grid grid-cols-1 gap-[var(--space-4)] xl:grid-cols-2">
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      ) : state === 'permission' ? (
        <EmptyState icon={ShieldCheck} title="CRM integration access is restricted" description="Ask an owner or admin to review integration health and webhook setup." />
      ) : state === 'error' ? (
        <EmptyState icon={AlertTriangle} title="Integration health unavailable" description="Refresh the page after the connection service is reachable." action={{ label: 'Retry', onClick: loadConnections }} />
      ) : connections.length === 0 ? (
        <EmptyState icon={PlugZap} title="No CRM integrations yet" description="Register the first provider to begin tracking sync health, webhook signatures, imported records, and failures." />
      ) : (
        <div className="grid grid-cols-1 gap-[var(--space-4)] xl:grid-cols-2">
          {connections.map((connection) => (
            <Card key={connection.id}>
              <CardHeader className="flex-row items-start justify-between gap-[var(--space-3)]">
                <div>
                  <CardTitle>{connection.display_name}</CardTitle>
                  <CardDescription>{titleCase(connection.category)} - {connection.provider}</CardDescription>
                </div>
                <Badge variant={healthVariant(connection.health_summary.severity)} shape="pill">
                  <HealthIcon severity={connection.health_summary.severity} />
                  {connection.health_summary.label}
                </Badge>
              </CardHeader>
              <CardBody>
                <p className="text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">{connection.health_summary.detail}</p>
                <div className="grid grid-cols-2 gap-[var(--space-3)] md:grid-cols-4">
                  {[
                    ['Status', connection.status],
                    ['Sync', connection.sync_status],
                    ['Webhook', connection.webhook_status],
                    ['Last sync', formatDateTime(connection.last_sync_at)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-[var(--radius-sm)] bg-[color:var(--color-bg-muted)] p-[var(--space-3)]">
                      <p className="text-[length:var(--type-caption-2-size)] text-[color:var(--color-text-muted)]">{label}</p>
                      <p className="mt-[var(--space-1)] truncate text-[length:var(--type-footnote-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-[var(--space-3)] md:grid-cols-2">
                  <div>
                    <p className="mb-[var(--space-2)] text-[length:var(--type-caption-1-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">Recent sync events</p>
                    <div className="flex flex-col gap-[var(--space-2)]">
                      {(connection.crm_integration_events ?? []).length === 0 ? (
                        <div className="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)]">
                          No sync events recorded yet.
                        </div>
                      ) : (
                        (connection.crm_integration_events ?? []).slice(0, 3).map((event) => (
                          <div key={event.id} className="flex items-center justify-between gap-[var(--space-2)] rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-[var(--space-3)] py-[var(--space-2)]">
                            <span className="truncate text-[length:var(--type-caption-1-size)] text-[color:var(--color-text)]">{event.event_type}</span>
                            <Badge variant={event.status === 'succeeded' ? 'success' : 'danger'} size="sm">{event.status}</Badge>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="mb-[var(--space-2)] text-[length:var(--type-caption-1-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">Webhook verification</p>
                    <div className="flex flex-col gap-[var(--space-2)]">
                      {(connection.crm_webhook_events ?? []).length === 0 ? (
                        <div className="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)]">
                          No webhook deliveries received yet.
                        </div>
                      ) : (
                        (connection.crm_webhook_events ?? []).slice(0, 3).map((event) => (
                          <div key={event.id} className={cn('flex items-center justify-between gap-[var(--space-2)] rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-[var(--space-3)] py-[var(--space-2)]')}>
                            <span className="truncate text-[length:var(--type-caption-1-size)] text-[color:var(--color-text)]">{event.event_name}</span>
                            <Badge variant={event.signature_status === 'verified' ? 'success' : 'danger'} size="sm">{event.signature_status}</Badge>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
