'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatDuration } from '@/lib/reports/constants'

export interface SpeedTrendPoint {
  date: string
  avg_seconds: number
  ticket_count: number
}

interface SpeedTrendChartProps {
  data: SpeedTrendPoint[]
}

export default function SpeedTrendChart({ data }: SpeedTrendChartProps) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data.map(d => ({ ...d, date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }))}
          margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatDuration(v)} />
          <Tooltip formatter={(v) => formatDuration(Number(v))} />
          <Line type="monotone" dataKey="avg_seconds" name="Avg Time" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
