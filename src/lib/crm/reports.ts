import type { AuthUser } from '@/lib/api/auth'
import type { createAdminClient } from '@/lib/supabase/admin'

type Db = ReturnType<typeof createAdminClient>

export const crmReportReadRoles = ['platform_admin', 'owner', 'admin', 'manager', 'marketing', 'analyst'] as const
export const crmReportManageRoles = ['platform_admin', 'owner', 'admin', 'manager', 'analyst'] as const

export type CrmMetricDefinition = {
  metric_key: string
  display_name: string
  description: string
  formula: string
  value_type: 'currency' | 'number' | 'percent' | 'duration' | 'count' | 'score'
  allowed_dimensions: string[]
  default_filters: Record<string, unknown>
  source_tables: string[]
  owner_role: 'owner' | 'manager' | 'marketing' | 'analyst'
  version: number
  validation_status: 'validated'
}

export type CrmDimensionDefinition = {
  dimension_key: string
  display_name: string
  description: string
  source_table: string
  source_column: string
  value_type: 'text' | 'date' | 'number' | 'boolean' | 'location' | 'user' | 'enum'
  allowed_metrics: string[]
  default_grain?: string
  validation_status: 'validated'
}

export type CrmDashboardAudience = 'owner' | 'manager' | 'marketing' | 'loyalty' | 'data_quality'
export type CrmDashboardWidgetType = 'metric_card' | 'trend' | 'breakdown' | 'table' | 'alert_queue'

export type CrmDashboardTemplateWidget = {
  widget_key: string
  title: string
  widget_type: CrmDashboardWidgetType
  metric_keys: CrmMetricDefinition['metric_key'][]
  dimension_keys: CrmDimensionDefinition['dimension_key'][]
  visualization: 'table' | 'line' | 'bar' | 'stacked_bar' | 'area' | 'pie' | 'scorecard' | 'heatmap'
  position: { x: number; y: number; w: number; h: number }
  demo_value: string
  insight: string
  filters?: Record<string, unknown>
}

export type CrmDashboardTemplate = {
  template_key: string
  name: string
  audience: CrmDashboardAudience
  description: string
  widgets: CrmDashboardTemplateWidget[]
}

