import { describe, expect, it } from 'vitest'
import {
  buildCrmAiReportDraft,
  buildCrmAiReportDraftGatewayPayload,
  buildCrmReportCanvasValues,
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

  it('builds a valid report definition from connected visual canvas blocks', () => {
    const values = buildCrmReportCanvasValues(
      campaignRoiWizardDefaults,
      ['campaigns', 'orders', 'guests'],
      [{ from: 'campaigns', to: 'orders' }],
    )

    expect(values.name).toBe('Campaign ROI canvas')
    expect(values.dataArea).toBe('campaigns')
    expect(values.metricKeys).toContain('campaign_attributed_revenue')
    expect(values.metricKeys).toContain('repeat_visit')
    expect(values.dimensionKeys).toEqual(['campaign', 'location'])
    expect(values.actions).toContain('dashboard_widget')
    expect(buildCrmReportWizardPayload(values).metadata).toMatchObject({
      builder: 'guided_report_wizard',
      owner_question: expect.stringContaining('campaigns to orders'),
    })
  })

  it('keeps AI report drafts approval gated before they become wizard values', () => {
    const draft = buildCrmAiReportDraft('Show loyalty reward redemptions by week', campaignRoiWizardDefaults)

    expect(draft.approvalRequired).toBe(true)
    expect(draft.values.dataArea).toBe('loyalty')
    expect(draft.values.metricKeys).toEqual(['loyalty_attributed_revenue', 'redemption_rate'])
    expect(draft.values.dimensionKeys).toEqual(['loyalty_program', 'date'])
    expect(buildCrmReportPreviewPayload(draft.values)).toMatchObject({
      metric_keys: ['loyalty_attributed_revenue', 'redemption_rate'],
      dimension_keys: ['loyalty_program', 'date'],
      visualization: 'stacked_bar',
    })
  })

  it('routes Ask AI through the auditable CRM gateway with approval required', () => {
    const payload = buildCrmAiReportDraftGatewayPayload(
      'Build a campaign ROI report',
      ['campaigns', 'orders'],
      [{ from: 'campaigns', to: 'orders' }],
    )

    expect(payload).toMatchObject({
      task_type: 'report_builder',
      dry_run: true,
      approval_required: true,
      metadata: {
        builder: 'visual_canvas_ask_ai',
        approval_gate: 'operator_required_before_report_save',
      },
    })
    expect(payload.sources[0]).toMatchObject({
      source_id: 'visual-report-canvas',
      data: {
        selected_blocks: ['campaigns', 'orders'],
      },
    })
  })
})
