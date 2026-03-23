'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
interface TopItemPoint {
  name: string
  quantity: number
  revenue: number
}

interface TopItemsChartProps {
  data: TopItemPoint[]
}

export type { TopItemPoint }

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-3 shadow-warm-md">
      <p className="text-sm font-medium mb-1">{label}</p>
      <p className="text-sm text-[var(--muted-foreground)]">
        Revenue: <span className="font-medium text-[var(--foreground)]">${payload[0].value.toLocaleString()}</span>
      </p>
    </div>
  )
}

export function TopItemsChart({ data }: TopItemsChartProps) {
  return (
    <Card className="shadow-warm-sm">
      <CardHeader>
        <CardTitle className="text-base">Top 10 Items</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 8, left: 4, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
                tickFormatter={(v: number) => `$${v}`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={false}
                width={110}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" fill="#16A34A" radius={[0, 4, 4, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