export const crmDashboardTemplates: CrmDashboardTemplate[] = [
  {
    template_key: 'weekly_snapshot',
    name: 'Weekly snapshot',
    audience: 'owner',
    description: 'Owner weekly readout for revenue, visits, and repeat behavior.',
    widgets: [
      { widget_key: 'weekly_revenue', title: 'Revenue', widget_type: 'metric_card', metric_keys: ['revenue'], dimension_keys: ['date'], visualization: 'scorecard', position: { x: 0, y: 0, w: 3, h: 2 }, demo_value: '$42.8K', insight: 'Revenue is pacing ahead of the prior weekly snapshot.' },
      { widget_key: 'repeat_visits', title: 'Repeat visits', widget_type: 'trend', metric_keys: ['repeat_visit'], dimension_keys: ['date'], visualization: 'line', position: { x: 3, y: 0, w: 5, h: 2 }, demo_value: '+18%', insight: 'Repeat guests are lifting midweek service.' },
    ],
  },
  {
    template_key: 'retention',
    name: 'Retention',
    audience: 'marketing',
    description: 'Track active, lapsed, and repeat guest movement.',
    widgets: [
      { widget_key: 'active_guests', title: 'Active guests', widget_type: 'metric_card', metric_keys: ['active_guest'], dimension_keys: ['guest_lifecycle_stage'], visualization: 'scorecard', position: { x: 0, y: 0, w: 3, h: 2 }, demo_value: '1,284', insight: 'Active known guests are healthy for the last 45 days.' },
      { widget_key: 'lapsed_by_stage', title: 'Lapsed by stage', widget_type: 'breakdown', metric_keys: ['lapsed_guest'], dimension_keys: ['guest_lifecycle_stage'], visualization: 'bar', position: { x: 3, y: 0, w: 5, h: 2 }, demo_value: '214', insight: 'Regulars make up the largest recovery audience.' },
    ],
  },
  {
    template_key: 'vip',
    name: 'VIP',
    audience: 'manager',
    description: 'Keep VIP value, visits, and service opportunities in one place.',
    widgets: [
      { widget_key: 'vip_ltv', title: 'VIP LTV', widget_type: 'metric_card', metric_keys: ['ltv'], dimension_keys: ['guest_lifecycle_stage'], visualization: 'scorecard', position: { x: 0, y: 0, w: 3, h: 2 }, demo_value: '$186K', insight: 'VIPs account for a concentrated share of known-guest value.', filters: { lifecycle_stage: 'vip' } },
      { widget_key: 'vip_visits', title: 'VIP visits', widget_type: 'trend', metric_keys: ['visit'], dimension_keys: ['date'], visualization: 'line', position: { x: 3, y: 0, w: 5, h: 2 }, demo_value: '96', insight: 'VIP visits are steady enough for manager-greet planning.', filters: { lifecycle_stage: 'vip' } },
    ],
  },
  {
    template_key: 'lapsed_recovery',
    name: 'Lapsed recovery',
    audience: 'marketing',
    description: 'Find lapsed guests and connect recovery campaign impact.',
    widgets: [
      { widget_key: 'lapsed_guests', title: 'Lapsed guests', widget_type: 'metric_card', metric_keys: ['lapsed_guest'], dimension_keys: ['campaign'], visualization: 'scorecard', position: { x: 0, y: 0, w: 3, h: 2 }, demo_value: '214', insight: 'The lapsed audience is large enough for a win-back campaign.' },
      { widget_key: 'recovery_revenue', title: 'Recovery revenue', widget_type: 'trend', metric_keys: ['campaign_attributed_revenue'], dimension_keys: ['campaign'], visualization: 'bar', position: { x: 3, y: 0, w: 5, h: 2 }, demo_value: '$7.2K', insight: 'Recent win-back campaigns are producing measurable revenue.' },
    ],
  },
  {
    template_key: 'campaign_roi',
    name: 'Campaign ROI',
    audience: 'owner',
    description: 'Attribute campaign revenue while excluding baseline guests.',
    widgets: [
      { widget_key: 'campaign_revenue', title: 'Attributed revenue', widget_type: 'metric_card', metric_keys: ['campaign_attributed_revenue'], dimension_keys: ['campaign'], visualization: 'scorecard', position: { x: 0, y: 0, w: 3, h: 2 }, demo_value: '$12.4K', insight: 'Campaigns are creating revenue beyond baseline guests.', filters: { include_baseline_guests: false } },
      { widget_key: 'campaign_repeat_visits', title: 'Repeat visits by campaign', widget_type: 'breakdown', metric_keys: ['repeat_visit'], dimension_keys: ['campaign'], visualization: 'bar', position: { x: 3, y: 0, w: 5, h: 2 }, demo_value: '148', insight: 'Repeat visits concentrate in two high-performing campaigns.' },
    ],
  },
  {
    template_key: 'loyalty_performance',
    name: 'Loyalty performance',
    audience: 'loyalty',
    description: 'Track loyalty revenue, redemption rate, and active members.',
    widgets: [
      { widget_key: 'loyalty_revenue', title: 'Loyalty revenue', widget_type: 'metric_card', metric_keys: ['loyalty_attributed_revenue'], dimension_keys: ['loyalty_program'], visualization: 'scorecard', position: { x: 0, y: 0, w: 3, h: 2 }, demo_value: '$19.1K', insight: 'Loyalty-linked checks continue to outperform unknown guests.' },
      { widget_key: 'redemption_rate', title: 'Redemption rate', widget_type: 'trend', metric_keys: ['redemption_rate'], dimension_keys: ['date'], visualization: 'line', position: { x: 3, y: 0, w: 5, h: 2 }, demo_value: '22%', insight: 'Reward usage is healthy without obvious abuse.' },
    ],
  },
  {
    template_key: 'menu_affinity',
    name: 'Menu affinity',
    audience: 'marketing',
    description: 'Use menu behavior as reporting context for guest campaigns.',
    widgets: [
      { widget_key: 'menu_revenue', title: 'Menu-influenced revenue', widget_type: 'trend', metric_keys: ['revenue'], dimension_keys: ['date'], visualization: 'line', position: { x: 0, y: 0, w: 4, h: 2 }, demo_value: '$31.6K', insight: 'Menu affinity is strongest on weekend dinner.' },
      { widget_key: 'menu_average_check', title: 'Average check', widget_type: 'metric_card', metric_keys: ['average_check'], dimension_keys: ['location'], visualization: 'scorecard', position: { x: 4, y: 0, w: 3, h: 2 }, demo_value: '$54.20', insight: 'Affinity-driven checks are above the restaurant average.' },
    ],
  },
  {
    template_key: 'new_guest_funnel',
    name: 'New guest funnel',
    audience: 'marketing',
    description: 'Watch first-time guests become second-time and regular guests.',
    widgets: [
      { widget_key: 'new_guest_visits', title: 'New guest visits', widget_type: 'metric_card', metric_keys: ['visit'], dimension_keys: ['guest_lifecycle_stage'], visualization: 'scorecard', position: { x: 0, y: 0, w: 3, h: 2 }, demo_value: '342', insight: 'New guest volume is strong enough to measure conversion.' },
      { widget_key: 'second_visit', title: 'Second visits', widget_type: 'breakdown', metric_keys: ['visit'], dimension_keys: ['guest_lifecycle_stage'], visualization: 'bar', position: { x: 3, y: 0, w: 5, h: 2 }, demo_value: '81', insight: 'Second-time conversion is the main funnel opportunity.' },
    ],
  },
  {
    template_key: 'service_recovery',
    name: 'Service recovery',
    audience: 'manager',
    description: 'Connect churn risk, recovery topics, and revenue impact.',
    widgets: [
      { widget_key: 'churn_risk', title: 'Churn risk', widget_type: 'alert_queue', metric_keys: ['churn_risk'], dimension_keys: ['recovery_topic'], visualization: 'heatmap', position: { x: 0, y: 0, w: 4, h: 2 }, demo_value: '64', insight: 'Food and speed issues are the highest-risk recovery topics.' },
      { widget_key: 'recovery_revenue', title: 'Recovered revenue', widget_type: 'metric_card', metric_keys: ['revenue'], dimension_keys: ['recovery_topic'], visualization: 'scorecard', position: { x: 4, y: 0, w: 3, h: 2 }, demo_value: '$3.8K', insight: 'Resolved cases are translating into return visits.' },
    ],
  },
  {
    template_key: 'server_hospitality_impact',
    name: 'Server hospitality impact',
    audience: 'manager',
    description: 'Show how server service correlates with check performance.',
    widgets: [
      { widget_key: 'server_average_check', title: 'Average check by server', widget_type: 'breakdown', metric_keys: ['average_check'], dimension_keys: ['server'], visualization: 'bar', position: { x: 0, y: 0, w: 5, h: 2 }, demo_value: '$58.10', insight: 'Top hospitality servers are driving stronger checks.' },
    ],
  },
  {
    template_key: 'location_comparison',
    name: 'Location comparison',
    audience: 'owner',
    description: 'Compare revenue, visits, and active guests across locations.',
    widgets: [
      { widget_key: 'location_revenue', title: 'Revenue by location', widget_type: 'breakdown', metric_keys: ['revenue'], dimension_keys: ['location'], visualization: 'bar', position: { x: 0, y: 0, w: 4, h: 2 }, demo_value: '$84.3K', insight: 'Downtown is outpacing other locations this period.' },
      { widget_key: 'location_active_guests', title: 'Active guests', widget_type: 'breakdown', metric_keys: ['active_guest'], dimension_keys: ['location'], visualization: 'bar', position: { x: 4, y: 0, w: 4, h: 2 }, demo_value: '2,110', insight: 'Active guest distribution follows revenue mix.' },
    ],
  },
  {
    template_key: 'birthday_performance',
    name: 'Birthday performance',
    audience: 'marketing',
    description: 'Measure birthday program revenue and repeat behavior.',
    widgets: [
      { widget_key: 'birthday_revenue', title: 'Birthday revenue', widget_type: 'metric_card', metric_keys: ['campaign_attributed_revenue'], dimension_keys: ['campaign'], visualization: 'scorecard', position: { x: 0, y: 0, w: 3, h: 2 }, demo_value: '$4.9K', insight: 'Birthday campaigns are converting high-intent guests.', filters: { campaign_type: 'birthday' } },
    ],
  },
  {
    template_key: 'discount_abuse',
    name: 'Discount abuse',
    audience: 'owner',
    description: 'Watch revenue, redemption, and possible offer sensitivity.',
    widgets: [
      { widget_key: 'discount_revenue', title: 'Offer revenue', widget_type: 'trend', metric_keys: ['campaign_attributed_revenue'], dimension_keys: ['campaign'], visualization: 'bar', position: { x: 0, y: 0, w: 4, h: 2 }, demo_value: '$6.1K', insight: 'One offer is revenue-positive but may be training discounts.' },
      { widget_key: 'discount_repeat', title: 'Repeat after offer', widget_type: 'metric_card', metric_keys: ['repeat_visit'], dimension_keys: ['campaign'], visualization: 'scorecard', position: { x: 4, y: 0, w: 3, h: 2 }, demo_value: '37', insight: 'Repeat behavior is the guardrail for discount quality.' },
    ],
  },
  {
    template_key: 'reward_liability',
    name: 'Reward liability',
    audience: 'loyalty',
    description: 'Track redemptions and loyalty revenue for liability review.',
    widgets: [
      { widget_key: 'reward_redemption_rate', title: 'Redemption rate', widget_type: 'metric_card', metric_keys: ['redemption_rate'], dimension_keys: ['loyalty_program'], visualization: 'scorecard', position: { x: 0, y: 0, w: 3, h: 2 }, demo_value: '22%', insight: 'Redemptions are below the liability alert threshold.' },
      { widget_key: 'reward_revenue', title: 'Loyalty revenue', widget_type: 'trend', metric_keys: ['loyalty_attributed_revenue'], dimension_keys: ['date'], visualization: 'line', position: { x: 3, y: 0, w: 5, h: 2 }, demo_value: '$19.1K', insight: 'Revenue offsets current redemption liability.' },
    ],
  },
  {
    template_key: 'no_show_risk',
    name: 'No-show risk',
    audience: 'manager',
    description: 'Use lifecycle and churn signals to prioritize reservation follow-up.',
    widgets: [
      { widget_key: 'no_show_churn_risk', title: 'No-show churn risk', widget_type: 'alert_queue', metric_keys: ['churn_risk'], dimension_keys: ['guest_lifecycle_stage'], visualization: 'heatmap', position: { x: 0, y: 0, w: 4, h: 2 }, demo_value: '58', insight: 'At-risk guests need confirmation and manager follow-up.' },
    ],
  },
  {
    template_key: 'ltv_leaderboard',
    name: 'LTV leaderboard',
    audience: 'owner',
    description: 'Rank guest value by lifecycle and location.',
    widgets: [
      { widget_key: 'ltv_by_stage', title: 'LTV by stage', widget_type: 'table', metric_keys: ['ltv'], dimension_keys: ['guest_lifecycle_stage', 'location'], visualization: 'table', position: { x: 0, y: 0, w: 6, h: 3 }, demo_value: '$312K', insight: 'Regulars and VIPs lead lifetime value concentration.' },
    ],
  },
]

