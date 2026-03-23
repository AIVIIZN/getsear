'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
interface PaymentMixPoint {
  method: string
  amount: number
  percentage: number
  color: string
}

interface PaymentMixChartProps {
  data: PaymentMixPoint[]
}

export type { PaymentMixPoint }

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: PaymentMixPoint }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-3 shadow-warm-md">
      <p className="text-sm font-medium mb-1">{d.method}</p>
      <p className="text-sm text-[var(--muted-foreground)]">
        Amount: <span className="font-medium text-[var(--foreground)]">${d.amount.toLocaleString()}</span>
      </p>
      <p className="text-sm text-[var(--muted-foreground)]">
        Share: <span className="font-medium text-[var(--foreground)]">{d.percentage}%</span>
      </p>
    </div>
  )
}

function CustomLabel(props: {
  cx?: number; cy?: number; midAngle?: number; innerRadius?: number; outerRadius?: number; percent?: number
}) {
  const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 } = props
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  if (percent < 0.08) return null
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export function PaymentMixChart({ data }: PaymentMixChartProps) {
  return (
    <Card className="shadow-warm-sm">
      <CardHeader>
        <CardTitle className="text-base">Payment Mix</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={CustomLabel}
                outerRadius={100}
                innerRadius={45}
                dataKey="amount"
                nameKey="method"
                strokeWidth={2}
                stroke="white"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value: string) => <span className="text-xs text-[var(--foreground)]">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
