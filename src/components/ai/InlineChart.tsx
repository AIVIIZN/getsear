'use client'

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { ChartData } from '@/stores/ai-store'

interface InlineChartProps {
  data: ChartData
}

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

// Recharts needs raw color values, not CSS variables
const CHART_HEX_COLORS = ['var(--color-primary)', 'var(--color-primary)', 'var(--color-success-strong)', 'var(--color-purple)', 'var(--color-warning-strong)']

export function InlineChart({ data }: InlineChartProps) {
  const { type, title, data: chartData, xKey, yKey, color } = data
  const primaryColor = color ?? 'var(--color-primary)'

  if (!chartData || chartData.length === 0) return null

  return (
    <div
      className="rounded-xl p-3"
      style={{
        backgroundColor: 'var(--background)',
        border: '0.5px solid var(--border)',
      }}
    >
      {title && (
        <p className="text-footnote font-semibold text-foreground mb-2">{title}</p>
      )}

      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          {type === 'bar' ? (
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(60,60,67,0.08)" />
              <XAxis
                dataKey={xKey}
                tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                axisLine={{ stroke: 'rgba(60,60,67,0.12)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-neutral-0)',
                  border: '0.5px solid rgba(60,60,67,0.12)',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  fontSize: '13px',
                }}
              />
              <Bar dataKey={yKey} fill={primaryColor} radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : type === 'line' ? (
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(60,60,67,0.08)" />
              <XAxis
                dataKey={xKey}
                tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                axisLine={{ stroke: 'rgba(60,60,67,0.12)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-neutral-0)',
                  border: '0.5px solid rgba(60,60,67,0.12)',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  fontSize: '13px',
                }}
              />
              <Line
                type="monotone"
                dataKey={yKey}
                stroke={primaryColor}
                strokeWidth={2}
                dot={{ fill: primaryColor, r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          ) : (
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                dataKey={yKey}
                nameKey={xKey}
                paddingAngle={2}
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={CHART_HEX_COLORS[index % CHART_HEX_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'var(--color-neutral-0)',
                  border: '0.5px solid rgba(60,60,67,0.12)',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  fontSize: '13px',
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px' }}
              />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
