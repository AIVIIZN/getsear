'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Package, AlertTriangle, FileText, TrendingDown, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { LowStockAlerts } from './LowStockAlerts'

interface DashboardKPIs {
  total_skus: number
  low_stock_count: number
  critical_count: number
  open_po_count: number
  food_cost_pct: number
}

interface RecentWaste {
  id: string
  item_name: string
  quantity: number
  unit: string
  reason: string
  dollar_value: number
  created_at: string
}

export function InventoryDashboard() {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null)
  const [recentWaste, setRecentWaste] = useState<RecentWaste[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const [itemsRes, alertsRes, wasteRes, foodCostRes, poRes] = await Promise.all([
        fetch('/api/inventory/items'),
        fetch('/api/inventory/alerts'),
        fetch('/api/inventory/waste?limit=5'),
        fetch('/api/inventory/food-cost?period=week'),
        fetch('/api/inventory/purchase-orders?status=submitted'),
      ])

      const [items, alerts, waste, foodCost, pos] = await Promise.all([
        itemsRes.json(),
        alertsRes.json(),
        wasteRes.json(),
        foodCostRes.json(),
        poRes.json(),
      ])

      setKpis({
        total_skus: items.data?.length ?? 0,
        low_stock_count: alerts.total ?? 0,
        critical_count: alerts.critical_count ?? 0,
        open_po_count: pos.data?.length ?? 0,
        food_cost_pct: foodCost.data?.current_food_cost_pct ?? 0,
      })

      setRecentWaste(waste.data ?? [])
    } catch {
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          icon={Package}
          label="Total SKUs"
          value={kpis?.total_skus ?? 0}
          color="text-blue-600"
          bgColor="bg-blue-50"
        />
        <KPICard
          icon={AlertTriangle}
          label="Low Stock Alerts"
          value={kpis?.low_stock_count ?? 0}
          color="text-amber-600"
          bgColor="bg-amber-50"
          subtitle={kpis?.critical_count ? `${kpis.critical_count} critical` : undefined}
          subtitleColor="text-red-600"
        />
        <KPICard
          icon={FileText}
          label="Open POs"
          value={kpis?.open_po_count ?? 0}
          color="text-indigo-600"
          bgColor="bg-indigo-50"
        />
        <KPICard
          icon={TrendingDown}
          label="Food Cost %"
          value={`${(kpis?.food_cost_pct ?? 0).toFixed(1)}%`}
          color={
            (kpis?.food_cost_pct ?? 0) > 35
              ? 'text-red-600'
              : (kpis?.food_cost_pct ?? 0) > 30
                ? 'text-amber-600'
                : 'text-green-600'
          }
          bgColor={
            (kpis?.food_cost_pct ?? 0) > 35
              ? 'bg-red-50'
              : (kpis?.food_cost_pct ?? 0) > 30
                ? 'bg-amber-50'
                : 'bg-green-50'
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alerts */}
        <LowStockAlerts compact />

        {/* Recent Waste */}
        <Card className="border-warm shadow-warm">
          <div className="flex items-center justify-between p-4 pb-2">
            <h3 className="font-semibold text-sm text-foreground">Recent Waste</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchDashboard}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
          <CardContent className="pt-0">
            {recentWaste.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No waste entries recorded
              </p>
            ) : (
              <div className="space-y-3">
                {recentWaste.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0"
                  >
                    <div>
                      <p className="font-medium text-foreground">{entry.item_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.quantity} {entry.unit} &middot;{' '}
                        <span className="capitalize">{entry.reason}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-red-600">
                        -${entry.dollar_value.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KPICard({
  icon: Icon,
  label,
  value,
  color,
  bgColor,
  subtitle,
  subtitleColor,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  color: string
  bgColor: string
  subtitle?: string
  subtitleColor?: string
}) {
  return (
    <Card className="border-warm shadow-warm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {label}
            </p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
            {subtitle && (
              <p className={`text-xs mt-0.5 ${subtitleColor ?? 'text-muted-foreground'}`}>
                {subtitle}
              </p>
            )}
          </div>
          <div className={`rounded-lg p-2 ${bgColor}`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
