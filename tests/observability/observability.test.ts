import { describe, expect, it } from 'vitest'
import {
  evaluateAlertRule,
  observabilityAlertRules,
} from '@/lib/observability/alert-rules'
import {
  getRumRouteSummaries,
  recordRumMetric,
  type RumMetric,
} from '@/lib/observability/rum-store'

describe('observability alert rules', () => {
  it('fires each committed synthetic alert rule at its documented threshold sample', () => {
    for (const rule of observabilityAlertRules) {
      expect(evaluateAlertRule(rule, rule.syntheticTest.value)).toBe(rule.syntheticTest.shouldFire)
    }
  })

  it('keeps alert rules quiet at threshold', () => {
    for (const rule of observabilityAlertRules) {
      expect(evaluateAlertRule(rule, rule.threshold)).toBe(false)
    }
  })
})

describe('RUM route summaries', () => {
  it('aggregates web vitals by route with p75 and poor counts', () => {
    const globalForRum = globalThis as typeof globalThis & { __searRumMetrics?: RumMetric[] }
    globalForRum.__searRumMetrics = []

    recordRumMetric({
      name: 'LCP',
      value: 120,
      rating: 'good',
      route: '/orders',
      href: 'https://getsear.com/orders',
      ts: '2026-05-25T12:00:00.000Z',
    })
    recordRumMetric({
      name: 'LCP',
      value: 240,
      rating: 'poor',
      route: '/orders',
      href: 'https://getsear.com/orders',
      ts: '2026-05-25T12:01:00.000Z',
    })
    recordRumMetric({
      name: 'CLS',
      value: 0.03,
      rating: 'good',
      route: '/orders',
      href: 'https://getsear.com/orders',
      ts: '2026-05-25T12:02:00.000Z',
    })

    expect(getRumRouteSummaries()).toEqual([
      {
        route: '/orders',
        sample_count: 3,
        poor_count: 1,
        metrics: {
          LCP: { p75: 240, latest: 240, rating: 'poor' },
          CLS: { p75: 0.03, latest: 0.03, rating: 'good' },
        },
      },
    ])
  })
})
