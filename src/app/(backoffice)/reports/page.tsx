'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { KPICardSkeleton } from '@/components/shared/LoadingSkeleton'
import { BarChart3, DollarSign, ShoppingCart, Users, Clock } from 'lucide-react'

const KPI_CARDS = [
  { label: 'Total Sales', value: '$0.00', change: '+0%', icon: DollarSign, positive: true },
  { label: 'Orders', value: '0', change: '+0%', icon: ShoppingCart, positive: true },
  { label: 'Avg Check', value: '$0.00', change: '+0%', icon: BarChart3, positive: true },
  { label: 'Labor %', value: '0%', change: '0%', icon: Users, positive: true },
]

export default function ReportsPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reports Dashboard</h1>
        <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Clock className="h-4 w-4" />
          Today
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        {KPI_CARDS.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.label} className="shadow-warm-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[var(--muted-foreground)]">{kpi.label}</span>
                  <Icon className="h-4 w-4 text-[var(--muted-foreground)]" />
                </div>
                <div className="text-2xl font-bold tabular-nums">{kpi.value}</div>
                <div className={`text-xs mt-1 ${kpi.positive ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                  {kpi.change} vs yesterday
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Charts placeholder */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="shadow-warm-sm">
          <CardHeader>
            <CardTitle className="text-base">Hourly Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-[var(--muted-foreground)]">
              Chart will render here with Recharts
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-warm-sm">
          <CardHeader>
            <CardTitle className="text-base">Payment Mix</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-[var(--muted-foreground)]">
              Donut chart will render here
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
