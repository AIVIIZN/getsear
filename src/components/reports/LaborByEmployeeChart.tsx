'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

export interface LaborByEmployeePoint {
  name: string
  labor_cost: number
  tips: number
}

interface LaborByEmployeeChartProps {
  data: LaborByEmployeePoint[]
}

function LaborTooltip({
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
      {payload.map((p) => (
        <p key={p.name} className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
          {p.name}:{' '}
          <span className="font-[var(--weight-medium)]" style={{ color: p.color }}>
            ${p.value.toLocaleString()}
          </span>
        </p>
      ))}
    </div>
  )
}

export default function LaborByEmployeeChart({ data }: LaborByEmployeeChartProps) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v}`} />
          <Tooltip content={<LaborTooltip />} />
          <Legend />
          <Bar dataKey="labor_cost" name="Labor Cost" fill="var(--color-primary-active)" radius={[4, 4, 0, 0]} maxBarSize={40} />
          <Bar dataKey="tips" name="Tips" fill="var(--color-success)" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
