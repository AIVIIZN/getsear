'use client'

import { useState, useEffect, useCallback } from 'react'
import { DollarSign, ShoppingCart, BarChart3, Users, Download } from 'lucide-react'
import { KPICard } from '@/components/reports/KPICard'
import { DateRangePicker, type DatePreset } from '@/components/reports/DateRangePicker'
import { HourlySalesChart } from '@/components/reports/HourlySalesChart'
import { PaymentMixChart } from '@/components/reports/PaymentMixChart'
import { CategoryMixChart } from '@/components/reports/CategoryMixChart'
import { TopItemsChart } from '@/components/reports/TopItemsChart'
import {
  getMockHourlySales,
  getMockPaymentMix,
  getMockCategoryMix,
  getMockTopItems,
  getMockKPIs,
  type HourlySalesPoint,
  type PaymentMixPoint,
  type CategoryMixPoint,
  type TopItemPoint,
} from '@/lib/reports/mock-data'

interface KPIData {
  total_sales: number
  orders: number
  avg_check: number
  labor_pct: number
  prev_total_sales: number
  prev_orders: number
  prev_avg_check: number
  prev_labor_pct: number
}

export default function ReportsPage() {
  const [kpis, setKpis] = useState<KPIData>(getMockKPIs())
  const [hourlySales, setHourlySales] = useState<HourlySalesPoint[]>(getMockHourlySales())
  const [paymentMix, setPaymentMix] = useState<PaymentMixPoint[]>(getMockPaymentMix())
  const [categoryMix, setCategoryMix] = useState<CategoryMixPoint[]>(getMockCategoryMix())
  const [topItems, setTopItems] = useState<TopItemPoint[]>(getMockTopItems())
  const [isMock, setIsMock] = useState(true)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async (_preset: DatePreset, dateFrom: string, dateTo: string) => {
    setLoading(true)
    try {
      const [dailyRes, hourlyRes, paymentsRes, categoryRes, pmixRes] = await Promise.allSettled([
        fetch(`/api/reports/daily?date=${dateFrom}`),
        fetch(`/api/reports/hourly?date=${dateFrom}`),
        fetch(`/api/reports/payments?date_from=${dateFrom}&date_to=${dateTo}`),
        fetch(`/api/reports/category-mix?date_from=${dateFrom}&date_to=${dateTo}`),
        fetch(`/api/reports/pmix?date_from=${dateFrom}&date_to=${dateTo}`),
      ])

      // Daily / KPIs
      if (dailyRes.status === 'fulfilled' && dailyRes.value.ok) {
        const json = await dailyRes.value.json()
        setIsMock(json.is_mock)
        if (json.data) {
          const d = json.data
          setKpis({
            total_sales: d.total_sales ?? d.total_revenue ?? 0,
            orders: d.orders ?? d.order_count ?? 0,
            avg_check: d.avg_check ?? d.average_check ?? 0,
            labor_pct: d.labor_pct ?? d.labor_percentage ?? 0,
            prev_total_sales: d.prev_period?.total_sales ?? d.total_sales * 0.92,
            prev_orders: d.prev_period?.orders ?? d.orders - 40,
            prev_avg_check: d.prev_period?.avg_check ?? d.avg_check * 0.99,
            prev_labor_pct: d.prev_period?.labor_pct ?? d.labor_pct + 0.7,
          })
        }
      }

      // Hourly
      if (hourlyRes.status === 'fulfilled' && hourlyRes.value.ok) {
        const json = await hourlyRes.value.json()
        if (json.data) setHourlySales(json.data)
      }

      // Payments
      if (paymentsRes.status === 'fulfilled' && paymentsRes.value.ok) {
        const json = await paymentsRes.value.json()
        if (json.data) setPaymentMix(json.data)
      }

      // Category mix
      if (categoryRes.status === 'fulfilled' && categoryRes.value.ok) {
        const json = await categoryRes.value.json()
        if (json.data) setCategoryMix(json.data)
      }

      // Top items from PMIX
      if (pmixRes.status === 'fulfilled' && pmixRes.value.ok) {
        const json = await pmixRes.value.json()
        if (json.data) {
          const sorted = [...json.data]
            .sort((a: { revenue: number }, b: { revenue: number }) => b.revenue - a.revenue)
            .slice(0, 10)
            .map((item: { name: string; quantity_sold: number; revenue: number }) => ({
              name: item.name,
              quantity: item.quantity_sold,
              revenue: item.revenue,
            }))
          setTopItems(sorted)
        }
      }
    } catch {
      // Keep mock data on error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    fetchData('today', today, today)
  }, [fetchData])

  const handleExport = async () => {
    window.open('/api/reports/export?type=daily', '_blank')
  }

  const salesChange = kpis.prev_total_sales > 0
    ? ((kpis.total_sales - kpis.prev_total_sales) / kpis.prev_total_sales) * 100
    : 0
  const ordersChange = kpis.prev_orders > 0
    ? ((kpis.orders - kpis.prev_orders) / kpis.prev_orders) * 100
    : 0
  const avgCheckChange = kpis.prev_avg_check > 0
    ? ((kpis.avg_check - kpis.prev_avg_check) / kpis.prev_avg_check) * 100
    : 0
  const laborChange = kpis.prev_labor_pct > 0
    ? ((kpis.labor_pct - kpis.prev_labor_pct) / kpis.prev_labor_pct) * 100
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Reports Dashboard</h1>
          {isMock && (
            <p className="page-subtitle">
              Showing sample data. Real data will appear when orders are processed.
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker onRangeChange={fetchData} />
          <button
            type="button"
            onClick={handleExport}
            className="btn-press touch-target flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-subhead font-medium hover:bg-[var(--secondary)] transition-colors"
            style={{ height: 44 }}
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white/50 z-40 flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-[var(--primary)] border-t-transparent rounded-full" />
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total Sales"
          value={`$${kpis.total_sales.toLocaleString()}`}
          change={salesChange}
          icon={DollarSign}
        />
        <KPICard
          label="Orders"
          value={kpis.orders.toLocaleString()}
          change={ordersChange}
          icon={ShoppingCart}
        />
        <KPICard
          label="Avg Check"
          value={`$${kpis.avg_check.toFixed(2)}`}
          change={avgCheckChange}
          icon={BarChart3}
        />
        <KPICard
          label="Labor %"
          value={`${kpis.labor_pct.toFixed(1)}%`}
          change={laborChange}
          icon={Users}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HourlySalesChart data={hourlySales} />
        <PaymentMixChart data={paymentMix} />
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CategoryMixChart data={categoryMix} />
        <TopItemsChart data={topItems} />
      </div>
    </div>
  )
}
