export type CrmReportWizardMetric =
  | 'revenue'
  | 'net_revenue'
  | 'average_check'
  | 'ltv'
  | 'visit'
  | 'repeat_visit'
  | 'lapsed_guest'
  | 'active_guest'
  | 'campaign_attributed_revenue'
  | 'loyalty_attributed_revenue'
  | 'redemption_rate'
  | 'churn_risk'

export type CrmReportWizardDimension =
  | 'date'
  | 'location'
  | 'campaign'
  | 'loyalty_program'
  | 'guest_lifecycle_stage'
  | 'recovery_topic'
  | 'server'

export type CrmReportWizardVisualization =
  | 'table'
  | 'line'
  | 'bar'
  | 'stacked_bar'
  | 'area'
  | 'pie'
  | 'scorecard'
  | 'heatmap'

export type CrmReportWizardAction =
  | 'dashboard_widget'
  | 'scheduled_email'
  | 'csv_export'
  | 'threshold_alert'
  | 'segment_handoff'
  | 'campaign_handoff'

export type CrmReportWizardValues = {
  question: string
  dataArea: 'campaigns' | 'guests' | 'loyalty' | 'recovery' | 'operations'
  name: string
  description: string
  metricKeys: CrmReportWizardMetric[]
  dimensionKeys: CrmReportWizardDimension[]
  visualization: CrmReportWizardVisualization
  datePreset: 'last_7_days' | 'last_30_days' | 'last_90_days' | 'quarter_to_date'
  attributionWindowDays: number
  minimumAttributedRevenue: number
  includeBaselineGuests: boolean
  scheduleFrequency: 'none' | 'daily' | 'weekly' | 'monthly'
  alertThreshold: number
  actions: CrmReportWizardAction[]
}

export const campaignRoiWizardDefaults: CrmReportWizardValues = {
  question: 'Which campaigns are bringing guests back and creating real revenue?',
  dataArea: 'campaigns',
  name: 'Campaign ROI by week',
  description: 'Owner report showing attributed revenue, repeat visits, and campaign performance by week.',
  metricKeys: ['campaign_attributed_revenue', 'repeat_visit'],
  dimensionKeys: ['campaign', 'date'],
  visualization: 'bar',
  datePreset: 'last_30_days',
  attributionWindowDays: 14,
  minimumAttributedRevenue: 0,
  includeBaselineGuests: false,
  scheduleFrequency: 'weekly',
  alertThreshold: 500,
  actions: ['dashboard_widget', 'scheduled_email', 'csv_export', 'campaign_handoff'],
}

export const reportWizardSteps = [
  'Question',
  'Data area',
  'Metric',
  'Breakdown',
  'Filters',
  'Visualization',
  'Preview',
  'Save',
] as const

export function buildCrmReportWizardPayload(values: CrmReportWizardValues) {
  const scheduled = values.actions.includes('scheduled_email') && values.scheduleFrequency !== 'none'
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    report_type: values.dataArea === 'campaigns' ? 'campaign_roi' : 'custom',
    status: scheduled ? 'scheduled' : 'active',
    metric_keys: values.metricKeys,
    dimension_keys: values.dimensionKeys,
    visualization: values.visualization,
    filters: {
      date_preset: values.datePreset,
      attribution_window_days: values.attributionWindowDays,
      minimum_attributed_revenue: values.minimumAttributedRevenue,
      include_baseline_guests: values.includeBaselineGuests,
      data_area: values.dataArea,
    },
    schedule: scheduled
      ? {
          frequency: values.scheduleFrequency,
          channel: 'email',
          audience: 'owners',
        }
      : {},
    metadata: {
      builder: 'guided_report_wizard',
      owner_question: values.question.trim(),
      requested_actions: values.actions,
      follow_up_handoffs: {
        dashboard_widget: values.actions.includes('dashboard_widget'),
        threshold_alert: values.actions.includes('threshold_alert')
          ? { metric_key: values.metricKeys[0], threshold: values.alertThreshold }
          : null,
        segment: values.actions.includes('segment_handoff')
          ? { source: 'report_filters', status: 'ready_for_review' }
          : null,
        campaign: values.actions.includes('campaign_handoff')
          ? { source: 'campaign_roi_report', status: 'ready_for_review' }
          : null,
      },
    },
  }
}

export function buildCrmReportPreviewPayload(values: CrmReportWizardValues) {
  const payload = buildCrmReportWizardPayload(values)
  return {
    metric_keys: payload.metric_keys,
    dimension_keys: payload.dimension_keys,
    filters: payload.filters,
    visualization: payload.visualization,
    sample_limit: 25,
  }
}
