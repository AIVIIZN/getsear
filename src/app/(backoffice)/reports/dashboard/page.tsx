'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui-v2/Card'
import { Button } from '@/components/ui-v2/Button'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import { EmptyState } from '@/components/ui-v2/feedback/EmptyState'
import { OwnerDashboardCard } from '@/components/reports/OwnerDashboardCard'
import { ComparisonArrow } from '@/components/reports/ComparisonArrow'
import { DollarSign, Users, AlertTriangle, Receipt, RefreshCw } from 'lucide-react'

interface DashboardData {
  today_revenue: number
  today_orders: number
  today_avg_check: number
  last_week_same_day_revenue: number
  revenue_change_pct: number
  labor_pct: number
  labor_is_high: boolean
  open_checks_count: number
  open_checks_total: number
  alerts: Array<{ type: string; message: string; severity: 'warning' | 'critical' }>
}

export default function OwnerDashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/reports/dashboard')
      if (res.ok) {
        const json = await res.json()
        if (json.data) setData(json.data)
      }
    } catch {
      // Silently fail on refresh
    } finally {
      setLoading(false)
      setLastRefresh(new Date())
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [fetchData])

  const laborColor = data
    ? data.labor_pct <= 30
      ? 'var(--color-success)'
      : data.labor_pct <= 35
        ? 'var(--color-warning)'
        : 'var(--color-danger)'
    : undefined

  return (
    <div
      className="p-[var(--space-3)] max-w-md mx-auto space-y-[var(--space-3)]"
      style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg)' }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[length:var(--type-title-3-size)] font-[var(--weight-bold)] text-[color:var(--color-text)]">Dashboard</h1>
          <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)]">
            Updated {lastRefresh.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </p>
        </div>
        <Button
          variant="secondary"
          size="md"
          onClick={fetchData}
          aria-label="Refresh dashboard"
          loading={loading}
          leadingIcon={<RefreshCw className="h-5 w-5" />}
        >
          Refresh
        </Button>
      </div>

      {loading && !data && (
        <div className="space-y-[var(--space-3)]">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} variant="card" />)}
        </div>
      )}

      {data && (
        <>
          <OwnerDashboardCard
            label="Today's Revenue"
            value={`$${data.today_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            icon={DollarSign}
            sublabel={`${data.today_orders} orders | $${data.today_avg_check.toFixed(2)} avg`}
            color="var(--color-primary)"
            onClick={() => router.push('/reports/sales')}
          />

          <Card padding="default">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[length:var(--type-caption-1-size)] font-[var(--weight-medium)] text-[color:var(--color-text-muted)] uppercase tracking-wide">vs Last Week</p>
                <div className="flex items-center gap-[var(--space-2)] mt-[var(--space-1)]">
                  <ComparisonArrow value={data.revenue_change_pct} size="lg" />
                </div>
              </div>
              <div className="text-right">
                <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)]">Same day last week</p>
                <p className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] tabular-nums mt-[var(--space-1)]">
                  ${data.last_week_same_day_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </Card>

          <OwnerDashboardCard
            label="Labor Cost %"
            value={`${data.labor_pct.toFixed(1)}%`}
            icon={Users}
            sublabel={data.labor_is_high ? 'Above target (30%)' : 'Within target'}
            color={laborColor}
            onClick={() => router.push('/reports/labor')}
          />

          <OwnerDashboardCard
            label="Open Checks"
            value={data.open_checks_count.toString()}
            icon={Receipt}
            sublabel={`$${data.open_checks_total.toLocaleString('en-US', { minimumFractionDigits: 2 })} outstanding`}
            onClick={() => router.push('/reports/sales')}
          />

          {data.alerts.length > 0 && (
            <div className="space-y-[var(--space-2)]">
              <p className="text-[length:var(--type-caption-1-size)] font-[var(--weight-medium)] text-[color:var(--color-text-muted)] uppercase tracking-wide px-[var(--space-1)]">
                Alerts ({data.alerts.length})
              </p>
              {data.alerts.map((alert, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    if (alert.type === 'cash') router.push('/reports/cash')
                    else if (alert.type === 'void') router.push('/reports/voids-comps')
                    else if (alert.type === 'labor') router.push('/reports/labor')
                  }}
                  className="btn-press w-full rounded-[var(--radius-md)] p-[var(--space-3)] text-left flex items-start gap-[var(--space-3)] border-l-4"
                  style={{
                    backgroundColor: alert.severity === 'critical' ? 'var(--color-danger-bg)' : 'var(--color-warning-bg)',
                    borderLeftColor: alert.severity === 'critical' ? 'var(--color-danger)' : 'var(--color-warning)',
                  }}
                >
                  <AlertTriangle
                    className="h-5 w-5 shrink-0 mt-0.5"
                    style={{ color: alert.severity === 'critical' ? 'var(--color-danger)' : 'var(--color-warning)' }}
                  />
                  <p className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)]">{alert.message}</p>
                </button>
              ))}
            </div>
          )}

          {data.alerts.length === 0 && (
            <Card padding="compact" className="bg-[color:var(--color-success-bg)] text-center">
              <p className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[color:var(--color-success)]">
                No active alerts
              </p>
            </Card>
          )}
        </>
      )}

      {!loading && !data && (
        <EmptyState icon={DollarSign} title="No data yet" description="Dashboard will populate once orders are processed today." />
      )}
    </div>
  )
}
