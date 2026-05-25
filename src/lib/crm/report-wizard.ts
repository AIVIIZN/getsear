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

export type CrmReportCanvasBlockId =
  | 'guests'
  | 'orders'
  | 'menu_items'
  | 'campaigns'
  | 'loyalty'
  | 'reservations'
  | 'feedback'
  | 'staff'

export type CrmReportCanvasConnection = {
  from: CrmReportCanvasBlockId
  to: CrmReportCanvasBlockId
}

export type CrmReportCanvasBlock = {
  id: CrmReportCanvasBlockId
  label: string
  description: string
  metrics: CrmReportWizardMetric[]
  dimensions: CrmReportWizardDimension[]
  dataArea: CrmReportWizardValues['dataArea']
}

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

export type CrmReportAiDraft = {
  values: CrmReportWizardValues
  rationale: string
  approvalRequired: true
  sourceCitations: string[]
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

export const crmReportCanvasBlocks: CrmReportCanvasBlock[] = [
  {
    id: 'guests',
    label: 'Guests',
    description: 'Lifecycle, LTV, repeat behavior, and reachability.',
    metrics: ['ltv', 'visit', 'repeat_visit', 'lapsed_guest', 'active_guest'],
    dimensions: ['guest_lifecycle_stage', 'location', 'date'],
    dataArea: 'guests',
  },
  {
    id: 'orders',
    label: 'Orders',
    description: 'Revenue, check averages, visits, and time-based sales.',
    metrics: ['revenue', 'net_revenue', 'average_check', 'visit'],
    dimensions: ['date', 'location', 'server'],
    dataArea: 'operations',
  },
  {
    id: 'menu_items',
    label: 'Menu Items',
    description: 'Menu affinity context connected through order history.',
    metrics: ['revenue', 'average_check', 'visit'],
    dimensions: ['date', 'location'],
    dataArea: 'operations',
  },
  {
    id: 'campaigns',
    label: 'Campaigns',
    description: 'Attributed revenue, repeat visits, and ROI handoffs.',
    metrics: ['campaign_attributed_revenue', 'repeat_visit', 'ltv'],
    dimensions: ['campaign', 'date', 'guest_lifecycle_stage'],
    dataArea: 'campaigns',
  },
  {
    id: 'loyalty',
    label: 'Loyalty',
    description: 'Reward liability, redemptions, and loyalty revenue.',
    metrics: ['loyalty_attributed_revenue', 'redemption_rate', 'active_guest'],
    dimensions: ['loyalty_program', 'date', 'location'],
    dataArea: 'loyalty',
  },
  {
    id: 'reservations',
    label: 'Reservations',
    description: 'Reservation and no-show context joined to known guests.',
    metrics: ['visit', 'repeat_visit', 'ltv'],
    dimensions: ['date', 'location', 'guest_lifecycle_stage'],
    dataArea: 'guests',
  },
  {
    id: 'feedback',
    label: 'Feedback',
    description: 'Recovery topics, churn risk, and review signals.',
    metrics: ['churn_risk', 'revenue'],
    dimensions: ['recovery_topic', 'guest_lifecycle_stage', 'location'],
    dataArea: 'recovery',
  },
  {
    id: 'staff',
    label: 'Staff',
    description: 'Server hospitality impact and check performance.',
    metrics: ['average_check'],
    dimensions: ['server', 'date'],
    dataArea: 'operations',
  },
]

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

const validDimensionByMetric: Record<CrmReportWizardMetric, CrmReportWizardDimension[]> = {
  revenue: ['date', 'location', 'campaign', 'loyalty_program', 'recovery_topic'],
  net_revenue: ['date', 'location', 'campaign', 'loyalty_program'],
  average_check: ['date', 'location', 'server', 'campaign'],
  ltv: ['guest_lifecycle_stage', 'location', 'campaign', 'loyalty_program'],
  visit: ['date', 'location', 'guest_lifecycle_stage', 'campaign'],
  repeat_visit: ['date', 'location', 'campaign', 'loyalty_program'],
  lapsed_guest: ['guest_lifecycle_stage', 'location', 'campaign'],
  active_guest: ['guest_lifecycle_stage', 'location', 'loyalty_program'],
  campaign_attributed_revenue: ['campaign', 'date', 'location', 'guest_lifecycle_stage'],
  loyalty_attributed_revenue: ['loyalty_program', 'date', 'location', 'guest_lifecycle_stage'],
  redemption_rate: ['loyalty_program', 'date', 'location'],
  churn_risk: ['guest_lifecycle_stage', 'location', 'recovery_topic'],
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

function connectedBlockIds(blockIds: CrmReportCanvasBlockId[], connections: CrmReportCanvasConnection[]) {
  const connected = new Set<CrmReportCanvasBlockId>()
  for (const connection of connections) {
    if (blockIds.includes(connection.from) && blockIds.includes(connection.to)) {
      connected.add(connection.from)
      connected.add(connection.to)
    }
  }
  return connected.size > 0 ? blockIds.filter((id) => connected.has(id)) : blockIds
}

function compatibleDimensions(metricKeys: CrmReportWizardMetric[], candidates: CrmReportWizardDimension[]) {
  if (!metricKeys.length) return []
  return candidates.filter((dimension) => metricKeys.every((metric) => validDimensionByMetric[metric].includes(dimension))).slice(0, 3)
}

function dataAreaFor(blocks: CrmReportCanvasBlock[]): CrmReportWizardValues['dataArea'] {
  if (blocks.some((block) => block.id === 'campaigns')) return 'campaigns'
  if (blocks.some((block) => block.id === 'loyalty')) return 'loyalty'
  if (blocks.some((block) => block.id === 'feedback')) return 'recovery'
  if (blocks.some((block) => ['guests', 'reservations'].includes(block.id))) return 'guests'
  return 'operations'
}

function visualizationFor(metricKeys: CrmReportWizardMetric[], dimensionKeys: CrmReportWizardDimension[]): CrmReportWizardVisualization {
  if (metricKeys.length === 1 && dimensionKeys.length === 0) return 'scorecard'
  if (dimensionKeys.includes('date')) return metricKeys.length > 1 ? 'stacked_bar' : 'line'
  if (dimensionKeys.includes('guest_lifecycle_stage') || dimensionKeys.includes('loyalty_program')) return 'bar'
  return 'table'
}

function reportNameFor(blocks: CrmReportCanvasBlock[], metricKeys: CrmReportWizardMetric[]) {
  const blockNames = blocks.map((block) => block.label).slice(0, 3).join(' + ')
  if (metricKeys.includes('campaign_attributed_revenue')) return 'Campaign ROI canvas'
  if (metricKeys.includes('loyalty_attributed_revenue')) return 'Loyalty performance canvas'
  if (metricKeys.includes('churn_risk')) return 'Recovery risk canvas'
  return `${blockNames || 'CRM'} report canvas`
}

export function buildCrmReportCanvasValues(
  current: CrmReportWizardValues,
  blockIds: CrmReportCanvasBlockId[],
  connections: CrmReportCanvasConnection[],
): CrmReportWizardValues {
  const selectedIds = connectedBlockIds(blockIds, connections)
  const blocksById = new Map(crmReportCanvasBlocks.map((block) => [block.id, block]))
  const selectedBlocks = selectedIds.flatMap((id) => {
    const block = blocksById.get(id)
    return block ? [block] : []
  })
  const metricKeys = unique(selectedBlocks.flatMap((block) => block.metrics)).slice(0, 4)
  const dimensionKeys = compatibleDimensions(metricKeys, unique(selectedBlocks.flatMap((block) => block.dimensions)))
  const dataArea = dataAreaFor(selectedBlocks)
  const visualization = visualizationFor(metricKeys, dimensionKeys)
  const connectionText = connections.length
    ? connections.map((connection) => `${connection.from} to ${connection.to}`).join(', ')
    : selectedBlocks.map((block) => block.id).join(', ')

  return {
    ...current,
    question: `What does ${connectionText} show about revenue, retention, and guest behavior?`,
    dataArea,
    name: reportNameFor(selectedBlocks, metricKeys),
    description: `Visual canvas report built from ${selectedBlocks.map((block) => block.label).join(', ')} using validated semantic metrics.`,
    metricKeys,
    dimensionKeys,
    visualization,
    actions: unique([...current.actions, 'dashboard_widget', 'csv_export']),
  }
}

export function buildCrmAiReportDraft(prompt: string, current: CrmReportWizardValues): CrmReportAiDraft {
  const lower = prompt.toLowerCase()
  const wantsCampaign = /\bcampaign|roi|attribution|offer|email|sms\b/.test(lower)
  const wantsLoyalty = /\bloyalty|reward|redemption|points|tier\b/.test(lower)
  const wantsRecovery = /\brecovery|complaint|review|feedback|churn|risk\b/.test(lower)
  const wantsStaff = /\bstaff|server|hospitality|employee\b/.test(lower)
  const wantsGuest = /\bguest|retention|lapsed|vip|lifetime|ltv\b/.test(lower)

  const metricKeys: CrmReportWizardMetric[] = wantsCampaign
    ? ['campaign_attributed_revenue', 'repeat_visit']
    : wantsLoyalty
      ? ['loyalty_attributed_revenue', 'redemption_rate']
      : wantsRecovery
        ? ['churn_risk', 'revenue']
        : wantsStaff
          ? ['average_check']
          : wantsGuest
            ? ['ltv', 'repeat_visit']
            : current.metricKeys.length
              ? current.metricKeys
              : ['revenue']

  const dimensionCandidates: CrmReportWizardDimension[] = wantsCampaign
    ? ['campaign', 'date']
    : wantsLoyalty
      ? ['loyalty_program', 'date']
      : wantsRecovery
        ? ['recovery_topic', 'guest_lifecycle_stage']
        : wantsStaff
          ? ['server', 'date']
          : wantsGuest
            ? ['guest_lifecycle_stage', 'location']
            : current.dimensionKeys

  const dimensionKeys = compatibleDimensions(metricKeys, dimensionCandidates)
  const dataArea: CrmReportWizardValues['dataArea'] = wantsCampaign
    ? 'campaigns'
    : wantsLoyalty
      ? 'loyalty'
      : wantsRecovery
        ? 'recovery'
        : wantsGuest
          ? 'guests'
          : 'operations'

  const actionHints: CrmReportWizardAction[] = wantsCampaign ? ['campaign_handoff'] : wantsLoyalty ? ['threshold_alert'] : wantsRecovery ? ['segment_handoff'] : []
  const values: CrmReportWizardValues = {
    ...current,
    question: prompt.trim(),
    dataArea,
    name: `${prompt.trim().slice(0, 64)}${prompt.trim().length > 64 ? '...' : ''}`,
    description: `AI drafted report definition awaiting operator approval: ${prompt.trim()}`,
    metricKeys,
    dimensionKeys,
    visualization: visualizationFor(metricKeys, dimensionKeys),
    actions: unique([...current.actions, 'dashboard_widget', 'csv_export', ...actionHints]),
  }

  return {
    values,
    rationale: `Draft uses ${metricKeys.join(', ')} with ${dimensionKeys.length ? dimensionKeys.join(', ') : 'no breakdown'} and remains unapplied until approved.`,
    approvalRequired: true,
    sourceCitations: ['CRM semantic metric layer', 'Operator report prompt'],
  }
}

export function buildCrmAiReportDraftGatewayPayload(
  prompt: string,
  blockIds: CrmReportCanvasBlockId[],
  connections: CrmReportCanvasConnection[],
) {
  return {
    task_type: 'report_builder',
    prompt,
    dry_run: true,
    approval_required: true,
    sources: [
      {
        source_id: 'visual-report-canvas',
        source_type: 'manual_context',
        title: 'Visual report canvas',
        visibility: 'manager',
        data: {
          selected_blocks: blockIds,
          connections,
        },
      },
      {
        source_id: 'semantic-report-layer',
        source_type: 'crm_report',
        title: 'CRM semantic metric layer',
        visibility: 'manager',
        data: {
          available_metrics: Object.keys(validDimensionByMetric),
          available_dimensions: unique(Object.values(validDimensionByMetric).flat()),
        },
      },
    ],
    metadata: {
      builder: 'visual_canvas_ask_ai',
      approval_gate: 'operator_required_before_report_save',
    },
  }
}

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
