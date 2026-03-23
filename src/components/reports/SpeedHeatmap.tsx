'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDuration } from '@/lib/reports/constants'

interface HeatmapCell {
  station: string
  daypart: string
  avg_seconds: number
  ticket_count: number
}

interface SpeedHeatmapProps {
  data: HeatmapCell[]
  overallAvg: number
}

function getCellColor(seconds: number, avg: number): string {
  const ratio = seconds / avg
  if (ratio <= 0.75) return '#16A34A'    // Very fast — green
  if (ratio <= 1.0) return '#22C55E'     // Fast — lighter green
  if (ratio <= 1.25) return '#D97706'    // Slow — amber
  if (ratio <= 1.5) return '#EA580C'     // Very slow — orange
  return '#DC2626'                       // Critical — red
}

function getCellBg(seconds: number, avg: number): string {
  const ratio = seconds / avg
  if (ratio <= 0.75) return 'rgba(22, 163, 74, 0.12)'
  if (ratio <= 1.0) return 'rgba(34, 197, 94, 0.08)'
  if (ratio <= 1.25) return 'rgba(217, 119, 6, 0.1)'
  if (ratio <= 1.5) return 'rgba(234, 88, 12, 0.12)'
  return 'rgba(220, 38, 38, 0.12)'
}

export function SpeedHeatmap({ data, overallAvg }: SpeedHeatmapProps) {
  const stations = [...new Set(data.map(d => d.station))]
  const dayparts = ['Breakfast', 'Lunch', 'Dinner', 'Late Night']

  // Build lookup
  const lookup = new Map<string, HeatmapCell>()
  for (const cell of data) {
    lookup.set(`${cell.station}|${cell.daypart}`, cell)
  }

  return (
    <Card className="shadow-warm-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Station x Daypart Heatmap</CardTitle>
          <p className="text-xs text-[var(--muted-foreground)]">
            Avg: {formatDuration(overallAvg)}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left py-2 px-3 text-xs font-medium text-[var(--muted-foreground)]">Station</th>
                {dayparts.map(dp => (
                  <th key={dp} className="text-center py-2 px-3 text-xs font-medium text-[var(--muted-foreground)]">{dp}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stations.map(station => (
                <tr key={station}>
                  <td className="py-2 px-3 text-sm font-medium">{station}</td>
                  {dayparts.map(dp => {
                    const cell = lookup.get(`${station}|${dp}`)
                    if (!cell) {
                      return (
                        <td key={dp} className="py-2 px-3 text-center">
                          <div className="rounded-lg p-3 bg-[var(--secondary)]">
                            <span className="text-xs text-[var(--muted-foreground)]">--</span>
                          </div>
                        </td>
                      )
                    }
                    return (
                      <td key={dp} className="py-2 px-3 text-center">
                        <div
                          className="rounded-lg p-3 transition-colors"
                          style={{ backgroundColor: getCellBg(cell.avg_seconds, overallAvg) }}
                        >
                          <p className="text-sm font-bold tabular-nums" style={{ color: getCellColor(cell.avg_seconds, overallAvg) }}>
                            {formatDuration(cell.avg_seconds)}
                          </p>
                          <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                            {cell.ticket_count} tickets
                          </p>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-[var(--border)]">
          {[
            { label: 'Fast', color: '#16A34A' },
            { label: 'Normal', color: '#22C55E' },
            { label: 'Slow', color: '#D97706' },
            { label: 'Very Slow', color: '#EA580C' },
            { label: 'Critical', color: '#DC2626' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-[10px] text-[var(--muted-foreground)]">{item.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
