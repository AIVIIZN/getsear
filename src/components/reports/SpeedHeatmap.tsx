'use client'

import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui-v2/Card'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui-v2/data/Table'
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
  if (ratio <= 0.75) return 'var(--color-success)'
  if (ratio <= 1.0) return 'var(--color-success)'
  if (ratio <= 1.25) return 'var(--color-warning)'
  if (ratio <= 1.5) return 'var(--color-warning)'
  return 'var(--color-danger)'
}

function getCellBg(seconds: number, avg: number): string {
  const ratio = seconds / avg
  if (ratio <= 1.0) return 'var(--color-success-bg)'
  if (ratio <= 1.5) return 'var(--color-warning-bg)'
  return 'var(--color-danger-bg)'
}

const LEGEND = [
  { label: 'Fast', color: 'var(--color-success)' },
  { label: 'Normal', color: 'var(--color-success)' },
  { label: 'Slow', color: 'var(--color-warning)' },
  { label: 'Very Slow', color: 'var(--color-warning)' },
  { label: 'Critical', color: 'var(--color-danger)' },
]

export function SpeedHeatmap({ data, overallAvg }: SpeedHeatmapProps) {
  const stations = [...new Set(data.map(d => d.station))]
  const dayparts = ['Breakfast', 'Lunch', 'Dinner', 'Late Night']

  const lookup = new Map<string, HeatmapCell>()
  for (const cell of data) {
    lookup.set(`${cell.station}|${cell.daypart}`, cell)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Station x Daypart Heatmap</CardTitle>
          <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)]">
            Avg: {formatDuration(overallAvg)}
          </p>
        </div>
      </CardHeader>
      <CardBody>
        <Table>
          <TableHeader>
            <TableRow>
              <TableCell header>Station</TableCell>
              {dayparts.map(dp => (
                <TableCell key={dp} header align="center">{dp}</TableCell>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {stations.map(station => (
              <TableRow key={station}>
                <TableCell className="font-[var(--weight-medium)]">{station}</TableCell>
                {dayparts.map(dp => {
                  const cell = lookup.get(`${station}|${dp}`)
                  if (!cell) {
                    return (
                      <TableCell key={dp} align="center">
                        <div className="rounded-[var(--radius-sm)] p-[var(--space-2)] bg-[color:var(--color-bg-muted)]">
                          <span className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)]">--</span>
                        </div>
                      </TableCell>
                    )
                  }
                  return (
                    <TableCell key={dp} align="center">
                      <div
                        className="rounded-[var(--radius-sm)] p-[var(--space-2)] transition-colors"
                        style={{ backgroundColor: getCellBg(cell.avg_seconds, overallAvg) }}
                      >
                        <p className="text-[length:var(--type-subhead-size)] font-[var(--weight-bold)] tabular-nums" style={{ color: getCellColor(cell.avg_seconds, overallAvg) }}>
                          {formatDuration(cell.avg_seconds)}
                        </p>
                        <p className="text-[length:var(--type-caption-2-size)] text-[color:var(--color-text-muted)] mt-[var(--space-1)]">
                          {cell.ticket_count} tickets
                        </p>
                      </div>
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex items-center justify-center gap-[var(--space-3)] mt-[var(--space-3)] pt-[var(--space-3)] border-t border-[color:var(--color-border)]">
          {LEGEND.map((item, i) => (
            <div key={i} className="flex items-center gap-[var(--space-1)]">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-[length:var(--type-caption-2-size)] text-[color:var(--color-text-muted)]">{item.label}</span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}
