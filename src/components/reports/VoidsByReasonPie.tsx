'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

export interface VoidsByReasonPoint {
  reason: string
  type: string
  count: number
  total: number
}

interface VoidsByReasonPieProps {
  data: VoidsByReasonPoint[]
  colors: string[]
}

export default function VoidsByReasonPie({ data, colors }: VoidsByReasonPieProps) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={90}
            innerRadius={40}
            dataKey="total"
            nameKey="reason"
            strokeWidth={2}
            stroke="var(--color-surface)"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
          <Legend formatter={(v: string) => <span className="text-[length:var(--type-caption-1-size)]">{v}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
