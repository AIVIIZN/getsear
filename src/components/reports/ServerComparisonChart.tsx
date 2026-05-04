'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

export interface ServerComparisonPoint {
  name: string
  total_sales: number
  avg_check: number
}

interface ServerComparisonChartProps {
  data: ServerComparisonPoint[]
}

function ServerTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-[var(--space-3)] shadow-[var(--shadow-mid)]">
      <p className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] mb-[var(--space-1)]">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
          {p.name}:{' '}
          <span className="font-[var(--weight-medium)]" style={{ color: p.color }}>
            {p.name === 'Avg Tip %' ? `${p.value}%` : `$${p.value.toLocaleString()}`}
          </span>
        </p>
      ))}
    </div>
  )
}

export default function ServerComparisonChart({ data }: ServerComparisonChartProps) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} />
          <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v}`} />
          <Tooltip content={<ServerTooltip />} />
          <Legend />
          <Bar yAxisId="left" dataKey="total_sales" name="Total Sales" fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={40} />
          <Bar yAxisId="right" dataKey="avg_check" name="Avg Check" fill="#7C3AED" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
