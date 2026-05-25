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
