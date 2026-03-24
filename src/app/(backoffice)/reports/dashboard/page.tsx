'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [fetchData])

  const laborColor = data
    ? data.labor_pct <= 30 ? '#16A34A' : data.labor_pct <= 35 ? '#D97706' : '#DC2626'
    : undefined

  return (
    <div className="p-4 max-w-md mx-auto space-y-4" style={{ minHeight: '100vh', backgroundColor: 'var(--background)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          <p className="text-xs text-[var(--muted-foreground)]">
            Updated {lastRefresh.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </p>
        </div>
        <button type="button" onClick={fetchData} className="p-2.5 rounded-xl bg-white shadow-warm-sm active:scale-95 transition-transform" style={{ minWidth: 44, minHeight: 44 }}>
          <RefreshCw className={`h-5 w-5 text-[var(--muted-foreground)] ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && !data && (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-24 rounded-2xl bg-white animate-pulse shadow-warm-sm" />
          ))}
        </div>
      )}

      {data && (
        <>
          {/* Revenue — Big hero card */}
          <OwnerDashboardCard
            label="Today's Revenue"
            value={`$${data.today_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            icon={DollarSign}
            sublabel={`${data.today_orders} orders | $${data.today_avg_check.toFixed(2)} avg`}
            color="#007AFF"
            onClick={() => router.push('/reports/sales')}
          />

          {/* Comparison */}
          <div className="rounded-2xl bg-white p-5 shadow-warm-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">vs Last Week</p>
                <div className="flex items-center gap-2 mt-1">
                  <ComparisonArrow value={data.revenue_change_pct} size="lg" />
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-[var(--muted-foreground)]">Same day last week</p>
                <p className="text-sm font-medium tabular-nums mt-0.5">
                  ${data.last_week_same_day_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {/* Labor */}
          <OwnerDashboardCard
            label="Labor Cost %"
            value={`${data.labor_pct.toFixed(1)}%`}
            icon={Users}
            sublabel={data.labor_is_high ? 'Above target (30%)' : 'Within target'}
            color={laborColor}
            onClick={() => router.push('/reports/labor')}
          />

          {/* Open Checks */}
          <OwnerDashboardCard
            label="Open Checks"
            value={data.open_checks_count.toString()}
            icon={Receipt}
            sublabel={`$${data.open_checks_total.toLocaleString('en-US', { minimumFractionDigits: 2 })} outstanding`}
            onClick={() => router.push('/reports/sales')}
          />

          {/* Alerts */}
          {data.alerts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide px-1">
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
                  className="w-full rounded-2xl p-4 shadow-warm-sm active:scale-[0.98] transition-transform text-left flex items-start gap-3"
                  style={{
                    backgroundColor: alert.severity === 'critical' ? '#FEF2F2' : '#FFFBEB',
                    borderLeft: `4px solid ${alert.severity === 'critical' ? '#DC2626' : '#D97706'}`,
                  }}
                >
                  <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: alert.severity === 'critical' ? '#DC2626' : '#D97706' }} />
                  <p className="text-sm font-medium">{alert.message}</p>
                </button>
              ))}
            </div>
          )}

          {data.alerts.length === 0 && (
            <div className="rounded-2xl bg-green-50 p-4 text-center">
              <p className="text-sm font-medium text-green-700">No active alerts</p>
            </div>
          )}
        </>
      )}

      {!loading && !data && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <DollarSign className="h-12 w-12 text-[var(--muted-foreground)] mb-4" />
          <h3 className="text-lg font-medium mb-1">No data yet</h3>
          <p className="text-sm text-[var(--muted-foreground)]">Dashboard will populate once orders are processed today.</p>
        </div>
      )}
    </div>
  )
}
