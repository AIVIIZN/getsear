import { describe, expect, it } from 'vitest'
import {
  buildCrmReportPreviewPayload,
  buildCrmReportWizardPayload,
  campaignRoiWizardDefaults,
  reportWizardSteps,
} from '@/lib/crm/report-wizard'

describe('guided CRM report wizard', () => {
  it('preloads an owner-ready campaign ROI report path', () => {
    expect(campaignRoiWizardDefaults.question).toContain('campaigns')
    expect(campaignRoiWizardDefaults.metricKeys).toEqual(['campaign_attributed_revenue', 'repeat_visit'])
    expect(campaignRoiWizardDefaults.dimensionKeys).toEqual(['campaign', 'date'])
    expect(campaignRoiWizardDefaults.actions).toContain('dashboard_widget')
    expect(campaignRoiWizardDefaults.actions).toContain('campaign_handoff')
  })

  it('covers the complete guided wizard flow from question to save', () => {
    expect(reportWizardSteps).toEqual([
      'Question',
      'Data area',
      'Metric',
      'Breakdown',
      'Filters',
      'Visualization',
      'Preview',
      'Save',
    ])
  })

  it('builds a semantic report definition with schedule and follow-up handoffs', () => {
    const payload = buildCrmReportWizardPayload(campaignRoiWizardDefaults)

    expect(payload.report_type).toBe('campaign_roi')
    expect(payload.status).toBe('scheduled')
    expect(payload.filters).toMatchObject({
      date_preset: 'last_30_days',
      attribution_window_days: 14,
      include_baseline_guests: false,
      data_area: 'campaigns',
    })
    expect(payload.schedule).toMatchObject({
      frequency: 'weekly',
      channel: 'email',
      audience: 'owners',
    })
    expect(payload.metadata).toMatchObject({
      builder: 'guided_report_wizard',
      follow_up_handoffs: {
        dashboard_widget: true,
        campaign: { source: 'campaign_roi_report', status: 'ready_for_review' },
      },
    })
  })

  it('builds a preview request that explains metric issues before save', () => {
    const payload = buildCrmReportPreviewPayload(campaignRoiWizardDefaults)

    expect(payload).toEqual({
      metric_keys: ['campaign_attributed_revenue', 'repeat_visit'],
      dimension_keys: ['campaign', 'date'],
      filters: {
        date_preset: 'last_30_days',
        attribution_window_days: 14,
        minimum_attributed_revenue: 0,
        include_baseline_guests: false,
        data_area: 'campaigns',
      },
      visualization: 'bar',
      sample_limit: 25,
    })
  })
})
