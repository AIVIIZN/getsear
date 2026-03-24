'use client'

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Label,
  Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
interface PMIXItem {
  name: string
  category: string
  quantity_sold: number
  revenue: number
  food_cost_pct: number
  margin_pct: number
  classification: string
  popularity: number
  profitability: number
}

interface PMIXScatterProps {
  data: PMIXItem[]
}

export type { PMIXItem }

const CLASSIFICATION_COLORS: Record<string, string> = {
  Star: '#007AFF',
  Plowhorse: '#2563EB',
  Puzzle: '#7C3AED',
  Dog: '#9CA3AF',
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: PMIXItem }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-3 shadow-warm-md">
      <p className="text-sm font-medium mb-1">{d.name}</p>
      <p className="text-xs text-[var(--muted-foreground)] mb-2">{d.category}</p>
      <div className="space-y-0.5 text-sm">
        <p>Qty Sold: <span className="font-medium">{d.quantity_sold}</span></p>
        <p>Revenue: <span className="font-medium">${d.revenue.toLocaleString()}</span></p>
        <p>Margin: <span className="font-medium">{d.margin_pct}%</span></p>
        <p>Classification: <span className="font-medium" style={{ color: CLASSIFICATION_COLORS[d.classification] }}>{d.classification}</span></p>
      </div>
    </div>
  )
}

export function PMIXScatter({ data }: PMIXScatterProps) {
  const avgPopularity = data.length > 0
    ? data.reduce((s, d) => s + d.popularity, 0) / data.length
    : 50
  const avgProfitability = data.length > 0
    ? data.reduce((s, d) => s + d.profitability, 0) / data.length
    : 50

  return (
    <Card className="shadow-warm-sm">
      <CardHeader>
        <CardTitle className="text-base">Menu Engineering Matrix</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                type="number"
                dataKey="popularity"
                name="Popularity"
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
                domain={[0, 100]}
              >
                <Label value="Popularity (Qty Sold)" position="bottom" offset={0} style={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
              </XAxis>
              <YAxis
                type="number"
                dataKey="profitability"
                name="Profitability"
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
              >
                <Label value="Profitability (Margin %)" angle={-90} position="insideLeft" offset={10} style={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
              </YAxis>
              <ReferenceLine x={avgPopularity} stroke="var(--border)" strokeDasharray="5 5" />
              <ReferenceLine y={avgProfitability} stroke="var(--border)" strokeDasharray="5 5" />
              <Tooltip content={<CustomTooltip />} />
              <Scatter data={data} fill="#007AFF">
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={CLASSIFICATION_COLORS[entry.classification]}
                    r={Math.max(6, Math.min(14, entry.revenue / 100))}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-2">
          {Object.entries(CLASSIFICATION_COLORS).map(([label, color]) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-[var(--muted-foreground)]">{label}</span>
            </div>
          ))}
        </div>
        {/* Quadrant labels */}
        <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-[var(--muted-foreground)]">
          <div className="text-right pr-4">
            <span className="font-medium" style={{ color: CLASSIFICATION_COLORS.Puzzle }}>Puzzles</span> — Low popularity, high profit
          </div>
          <div>
            <span className="font-medium" style={{ color: CLASSIFICATION_COLORS.Star }}>Stars</span> — High popularity, high profit
          </div>
          <div className="text-right pr-4">
            <span className="font-medium" style={{ color: CLASSIFICATION_COLORS.Dog }}>Dogs</span> — Low popularity, low profit
          </div>
          <div>
            <span className="font-medium" style={{ color: CLASSIFICATION_COLORS.Plowhorse }}>Plowhorses</span> — High popularity, low profit
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