export const crmSemanticMetricDefinitions: CrmMetricDefinition[] = [
  {
    metric_key: 'revenue',
    display_name: 'Revenue',
    description: 'Closed-order gross sales before refunds and ROI exclusions.',
    formula: 'sum(orders.total) where orders.status = closed',
    value_type: 'currency',
    allowed_dimensions: ['date', 'location', 'campaign', 'loyalty_program', 'recovery_topic'],
    default_filters: { order_status: 'closed' },
    source_tables: ['orders'],
    owner_role: 'owner',
    version: 1,
    validation_status: 'validated',
  },
  {
    metric_key: 'net_revenue',
    display_name: 'Net revenue',
    description: 'Closed-order sales after discounts and refunds.',
    formula: 'sum(orders.total - orders.discount_total) where orders.status = closed',
    value_type: 'currency',
    allowed_dimensions: ['date', 'location', 'campaign', 'loyalty_program'],
    default_filters: { order_status: 'closed' },
    source_tables: ['orders'],
    owner_role: 'owner',
    version: 1,
    validation_status: 'validated',
  },
  {
    metric_key: 'average_check',
    display_name: 'Average check',
    description: 'Average closed order total.',
    formula: 'sum(orders.total) / nullif(count(distinct orders.id), 0)',
    value_type: 'currency',
    allowed_dimensions: ['date', 'location', 'server', 'campaign'],
    default_filters: { order_status: 'closed' },
    source_tables: ['orders'],
    owner_role: 'manager',
    version: 1,
    validation_status: 'validated',
  },
  {
    metric_key: 'ltv',
    display_name: 'Guest LTV',
    description: 'Known guest lifetime value from closed checks.',
    formula: 'sum(orders.total) grouped by guest_id or customer_id over all time',
    value_type: 'currency',
    allowed_dimensions: ['guest_lifecycle_stage', 'location', 'campaign', 'loyalty_program'],
    default_filters: { order_status: 'closed', known_guest_only: true },
    source_tables: ['orders', 'guests'],
    owner_role: 'owner',
    version: 1,
    validation_status: 'validated',
  },
  {
    metric_key: 'visit',
    display_name: 'Visits',
    description: 'Closed checks counted as guest visits.',
    formula: 'count(distinct orders.id) where orders.status = closed',
    value_type: 'count',
    allowed_dimensions: ['date', 'location', 'guest_lifecycle_stage', 'campaign'],
    default_filters: { order_status: 'closed' },
    source_tables: ['orders'],
    owner_role: 'manager',
    version: 1,
    validation_status: 'validated',
  },
  {
    metric_key: 'repeat_visit',
    display_name: 'Repeat visits',
    description: 'Visits by guests with at least one prior closed visit.',
    formula: 'count(visits) where guest prior_closed_visit_count >= 1',
    value_type: 'count',
    allowed_dimensions: ['date', 'location', 'campaign', 'loyalty_program'],
    default_filters: { known_guest_only: true },
    source_tables: ['orders', 'guests'],
    owner_role: 'manager',
    version: 1,
    validation_status: 'validated',
  },
  {
    metric_key: 'lapsed_guest',
    display_name: 'Lapsed guests',
    description: 'Known guests whose last visit is outside the configured lapsed window.',
    formula: 'count(guests.id) where days_since_last_visit >= lapsed_days',
    value_type: 'count',
    allowed_dimensions: ['guest_lifecycle_stage', 'location', 'campaign'],
    default_filters: { lapsed_days: 45 },
    source_tables: ['guests'],
    owner_role: 'marketing',
    version: 1,
    validation_status: 'validated',
  },
  {
    metric_key: 'active_guest',
    display_name: 'Active guests',
    description: 'Known guests with recent closed visits.',
    formula: 'count(guests.id) where days_since_last_visit <= active_days',
    value_type: 'count',
    allowed_dimensions: ['guest_lifecycle_stage', 'location', 'loyalty_program'],
    default_filters: { active_days: 45 },
    source_tables: ['guests'],
    owner_role: 'marketing',
    version: 1,
    validation_status: 'validated',
  },
  {
    metric_key: 'campaign_attributed_revenue',
    display_name: 'Campaign attributed revenue',
    description: 'Campaign revenue events counted by attribution rules, excluding baseline guests.',
    formula: 'sum(crm_attribution_events.revenue_amount) where event_type = revenue and excluded_from_roi = false',
    value_type: 'currency',
    allowed_dimensions: ['campaign', 'date', 'location', 'guest_lifecycle_stage'],
    default_filters: { excluded_from_roi: false },
    source_tables: ['crm_attribution_events'],
    owner_role: 'marketing',
    version: 1,
    validation_status: 'validated',
  },
  {
    metric_key: 'loyalty_attributed_revenue',
    display_name: 'Loyalty attributed revenue',
    description: 'Closed-order revenue linked to loyalty accounts or reward redemption.',
    formula: 'sum(orders.total) where loyalty_account_id is not null or reward_redemption_id is not null',
    value_type: 'currency',
    allowed_dimensions: ['loyalty_program', 'date', 'location', 'guest_lifecycle_stage'],
    default_filters: { order_status: 'closed' },
    source_tables: ['orders', 'crm_loyalty_accounts', 'crm_reward_redemptions'],
    owner_role: 'owner',
    version: 1,
    validation_status: 'validated',
  },
  {
    metric_key: 'redemption_rate',
    display_name: 'Redemption rate',
    description: 'Applied reward redemptions divided by issued rewards.',
    formula: 'count(applied redemptions) / nullif(count(issued rewards), 0)',
    value_type: 'percent',
    allowed_dimensions: ['loyalty_program', 'date', 'location'],
    default_filters: {},
    source_tables: ['crm_rewards', 'crm_reward_redemptions'],
    owner_role: 'owner',
    version: 1,
    validation_status: 'validated',
  },
  {
    metric_key: 'churn_risk',
    display_name: 'Churn risk',
    description: 'Weighted score from visit recency, negative feedback, lapsed stage, and recovery state.',
    formula: 'weighted_score(days_since_last_visit, negative_feedback_count, lifecycle_stage, unresolved_recovery_cases)',
    value_type: 'score',
    allowed_dimensions: ['guest_lifecycle_stage', 'location', 'recovery_topic'],
    default_filters: { score_range: [0, 100] },
    source_tables: ['guests', 'crm_complaints', 'crm_recovery_cases'],
    owner_role: 'manager',
    version: 1,
    validation_status: 'validated',
  },
]

