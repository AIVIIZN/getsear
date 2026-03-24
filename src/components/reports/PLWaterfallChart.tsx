'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface PLWaterfallChartProps {
  revenue: number
  cogs: number
  labor: number
  grossProfit: number
}

function WaterfallTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; displayValue: number; pct: string } }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-3 shadow-warm-md">
      <p className="text-sm font-medium mb-1">{d.name}</p>
      <p className="text-sm text-[var(--muted-foreground)]">
        Amount: <span className="font-medium">${Math.abs(d.displayValue).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
      </p>
      <p className="text-sm text-[var(--muted-foreground)]">
        {d.pct}
      </p>
    </div>
  )
}

export function PLWaterfallChart({ revenue, cogs, labor, grossProfit }: PLWaterfallChartProps) {
  // Build waterfall data
  // Each bar has an invisible base + visible portion
  const data = [
    {
      name: 'Revenue',
      base: 0,
      value: revenue,
      displayValue: revenue,
      fill: '#007AFF',
      pct: '100%',
    },
    {
      name: 'COGS',
      base: revenue - cogs,
      value: cogs,
      displayValue: -cogs,
      fill: '#DC2626',
      pct: revenue > 0 ? `${((cogs / revenue) * 100).toFixed(1)}% of revenue` : '0%',
    },
    {
      name: 'Labor',
      base: revenue - cogs - labor,
      value: labor,
      displayValue: -labor,
      fill: '#D97706',
      pct: revenue > 0 ? `${((labor / revenue) * 100).toFixed(1)}% of revenue` : '0%',
    },
    {
      name: 'Gross Profit',
      base: 0,
      value: grossProfit,
      displayValue: grossProfit,
      fill: grossProfit >= 0 ? '#16A34A' : '#DC2626',
      pct: revenue > 0 ? `${((grossProfit / revenue) * 100).toFixed(1)}% margin` : '0%',
    },
  ]

  return (
    <Card className="shadow-warm-sm">
      <CardHeader>
        <CardTitle className="text-base">P&L Waterfall</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--foreground)', fontWeight: 500 }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
              <Tooltip content={<WaterfallTooltip />} cursor={false} />
              <Bar dataKey="base" stackId="waterfall" fill="transparent" />
              <Bar dataKey="value" stackId="waterfall" radius={[4, 4, 0, 0]} maxBarSize={60}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
