import { describe, expect, it } from 'vitest'

import {
  crmCanonicalEntities,
  crmDesignContract,
  crmDoNotDuplicateMap,
  crmEventNames,
  crmExistingSurfaceMap,
  crmRoleVisibilityMatrix,
  crmRouteContract,
  crmSchemaPlan,
} from '@/lib/crm/foundation-contract'

describe('CRM foundation contract', () => {
  it('locks the canonical CRM naming vocabulary and event names', () => {
    expect(crmCanonicalEntities).toEqual([
      'guest',
      'guest_contact_point',
      'guest_identifier',
      'visit',
      'guest_lifecycle_stage',
      'crm_segment',
      'crm_campaign',
      'crm_automation',
      'crm_metric',
      'crm_dashboard',
      'crm_recovery_case',
    ])
    expect(crmEventNames).toEqual([
      'crm.guest.created',
      'crm.guest.merged',
      'crm.consent.updated',
      'crm.segment.materialized',
      'crm.campaign.sent',
      'crm.recovery.opened',
    ])
  })

  it('keeps new CRM APIs under /api/crm while preserving compatibility surfaces', () => {
    expect(crmRouteContract.nativeNamespace).toBe('/api/crm')
    expect(crmRouteContract.compatibilityNamespaces).toEqual([
      '/api/customers',
      '/api/loyalty',
      '/api/marketing',
    ])
  })

  it('maps the existing CRM-adjacent system so later batches do not duplicate it', () => {
    expect(crmExistingSurfaceMap.customers.routes).toContain('src/app/api/customers/merge/route.ts')
    expect(crmExistingSurfaceMap.loyalty.existingTables).toContain('loyalty_transactions')
    expect(crmExistingSurfaceMap.marketing.workers).toContain('src/workers/campaign-email-worker.ts')
    expect(crmExistingSurfaceMap.reservations.existingTables).toContain('reservations')
    expect(crmExistingSurfaceMap.reports.services).toContain('src/lib/reports/queries.ts')
    expect(crmExistingSurfaceMap.audit.service).toContain('src/lib/audit/log.ts')
    expect(crmDoNotDuplicateMap.map((item) => item.concern)).toContain('Campaign delivery and tracking')
  })

  it('separates existing schema from CRM-V1 and later CRM tables', () => {
    expect(crmSchemaPlan.existingTables).toContain('customers')
    expect(crmSchemaPlan.existingTables).toContain('campaign_recipients')
    expect(crmSchemaPlan.crmV1NewTables).toContain('guests')
    expect(crmSchemaPlan.crmV1NewTables).toContain('guest_timeline_events')
    expect(crmSchemaPlan.laterNewTables).toContain('guest_consents')
    expect(crmSchemaPlan.laterNewTables).toContain('crm_recovery_cases')
  })

  it('prevents staff-facing CRM screens from exposing owner analytics or sensitive notes', () => {
    expect(crmRoleVisibilityMatrix.staff.mayViewOwnerAnalytics).toBe(false)
    expect(crmRoleVisibilityMatrix.staff.mayViewSensitiveNotes).toBe(false)
    expect(crmRoleVisibilityMatrix.staff.surfaces).toEqual([
      'pos_guest_memory',
      'hospitality_warnings',
      'visit_context',
    ])
    expect(crmRoleVisibilityMatrix.owner.mayViewOwnerAnalytics).toBe(true)
    expect(crmRoleVisibilityMatrix.analyst.mayViewSensitiveNotes).toBe(false)
  })

  it('defines scan paths and density rules for every CRM surface family', () => {
    expect(crmDesignContract.guest360.scanPath).toEqual([
      'identity',
      'hospitality_warnings',
      'next_best_action',
      'timeline',
    ])
    expect(crmDesignContract.posGuestMemoryCard.surfaceType).toBe('service-speed')
    expect(crmDesignContract.posGuestMemoryCard.densityRule).toContain('no owner-only analytics')
    expect(crmDesignContract.setupReviewSplitPane.scanPath).toContain('preview')
    expect(crmDesignContract.crmHealthIssueQueue.densityRule).toContain('blocked CRM workflow')
    expect(crmDesignContract.aiActionCard.densityRule).toContain('persisted recommendation data')
  })
})
