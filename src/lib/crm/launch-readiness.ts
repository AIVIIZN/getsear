export type CrmLaunchGateStatus = 'pass' | 'watch' | 'block'

export type CrmLaunchHealthIssue = {
  status?: string | null
  severity?: string | null
}

export type CrmLaunchReadinessInput = {
  issues?: CrmLaunchHealthIssue[]
  lastScanAt?: string | null
  loadGateNames?: string[]
  scenarioGateNames?: string[]
  visualGatePassed?: boolean
}

export type CrmLaunchReadiness = {
  status: CrmLaunchGateStatus
  score: number
  blockers: string[]
  performance_budgets: Array<{
    surface: string
    budget_ms: number
    measurement: string
  }>
  load_gates: Array<{
    name: string
    status: CrmLaunchGateStatus
    budget: string
  }>
  scenario_gates: Array<{
    name: string
    status: CrmLaunchGateStatus
  }>
  security_privacy_gates: Array<{
    name: string
    status: CrmLaunchGateStatus
  }>
}

export const crmLaunchPerformanceBudgets = [
  { surface: 'guest_search', budget_ms: 300, measurement: '/api/crm/guests and POS lookup p95' },
  { surface: 'guest_profile', budget_ms: 1000, measurement: '/api/crm/guests/:id plus timeline p95' },
  { surface: 'segment_preview', budget_ms: 1500, measurement: '/api/crm/segments/:id/preview p95' },
  { surface: 'report_preview', budget_ms: 2000, measurement: '/api/crm/reports/preview without POS write locks' },
] as const

export const crmLaunchLoadGates = [
  { name: 'search', budget: 'p95 <= 300ms with concurrent POS lookups' },
  { name: 'segment_preview', budget: 'p95 <= 1500ms with saved dynamic segments' },
  { name: 'campaign_queue', budget: 'schedule and test-send queue without duplicate delivery' },
  { name: 'reports', budget: 'preview/run avoid POS transaction locks' },
] as const

export const crmLaunchScenarioGates = [
  'busy_friday',
  'offline_pos',
  'duplicate_guest',
  'sms_opt_out',
  'refund_after_reward',
  'scheduled_campaign_closed_hours',
  'merge',
  'deletion',
  'vip_open_complaint',
] as const

export function buildCrmLaunchReadiness(input: CrmLaunchReadinessInput = {}): CrmLaunchReadiness {
  const issues = input.issues ?? []
  const blockingIssues = issues.filter((issue) => {
    const open = !['resolved', 'dismissed'].includes(String(issue.status ?? ''))
    return open && ['critical', 'high'].includes(String(issue.severity ?? ''))
  }).length
  const hasFreshScan = Boolean(input.lastScanAt)
  const completedLoadGates = new Set(input.loadGateNames ?? crmLaunchLoadGates.map((gate) => gate.name))
  const completedScenarioGates = new Set(input.scenarioGateNames ?? [...crmLaunchScenarioGates])
  const visualGatePassed = input.visualGatePassed ?? true

  const load_gates = crmLaunchLoadGates.map((gate) => ({
    name: gate.name,
    budget: gate.budget,
    status: completedLoadGates.has(gate.name) ? 'pass' as const : 'block' as const,
  }))
  const scenario_gates = crmLaunchScenarioGates.map((name) => ({
    name,
    status: completedScenarioGates.has(name) ? 'pass' as const : 'block' as const,
  }))
  const security_privacy_gates = [
    { name: 'fresh_crm_health_scan', status: hasFreshScan ? 'pass' as const : 'watch' as const },
    { name: 'no_open_high_or_critical_health_issues', status: blockingIssues === 0 ? 'pass' as const : 'block' as const },
    { name: 'visual_qa_across_crm_surfaces', status: visualGatePassed ? 'pass' as const : 'block' as const },
  ]

  const blockers = [
    ...load_gates.filter((gate) => gate.status === 'block').map((gate) => `Load gate missing: ${gate.name}`),
    ...scenario_gates.filter((gate) => gate.status === 'block').map((gate) => `Scenario gate missing: ${gate.name}`),
    ...security_privacy_gates.filter((gate) => gate.status === 'block').map((gate) => `Security/privacy gate blocking: ${gate.name}`),
  ]
  if (blockingIssues > 0) blockers.push(`${blockingIssues} high-impact CRM health issue${blockingIssues === 1 ? ' requires' : 's require'} review`)

  const passedGates = [...load_gates, ...scenario_gates, ...security_privacy_gates].filter((gate) => gate.status === 'pass').length
  const totalGates = load_gates.length + scenario_gates.length + security_privacy_gates.length
  const score = Math.round((passedGates / totalGates) * 100)

  return {
    status: blockers.length > 0 ? 'block' : hasFreshScan ? 'pass' : 'watch',
    score,
    blockers,
    performance_budgets: [...crmLaunchPerformanceBudgets],
    load_gates,
    scenario_gates,
    security_privacy_gates,
  }
}
