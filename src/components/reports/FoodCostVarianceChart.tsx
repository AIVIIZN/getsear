'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface FoodCostVarianceChartProps {
  data: Array<{ name: string; theoretical_cost: number; actual_cost: number; is_flagged: boolean }>
}

function VarianceTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-3 shadow-warm-md">
      <p className="text-sm font-medium mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="text-sm text-[var(--muted-foreground)]">
          {p.name}: <span className="font-medium" style={{ color: p.color }}>${p.value.toFixed(2)}</span>
        </p>
      ))}
    </div>
  )
}

export function FoodCostVarianceChart({ data }: FoodCostVarianceChartProps) {
  // Show top 15 items by variance
  const sorted = [...data]
    .sort((a, b) => Math.abs(b.actual_cost - b.theoretical_cost) - Math.abs(a.actual_cost - a.theoretical_cost))
    .slice(0, 15)
    .map(d => ({
      name: d.name.length > 20 ? d.name.substring(0, 18) + '...' : d.name,
      theoretical_cost: d.theoretical_cost,
      actual_cost: d.actual_cost,
      is_flagged: d.is_flagged,
    }))

  return (
    <Card className="shadow-warm-sm">
      <CardHeader>
        <CardTitle className="text-base">Theoretical vs Actual Cost (Top 15 by Variance)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} tickFormatter={(v: number) => `$${v}`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} width={120} />
              <Tooltip content={<VarianceTooltip />} />
              <Legend />
              <Bar dataKey="theoretical_cost" name="Theoretical" fill="#2563EB" radius={[0, 2, 2, 0]} maxBarSize={16} />
              <Bar dataKey="actual_cost" name="Actual" radius={[0, 2, 2, 0]} maxBarSize={16}>
                {sorted.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.is_flagged ? '#DC2626' : '#D97706'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