export const crmSemanticDimensionDefinitions: CrmDimensionDefinition[] = [
  { dimension_key: 'date', display_name: 'Date', description: 'Calendar date from the reporting event.', source_table: 'orders', source_column: 'closed_at', value_type: 'date', allowed_metrics: ['revenue', 'net_revenue', 'average_check', 'visit', 'repeat_visit', 'campaign_attributed_revenue', 'loyalty_attributed_revenue', 'redemption_rate'], default_grain: 'day', validation_status: 'validated' },
  { dimension_key: 'location', display_name: 'Location', description: 'Restaurant location.', source_table: 'locations', source_column: 'id', value_type: 'location', allowed_metrics: ['revenue', 'net_revenue', 'average_check', 'ltv', 'visit', 'repeat_visit', 'lapsed_guest', 'active_guest', 'campaign_attributed_revenue', 'loyalty_attributed_revenue', 'redemption_rate', 'churn_risk'], validation_status: 'validated' },
  { dimension_key: 'campaign', display_name: 'Campaign', description: 'CRM campaign source.', source_table: 'crm_campaigns', source_column: 'id', value_type: 'text', allowed_metrics: ['revenue', 'net_revenue', 'average_check', 'ltv', 'visit', 'repeat_visit', 'lapsed_guest', 'campaign_attributed_revenue'], validation_status: 'validated' },
  { dimension_key: 'loyalty_program', display_name: 'Loyalty program', description: 'Loyalty program or tier context.', source_table: 'crm_loyalty_programs', source_column: 'id', value_type: 'text', allowed_metrics: ['revenue', 'net_revenue', 'ltv', 'repeat_visit', 'active_guest', 'loyalty_attributed_revenue', 'redemption_rate'], validation_status: 'validated' },
  { dimension_key: 'guest_lifecycle_stage', display_name: 'Guest lifecycle stage', description: 'Current lifecycle stage on the guest profile.', source_table: 'guests', source_column: 'lifecycle_stage', value_type: 'enum', allowed_metrics: ['ltv', 'visit', 'repeat_visit', 'lapsed_guest', 'active_guest', 'campaign_attributed_revenue', 'loyalty_attributed_revenue', 'churn_risk'], validation_status: 'validated' },
  { dimension_key: 'recovery_topic', display_name: 'Recovery topic', description: 'Service recovery issue topic.', source_table: 'crm_recovery_cases', source_column: 'topics', value_type: 'enum', allowed_metrics: ['revenue', 'churn_risk'], validation_status: 'validated' },
  { dimension_key: 'server', display_name: 'Server', description: 'Server attached to the closed check.', source_table: 'orders', source_column: 'server_id', value_type: 'user', allowed_metrics: ['average_check'], validation_status: 'validated' },
]

