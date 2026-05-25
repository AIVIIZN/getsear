import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { buildCrmLaunchReadiness, crmLaunchPerformanceBudgets, crmLaunchScenarioGates } from '@/lib/crm/launch-readiness'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

describe('CRM-V12.5 performance, security, launch polish', () => {
  it('defines executable launch budgets for search, profile, segment preview, campaign queue, and reports', () => {
    expect(crmLaunchPerformanceBudgets).toEqual(expect.arrayContaining([
      expect.objectContaining({ surface: 'guest_search', budget_ms: 300 }),
      expect.objectContaining({ surface: 'guest_profile', budget_ms: 1000 }),
      expect.objectContaining({ surface: 'segment_preview', budget_ms: 1500 }),
      expect.objectContaining({ surface: 'report_preview', budget_ms: 2000 }),
    ]))

    const script = read('load-tests/crm-launch.js')
    expect(script).toContain('crm_guest_search_duration')
    expect(script).toContain('p(95)<300')
    expect(script).toContain('crm_guest_profile_duration')
    expect(script).toContain('p(95)<1000')
    expect(script).toContain('crm_segment_preview_duration')
    expect(script).toContain('p(95)<1500')
    expect(script).toContain('crm_campaign_queue_duration')
    expect(script).toContain('crm_report_preview_duration')
    expect(script).toContain('/api/crm/reports/preview')
    expect(script).toContain('/api/crm/segments/${data.segmentId}/preview')
  })

  it('blocks launch readiness on unresolved high-impact health issues and missing gates', () => {
    const readiness = buildCrmLaunchReadiness({
      issues: [{ status: 'review_required', severity: 'critical' }],
      lastScanAt: '2026-05-25T12:00:00.000Z',
      loadGateNames: ['search'],
      scenarioGateNames: ['busy_friday'],
      visualGatePassed: false,
    })

    expect(readiness.status).toBe('block')
    expect(readiness.score).toBeLessThan(50)
    expect(readiness.blockers).toEqual(expect.arrayContaining([
      'Load gate missing: segment_preview',
      'Scenario gate missing: offline_pos',
      'Security/privacy gate blocking: visual_qa_across_crm_surfaces',
      '1 high-impact CRM health issue requires review',
    ]))
  })

  it('passes when all load, scenario, security, privacy, and visual gates are satisfied', () => {
    const readiness = buildCrmLaunchReadiness({
      issues: [{ status: 'resolved', severity: 'critical' }],
      lastScanAt: '2026-05-25T12:00:00.000Z',
    })

    expect(readiness.status).toBe('pass')
    expect(readiness.score).toBe(100)
    expect(readiness.blockers).toHaveLength(0)
    expect(readiness.scenario_gates.map((gate) => gate.name)).toEqual([...crmLaunchScenarioGates])
  })

  it('exposes launch readiness through CRM Health with auth, role, and visual checklist coverage', () => {
    const route = read('src/app/api/crm/health/route.ts')
    const page = read('src/app/(backoffice)/crm-health/page.tsx')

    expect(route).toContain('getAuthUser')
    expect(route).toContain('requireRole(user, [...crmHealthReadRoles])')
    expect(route).toContain('buildCrmLaunchReadiness')
    expect(route).toContain('launch_readiness')

    expect(page).toContain('Launch readiness')
    expect(page).toContain('Performance, security, and scenario gates')
    expect(page).toContain('performance_budgets')
    expect(page).toContain('load_gates')
    expect(page).toContain('scenario_gates')
    expect(page).toContain('security_privacy_gates')
    expect(page).toContain('Blocking launch items')
  })
})
