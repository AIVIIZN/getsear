export type RumMetricName = 'CLS' | 'INP' | 'LCP' | 'FCP' | 'TTFB'
export type RumRating = 'good' | 'needs-improvement' | 'poor'

export type RumMetric = {
  name: RumMetricName
  value: number
  rating: RumRating
  route: string
  href: string
  ts: string
}

export type RumRouteSummary = {
  route: string
  sample_count: number
  poor_count: number
  metrics: Partial<Record<RumMetricName, { p75: number; latest: number; rating: RumRating }>>
}

const MAX_METRICS = 500

const globalForRum = globalThis as typeof globalThis & {
  __searRumMetrics?: RumMetric[]
}

function metrics() {
  globalForRum.__searRumMetrics ??= []
  return globalForRum.__searRumMetrics
}

export function recordRumMetric(metric: RumMetric) {
  const store = metrics()
  store.push(metric)
  if (store.length > MAX_METRICS) {
    store.splice(0, store.length - MAX_METRICS)
  }
}

function percentile(values: number[], pct: number) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.ceil((pct / 100) * sorted.length) - 1)
  return Math.round(sorted[index] * 100) / 100
}

export function getRumRouteSummaries(): RumRouteSummary[] {
  const byRoute = new Map<string, RumMetric[]>()

  for (const metric of metrics()) {
    const bucket = byRoute.get(metric.route) ?? []
    bucket.push(metric)
    byRoute.set(metric.route, bucket)
  }

  return [...byRoute.entries()]
    .map(([route, rows]) => {
      const summary: RumRouteSummary = {
        route,
        sample_count: rows.length,
        poor_count: rows.filter((row) => row.rating === 'poor').length,
        metrics: {},
      }

      for (const name of ['LCP', 'CLS', 'INP', 'FCP', 'TTFB'] as const) {
        const matching = rows.filter((row) => row.name === name)
        const latest = matching.at(-1)
        if (!latest) continue
        summary.metrics[name] = {
          p75: percentile(matching.map((row) => row.value), 75),
          latest: latest.value,
          rating: latest.rating,
        }
      }

      return summary
    })
    .sort((a, b) => b.poor_count - a.poor_count || b.sample_count - a.sample_count)
}
