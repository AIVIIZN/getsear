import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { crmSemanticDimensionDefinitions, crmSemanticMetricDefinitions, explainReportDefinition, validateReportMetricSelection } from '@/lib/crm/reports'
import { createCrmReportSchema, previewCrmReportSchema, runCrmReportSchema } from '@/lib/schemas/crm'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

describe('CRM-V10.1 semantic metric layer', () => {
  it('ships semantic report tables with tenant RLS and rollback coverage', () => {
    const migration = read('supabase/migrations/20260525201820_add_crm_semantic_metric_layer.sql')
    const rollback = read('supabase/_rollbacks/20260525201820_add_crm_semantic_metric_layer.rollback.sql')

    for (const table of ['crm_metric_definitions', 'crm_dimension_definitions', 'crm_report_definitions', 'crm_report_runs']) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`)
      expect(migration).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}[\\s\\S]*?org_id uuid NOT NULL REFERENCES public\\.organizations\\(id\\) ON DELETE CASCADE`))
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)
      expect(migration).toContain(`tenant_select_${table}`)
      expect(migration).toContain(`service_role_bypass_${table}`)
      expect(rollback).toContain(`DROP TABLE IF EXISTS public.${table}`)
    }

    expect(migration).toContain('allowed_dimensions text[] NOT NULL')
    expect(migration).toContain('formula text NOT NULL')
    expect(migration).toContain('validation_status text NOT NULL')
    expect(migration).toContain('metric_keys text[] NOT NULL')
  })

  it('defines every required CRM metric with formula, dimensions, owner, version, and validation status', () => {
    const required = [
      'revenue',
      'net_revenue',
      'average_check',
      'ltv',
      'visit',
      'repeat_visit',
      'lapsed_guest',
      'active_guest',
      'campaign_attributed_revenue',
      'loyalty_attributed_revenue',
      'redemption_rate',
      'churn_risk',
    ]

    expect(crmSemanticMetricDefinitions.map((metric) => metric.metric_key)).toEqual(required)
    for (const metric of crmSemanticMetricDefinitions) {
      expect(metric.formula.length).toBeGreaterThan(12)
      expect(metric.allowed_dimensions.length).toBeGreaterThan(0)
      expect(metric.default_filters).toBeDefined()
      expect(metric.owner_role).toMatch(/owner|manager|marketing|analyst/)
      expect(metric.version).toBe(1)
      expect(metric.validation_status).toBe('validated')
    }
  })

  it('rejects reports that mix metrics with unsupported dimensions', () => {
    expect(validateReportMetricSelection({ metric_keys: ['revenue'], dimension_keys: ['date', 'location'] })).toMatchObject({ ok: true })
    expect(validateReportMetricSelection({ metric_keys: ['average_check'], dimension_keys: ['server'] })).toMatchObject({ ok: true })
    expect(validateReportMetricSelection({ metric_keys: ['redemption_rate'], dimension_keys: ['server'] })).toMatchObject({
      ok: false,
      errors: ['Metric redemption_rate cannot be broken down by server'],
    })
    expect(validateReportMetricSelection({ metric_keys: ['missing'], dimension_keys: ['date'] })).toMatchObject({ ok: false })
  })

  it('validates report create, preview, and run payloads with semantic metric keys', () => {
    const report = createCrmReportSchema.parse({
      name: 'Campaign ROI by week',
      report_type: 'campaign_roi',
      metric_keys: ['campaign_attributed_revenue', 'average_check'],
      dimension_keys: ['date', 'campaign'],
      filters: { window_days: 30 },
      visualization: 'bar',
    })

    expect(report.metric_keys).toEqual(['campaign_attributed_revenue', 'average_check'])
    expect(previewCrmReportSchema.parse({ metric_keys: ['revenue'], dimension_keys: ['location'] }).sample_limit).toBe(25)
    expect(runCrmReportSchema.parse({ report_definition_id: crypto.randomUUID() }).report_definition_id).toBeTruthy()
    expect(() => createCrmReportSchema.parse({ name: 'Bad', metric_keys: ['random_metric'] })).toThrow()
    expect(() => runCrmReportSchema.parse({ filters: {} })).toThrow()
  })

  it('registers CRM report APIs against the shared semantic layer and audit vocabulary', () => {
    const metricsRoute = read('src/app/api/crm/metrics/route.ts')
    const dimensionsRoute = read('src/app/api/crm/dimensions/route.ts')
    const reportsRoute = read('src/app/api/crm/reports/route.ts')
    const previewRoute = read('src/app/api/crm/reports/preview/route.ts')
    const runRoute = read('src/app/api/crm/reports/run/route.ts')
    const auditLog = read('src/lib/audit/log.ts')

    expect(metricsRoute).toContain('listOrgMetricDefinitions')
    expect(dimensionsRoute).toContain('listOrgDimensionDefinitions')
    expect(reportsRoute).toContain("eq('org_id', user.org_id)")
    expect(reportsRoute).toContain('validateReportMetricSelection')
    expect(previewRoute).toContain('crm_report_previewed')
    expect(runRoute).toContain('crm_report_runs')
    expect(runRoute).toContain("eq('org_id', user.org_id)")
    expect(auditLog).toContain("'crm_report_created'")
    expect(auditLog).toContain("'crm_report_previewed'")
    expect(auditLog).toContain("'crm_report_run_started'")
  })

  it('keeps dimensions explicit so future builders cannot invent reporting joins', () => {
    expect(crmSemanticDimensionDefinitions.map((dimension) => dimension.dimension_key)).toEqual([
      'date',
      'location',
      'campaign',
      'loyalty_program',
      'guest_lifecycle_stage',
      'recovery_topic',
      'server',
    ])
    expect(explainReportDefinition({ metric_keys: ['revenue'], dimension_keys: ['location'] })).toContain('semantic metric layer')
  })
})
