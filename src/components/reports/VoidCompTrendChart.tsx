'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface VoidCompTrendChartProps {
  data: Array<{ date: string; voids: number; comps: number; discounts: number }>
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-3 shadow-warm-md">
      <p className="text-sm font-medium mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="text-sm text-[var(--muted-foreground)]">
          {p.name}: <span className="font-medium" style={{ color: p.color }}>${p.value.toLocaleString()}</span>
        </p>
      ))}
    </div>
  )
}

export function VoidCompTrendChart({ data }: VoidCompTrendChartProps) {
  const formatted = data.map(d => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }))

  return (
    <Card className="shadow-warm-sm">
      <CardHeader>
        <CardTitle className="text-base">Voids, Comps & Discounts by Day</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formatted} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v}`} />
              <Tooltip content={<ChartTooltip />} />
              <Legend />
              <Bar dataKey="voids" name="Voids" fill="#DC2626" radius={[2, 2, 0, 0]} stackId="a" maxBarSize={32} />
              <Bar dataKey="comps" name="Comps" fill="#D97706" radius={[0, 0, 0, 0]} stackId="a" maxBarSize={32} />
              <Bar dataKey="discounts" name="Discounts" fill="#2563EB" radius={[2, 2, 0, 0]} stackId="a" maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
