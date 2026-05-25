'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  ChefHat,
  Clock,
  CreditCard,
  DollarSign,
  Printer,
  RefreshCw,
  RadioTower,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui-v2/Button'
import { Card } from '@/components/ui-v2/Card'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import type { CockpitSeverity, FridayNightData, FridayNightMetric } from '@/lib/operations/friday-night'
import { cn } from '@/lib/utils'

const metricIcons = {
  live_sales: DollarSign,
  labor: Users,
  ticket_times: Clock,
  voids_comps: ShieldAlert,
  offline_terminals: RadioTower,
  payment_failures: CreditCard,
  printer_failures: Printer,
  kds_stress: ChefHat,
} as const

const metricKeys = [
  'live_sales',
  'labor',
  'ticket_times',
  'voids_comps',
  'offline_terminals',
  'payment_failures',
  'printer_failures',
  'kds_stress',
] as const

function severityClass(severity: CockpitSeverity): string {
  if (severity === 'critical') return 'border-[color:var(--color-danger)] bg-[color:var(--color-danger-bg)] text-[color:var(--color-danger)]'
  if (severity === 'watch') return 'border-[color:var(--color-warning)] bg-[color:var(--color-warning-bg)] text-[color:var(--color-warning)]'
  return 'border-[color:var(--color-success)] bg-[color:var(--color-success-bg)] text-[color:var(--color-success)]'
}

function severityLabel(severity: CockpitSeverity): string {
  if (severity === 'critical') return 'Critical'
  if (severity === 'watch') return 'Watch'
  return 'Healthy'
}

function MetricCard({
  metric,
  metricKey,
}: {
  metric: FridayNightMetric
  metricKey: keyof typeof metricIcons
}) {
  const Icon = metricIcons[metricKey]

  return (
    <Card padding="default" className="min-h-[168px]">
      <div className="flex h-full flex-col justify-between gap-[var(--space-4)]">
        <div className="flex items-start justify-between gap-[var(--space-3)]">
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] border',
              severityClass(metric.severity)
            )}
          >
            <Icon className="h-6 w-6" />
          </div>
          <span
            className={cn(
              'rounded-full border px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--type-caption-1-size)] font-[var(--weight-semibold)]',
              severityClass(metric.severity)
            )}
          >
            {severityLabel(metric.severity)}
          </span>
        </div>
        <div>
          <p className="text-[length:var(--type-caption-1-size)] font-[var(--weight-semibold)] uppercase tracking-wide text-[color:var(--color-text-muted)]">
            {metric.label}
          </p>
          <p className="mt-[var(--space-1)] text-[length:var(--type-title-2-size)] font-[var(--weight-bold)] tabular-nums text-[color:var(--color-text)]">
            {metric.value}
          </p>
          <p className="mt-[var(--space-1)] text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)]">
            {metric.detail}
          </p>
        </div>
      </div>
    </Card>
  )
}

function MetricSkeletons() {
  return (
    <div className="grid gap-[var(--space-4)] md:grid-cols-2 xl:grid-cols-4">
      {metricKeys.map((key) => (
        <Skeleton key={key} variant="card" className="min-h-[168px]" />
      ))}
    </div>
  )
}

