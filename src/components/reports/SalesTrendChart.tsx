'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export interface SalesTrendPoint {
  date: string
  gross_sales: number
  net_sales: number
}

interface SalesTrendChartProps {
  data: SalesTrendPoint[]
}

function SalesTooltip({
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

export default function SalesTrendChart({ data }: SalesTrendChartProps) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--color-border)' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
          />
          <Tooltip content={<SalesTooltip />} />
          <Line
            type="monotone"
            dataKey="gross_sales"
            name="Gross Sales"
            stroke="var(--color-primary)"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="net_sales"
            name="Net Sales"
            stroke="var(--color-primary-active)"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