export function metricDefinitionMap(metrics = crmSemanticMetricDefinitions): Map<string, CrmMetricDefinition> {
  return new Map(metrics.map((metric) => [metric.metric_key, metric]))
}

export function validateReportMetricSelection(input: {
  metric_keys: string[]
  dimension_keys?: string[]
  metrics?: CrmMetricDefinition[]
  dimensions?: CrmDimensionDefinition[]
}): { ok: true; warnings: string[] } | { ok: false; errors: string[]; warnings: string[] } {
  const metrics = metricDefinitionMap(input.metrics)
  const dimensions = new Map((input.dimensions ?? crmSemanticDimensionDefinitions).map((dimension) => [dimension.dimension_key, dimension]))
  const errors: string[] = []
  const warnings: string[] = []

  for (const key of input.metric_keys) {
    if (!metrics.has(key)) errors.push(`Unknown metric: ${key}`)
  }

  for (const dimensionKey of input.dimension_keys ?? []) {
    const dimension = dimensions.get(dimensionKey)
    if (!dimension) {
      errors.push(`Unknown dimension: ${dimensionKey}`)
      continue
    }
    for (const metricKey of input.metric_keys) {
      const metric = metrics.get(metricKey)
      if (metric && !metric.allowed_dimensions.includes(dimensionKey)) {
        errors.push(`Metric ${metricKey} cannot be broken down by ${dimensionKey}`)
      }
      if (!dimension.allowed_metrics.includes(metricKey)) {
        warnings.push(`Dimension ${dimensionKey} is not optimized for ${metricKey}`)
      }
    }
  }

  return errors.length > 0 ? { ok: false, errors, warnings } : { ok: true, warnings }
}