export default function FridayNightPage() {
  const [data, setData] = useState<FridayNightData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCockpit = useCallback(async () => {
    setError(null)
    try {
      const response = await fetch('/api/operations/friday-night', { cache: 'no-store' })
      if (!response.ok) throw new Error('Friday Night Mode is unavailable')
      const json = await response.json()
      setData(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Friday Night Mode is unavailable')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCockpit()
    const interval = setInterval(fetchCockpit, 30000)
    return () => clearInterval(interval)
  }, [fetchCockpit])

  const criticalCount = data
    ? metricKeys.filter((key) => data[key].severity === 'critical').length
    : 0
  const watchCount = data
    ? metricKeys.filter((key) => data[key].severity === 'watch').length
    : 0

  return (
    <div className="space-y-[var(--space-6)]">
      <section className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-[var(--space-6)] shadow-[var(--shadow-sm)]">
        <div className="flex flex-col gap-[var(--space-4)] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[length:var(--type-caption-1-size)] font-[var(--weight-semibold)] uppercase tracking-wide text-[color:var(--color-text-muted)]">
              Owner and manager cockpit
            </p>
            <h1 className="mt-[var(--space-1)] text-[length:var(--type-title-1-size)] font-[var(--weight-bold)] tracking-tight text-[color:var(--color-text)]">
              Friday Night Mode
            </h1>
            <p className="mt-[var(--space-2)] max-w-3xl text-[length:var(--type-body-size)] text-[color:var(--color-text-muted)]">
              One live command view for sales pace, labor, kitchen stress, payments, printers, terminals, and the people who need a manager now.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-[var(--space-2)]">
            <span className={cn('rounded-full border px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--type-caption-1-size)] font-[var(--weight-semibold)]', severityClass(criticalCount > 0 ? 'critical' : watchCount > 0 ? 'watch' : 'healthy'))}>
              {criticalCount > 0 ? `${criticalCount} critical` : watchCount > 0 ? `${watchCount} watch` : 'Service steady'}
            </span>
            <Button
              variant="secondary"
              size="md"
              onClick={fetchCockpit}
              loading={loading}
              leadingIcon={<RefreshCw className="h-5 w-5" />}
            >
              Refresh
            </Button>
          </div>
        </div>
        {data && (
          <p className="mt-[var(--space-4)] text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)]">
            Updated {new Date(data.updated_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </p>
        )}
      </section>

      {error && (
        <Card padding="default" className="border-[color:var(--color-danger)] bg-[color:var(--color-danger-bg)]">
          <div className="flex items-start gap-[var(--space-3)]">
            <AlertTriangle className="h-5 w-5 shrink-0 text-[color:var(--color-danger)]" />
            <div>
              <p className="font-[var(--weight-semibold)] text-[color:var(--color-danger)]">Cockpit failed to load</p>
              <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)]">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {loading && !data ? (
        <MetricSkeletons />
      ) : data ? (
        <>
          <div className="grid gap-[var(--space-4)] md:grid-cols-2 xl:grid-cols-4">
            {metricKeys.map((key) => (
              <MetricCard key={key} metricKey={key} metric={data[key]} />
            ))}
          </div>

          <div className="grid gap-[var(--space-4)] xl:grid-cols-[1.25fr_0.75fr]">
            <Card padding="default">
              <div className="flex items-center justify-between gap-[var(--space-3)]">
                <div>
                  <p className="text-[length:var(--type-caption-1-size)] font-[var(--weight-semibold)] uppercase tracking-wide text-[color:var(--color-text-muted)]">
                    Who needs help now
                  </p>
                  <h2 className="mt-[var(--space-1)] text-[length:var(--type-title-3-size)] font-[var(--weight-bold)] text-[color:var(--color-text)]">
                    Manager dispatch queue
                  </h2>
                </div>
                <Activity className="h-6 w-6 text-[color:var(--color-primary)]" />
              </div>

              <div className="mt-[var(--space-4)] space-y-[var(--space-3)]">
                {data.needs_help_now.length > 0 ? (
                  data.needs_help_now.map((alert) => (
                    <Link
                      key={alert.id}
                      href={alert.href}
                      className="block rounded-[var(--radius-md)] border border-[color:var(--color-border)] p-[var(--space-4)] transition-colors hover:bg-[color:var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-border-focus)] active:bg-[color:var(--color-surface-active)]"
                    >
                      <div className="flex flex-col gap-[var(--space-3)] sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-[var(--weight-semibold)] text-[color:var(--color-text)]">{alert.title}</p>
                          <p className="mt-[var(--space-1)] text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)]">{alert.detail}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-[var(--space-2)]">
                          <span className="rounded-full bg-[color:var(--color-bg-muted)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--type-caption-1-size)] font-[var(--weight-semibold)] text-[color:var(--color-text-muted)]">
                            {alert.owner}
                          </span>
                          <span className={cn('rounded-full border px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--type-caption-1-size)] font-[var(--weight-semibold)]', severityClass(alert.severity))}>
                            {severityLabel(alert.severity)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-success-bg)] p-[var(--space-5)]">
                    <p className="font-[var(--weight-semibold)] text-[color:var(--color-success)]">No active dispatches</p>
                    <p className="mt-[var(--space-1)] text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)]">
                      Service is inside target across tickets, payments, printers, and terminals.
                    </p>
                  </div>
                )}
              </div>
            </Card>

            <Card padding="default">
              <p className="text-[length:var(--type-caption-1-size)] font-[var(--weight-semibold)] uppercase tracking-wide text-[color:var(--color-text-muted)]">
                Service pulse
              </p>
              <div className="mt-[var(--space-4)] space-y-[var(--space-3)]">
                {data.service_pulse.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-[var(--space-3)] rounded-[var(--radius-md)] border border-[color:var(--color-border)] p-[var(--space-3)]">
                    <div>
                      <p className="font-[var(--weight-semibold)] text-[color:var(--color-text)]">{item.label}</p>
                      <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)]">{item.value}</p>
                    </div>
                    <span className={cn('rounded-full border px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--type-caption-1-size)] font-[var(--weight-semibold)]', severityClass(item.severity))}>
                      {severityLabel(item.severity)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  )
}
