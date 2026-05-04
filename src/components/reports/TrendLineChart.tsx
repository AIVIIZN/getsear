'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea,
} from 'recharts'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui-v2/Card'

interface TrendWeekDisplay {
  week_start: string
  week_number: number
  value: number
  is_deviation: boolean
  deviation_pct: number
}

interface TrendLineChartProps {
  data: TrendWeekDisplay[]
  metricLabel: string
  average: number
  formatValue?: (v: number) => string
}

function TrendTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; payload: TrendWeekDisplay }>; label?: string }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-3 shadow-warm-md">
      <p className="text-sm font-medium mb-1">Week {label}</p>
      <p className="text-sm text-[var(--muted-foreground)]">
        Value: <span className="font-medium">{payload[0].value.toLocaleString()}</span>
      </p>
      {d.is_deviation && (
        <p className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)]" style={{ color: d.deviation_pct > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {d.deviation_pct > 0 ? '+' : ''}{d.deviation_pct.toFixed(1)}% from avg
        </p>
      )}
    </div>
  )
}

export function TrendLineChart({ data, metricLabel, average, formatValue }: TrendLineChartProps) {
  const formatter = formatValue ?? ((v: number) => v.toLocaleString())
  const band = average * 0.1 // 10% band

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>13-Week {metricLabel} Trend</CardTitle>
          <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)]">
            Avg: {formatter(average)}
          </p>
        </div>
      </CardHeader>
      <CardBody>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              {/* Average band (shaded area) */}
              <ReferenceArea y1={average - band} y2={average + band} fill="var(--color-primary)" fillOpacity={0.06} />
              <XAxis dataKey="week_number" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} label={{ value: 'Week', position: 'insideBottomRight', offset: -5, style: { fontSize: 11, fill: 'var(--muted-foreground)' } }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatter(v)} />
              <Tooltip content={<TrendTooltip />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--color-primary)"
                strokeWidth={2.5}
                dot={(props) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const p = props as any
                  const cx = p.cx ?? 0
                  const cy = p.cy ?? 0
                  const point = p.payload as TrendWeekDisplay | undefined
                  const isDev = point?.is_deviation ?? false
                  const devPct = point?.deviation_pct ?? 0
                  return (
                    <circle
                      key={p.index}
                      cx={cx}
                      cy={cy}
                      r={isDev ? 6 : 4}
                      fill={isDev ? (devPct > 0 ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--color-primary)'}
                      stroke="white"
                      strokeWidth={2}
                    />
                  )
                }}
                activeDot={{ r: 7, stroke: '#007AFF', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  )
}
