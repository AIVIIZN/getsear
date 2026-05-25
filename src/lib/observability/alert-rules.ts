export type ObservabilityAlertRule = {
  id: string
  name: string
  metric: 'error_rate' | 'api_p99_ms' | 'five_xx_per_min'
  threshold: number
  window: '1m' | '5m'
  severity: 'warning' | 'critical'
  syntheticTest: {
    value: number
    shouldFire: boolean
  }
}

export const observabilityAlertRules: ObservabilityAlertRule[] = [
  {
    id: 'error-rate-gt-1pct',
    name: 'Error rate > 1%',
    metric: 'error_rate',
    threshold: 0.01,
    window: '5m',
    severity: 'critical',
    syntheticTest: { value: 0.012, shouldFire: true },
  },
  {
    id: 'api-p99-gt-200ms',
    name: 'API p99 > 200ms',
    metric: 'api_p99_ms',
    threshold: 200,
    window: '5m',
    severity: 'warning',
    syntheticTest: { value: 225, shouldFire: true },
  },
  {
    id: 'five-xx-gt-5-per-min',
    name: '5xx > 5/min',
    metric: 'five_xx_per_min',
    threshold: 5,
    window: '1m',
    severity: 'critical',
    syntheticTest: { value: 6, shouldFire: true },
  },
]

export function evaluateAlertRule(rule: ObservabilityAlertRule, value: number) {
  return value > rule.threshold
}
