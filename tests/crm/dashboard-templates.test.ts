import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { crmDashboardTemplates, validateDashboardWidgets } from '@/lib/crm/reports'
import { createCrmDashboardSchema } from '@/lib/schemas/crm'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

describe('CRM-V10.4 dashboards and templates', () => {
  it('ships dashboard tables with tenant RLS and rollback coverage', () => {
    const migration = read('supabase/migrations/20260525222600_add_crm_dashboards.sql')
    const rollback = read('supabase/_rollbacks/20260525222600_add_crm_dashboards.rollback.sql')

    for (const table of ['crm_dashboards', 'crm_dashboard_widgets']) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`)
      expect(migration).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}[\\s\\S]*?org_id uuid NOT NULL REFERENCES public\\.organizations\\(id\\) ON DELETE CASCADE`))
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)
      expect(migration).toContain(`tenant_select_${table}`)
      expect(migration).toContain(`service_role_bypass_${table}`)
      expect(rollback).toContain(`DROP TABLE IF EXISTS public.${table}`)
    }

    expect(migration).toContain('dashboard_id uuid NOT NULL REFERENCES public.crm_dashboards(id) ON DELETE CASCADE')
    expect(migration).toContain('metric_keys text[] NOT NULL')
    expect(migration).toContain('position jsonb NOT NULL')
  })

  it('defines all required role and business dashboard templates with semantic widgets', () => {
    const required = [
      'weekly_snapshot',
      'retention',
      'vip',
      'lapsed_recovery',
      'campaign_roi',
      'loyalty_performance',
      'menu_affinity',
      'new_guest_funnel',
      'service_recovery',
      'server_hospitality_impact',
      'location_comparison',
      'birthday_performance',
      'discount_abuse',
      'reward_liability',
      'no_show_risk',
      'ltv_leaderboard',
    ]

    expect(crmDashboardTemplates.map((template) => template.template_key)).toEqual(required)
    expect(new Set(crmDashboardTemplates.map((template) => template.audience))).toEqual(new Set(['owner', 'manager', 'marketing', 'loyalty']))

    for (const template of crmDashboardTemplates) {
      expect(template.widgets.length).toBeGreaterThan(0)
      expect(template.widgets.every((widget) => widget.metric_keys.length > 0)).toBe(true)
      expect(template.widgets.every((widget) => widget.demo_value.length > 0)).toBe(true)
      expect(validateDashboardWidgets(template.widgets)).toMatchObject({ ok: true })
    }
  })

  it('validates dashboard create payloads with widgets, layout, and template metadata', () => {
    const template = crmDashboardTemplates.find((item) => item.template_key === 'campaign_roi')!
    expect(template).toBeTruthy()

    const payload = createCrmDashboardSchema.parse({
      name: template.name,
      description: template.description,
      audience: template.audience,
      template_key: template.template_key,
      layout: { columns: 12 },
      widgets: template.widgets.map((widget) => ({
        widget_key: widget.widget_key,
        title: widget.title,
        widget_type: widget.widget_type,
        metric_keys: widget.metric_keys,
        dimension_keys: widget.dimension_keys,
        visualization: widget.visualization,
        position: widget.position,
        filters: widget.filters ?? {},
        settings: { demo_value: widget.demo_value, insight: widget.insight },
      })),
      metadata: { seed_demo_data: true },
    })

    expect(payload.widgets[0].metric_keys).toEqual(['campaign_attributed_revenue'])
    expect(payload.metadata).toMatchObject({ seed_demo_data: true })
    expect(() => createCrmDashboardSchema.parse({ name: 'Empty', widgets: [] })).toThrow()
  })

  it('registers the dashboard API and report builder template actions', () => {
    const route = read('src/app/api/crm/reports/dashboards/route.ts')
    const wizard = read('src/components/reports/CrmReportWizard.tsx')
    const auditLog = read('src/lib/audit/log.ts')

    expect(route).toContain('crmDashboardTemplates')
    expect(route).toContain("eq('org_id', user.org_id)")
    expect(route).toContain('validateDashboardWidgets')
    expect(route).toContain('crm_dashboard_created')
    expect(wizard).toContain('/api/crm/reports/dashboards?include_templates=true')
    expect(wizard).toContain('Save dashboard')
    expect(auditLog).toContain("'crm_dashboard_created'")
    expect(auditLog).toContain("'crm_dashboard'")
  })
})