export function explainReportDefinition(input: { metric_keys: string[]; dimension_keys?: string[] }): string {
  const metrics = metricDefinitionMap()
  const metricNames = input.metric_keys.map((key) => metrics.get(key)?.display_name ?? key).join(', ')
  const dimensionText = input.dimension_keys?.length ? ` broken down by ${input.dimension_keys.join(', ')}` : ''
  return `This report uses the semantic metric layer for ${metricNames}${dimensionText}. Each metric is versioned and validated before reports can run.`
}

export function validateDashboardWidgets(widgets: Pick<CrmDashboardTemplateWidget, 'metric_keys' | 'dimension_keys'>[]) {
  const errors: string[] = []
  const warnings: string[] = []

  widgets.forEach((widget, index) => {
    const result = validateReportMetricSelection({
      metric_keys: widget.metric_keys,
      dimension_keys: widget.dimension_keys,
    })
    if (!result.ok) errors.push(...result.errors.map((error) => `Widget ${index + 1}: ${error}`))
    warnings.push(...result.warnings.map((warning) => `Widget ${index + 1}: ${warning}`))
  })

  return errors.length ? { ok: false as const, errors, warnings } : { ok: true as const, warnings }
}

export function getCrmDashboardTemplate(templateKey: string) {
  return crmDashboardTemplates.find((template) => template.template_key === templateKey) ?? null
}

export async function listOrgMetricDefinitions(input: { db: Db; user: Pick<AuthUser, 'org_id'> }) {
  const { data, error } = await input.db
    .from('crm_metric_definitions')
    .select('*')
    .eq('org_id', input.user.org_id)
    .is('deleted_at', null)
    .order('metric_key')

  if (error) return crmSemanticMetricDefinitions
  const custom = (data ?? []) as CrmMetricDefinition[]
  const customKeys = new Set(custom.map((item) => item.metric_key))
  return [...custom, ...crmSemanticMetricDefinitions.filter((item) => !customKeys.has(item.metric_key))]
}

export async function listOrgDimensionDefinitions(input: { db: Db; user: Pick<AuthUser, 'org_id'> }) {
  const { data, error } = await input.db
    .from('crm_dimension_definitions')
    .select('*')
    .eq('org_id', input.user.org_id)
    .is('deleted_at', null)
    .order('dimension_key')

  if (error) return crmSemanticDimensionDefinitions
  const custom = (data ?? []) as CrmDimensionDefinition[]
  const customKeys = new Set(custom.map((item) => item.dimension_key))
  return [...custom, ...crmSemanticDimensionDefinitions.filter((item) => !customKeys.has(item.dimension_key))]
}
