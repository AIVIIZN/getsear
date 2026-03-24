'use client'

import {
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
} from 'recharts'
import type { Prediction } from '@/stores/ai-store'

interface PredictionChartProps {
  predictions: Prediction[]
  height?: number
}

export function PredictionChart({ predictions, height = 280 }: PredictionChartProps) {
  if (predictions.length === 0) return null

  const chartData = predictions.map((p) => {
    const predicted = p.predictedRevenueCents / 100
    const confidence = p.confidence
    const bandWidth = predicted * (1 - confidence) * 0.5

    return {
      date: new Date(p.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      day: p.dayOfWeek.slice(0, 3),
      predicted: Math.round(predicted),
      actual: p.actualRevenueCents !== null ? Math.round(p.actualRevenueCents / 100) : null,
      upper: Math.round(predicted + bandWidth),
      lower: Math.round(predicted - bandWidth),
    }
  })

  return (
    <div
      className="rounded-2xl bg-white p-4"
      style={{
        boxShadow: 'var(--shadow-sm)',
        border: '0.5px solid var(--border)',
      }}
    >
      <p className="text-callout font-semibold text-foreground mb-3">
        Revenue Forecast vs Actual
      </p>

      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(60,60,67,0.08)" />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 12, fill: '#8E8E93' }}
              axisLine={{ stroke: 'rgba(60,60,67,0.12)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#8E8E93' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                background: '#fff',
                border: '0.5px solid rgba(60,60,67,0.12)',
                borderRadius: '10px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                fontSize: '13px',
              }}
              formatter={(value, name) => [
                `$${Number(value).toLocaleString()}`,
                name === 'predicted' ? 'Forecast' : name === 'actual' ? 'Actual' : String(name),
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
              formatter={(value) =>
                value === 'predicted' ? 'Forecast' : value === 'actual' ? 'Actual' : value
              }
            />

            {/* Confidence band */}
            <Area
              type="monotone"
              dataKey="upper"
              stroke="none"
              fill="#007AFF"
              fillOpacity={0.08}
              name="upper"
              legendType="none"
            />
            <Area
              type="monotone"
              dataKey="lower"
              stroke="none"
              fill="#FFFFFF"
              fillOpacity={1}
              name="lower"
              legendType="none"
            />

            {/* Predicted line */}
            <Line
              type="monotone"
              dataKey="predicted"
              stroke="#007AFF"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={{ fill: '#007AFF', r: 3 }}
              name="predicted"
            />

            {/* Actual line */}
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#007AFF"
              strokeWidth={2.5}
              dot={{ fill: '#007AFF', r: 4 }}
              name="actual"
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
