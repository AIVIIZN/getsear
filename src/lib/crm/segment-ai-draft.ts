import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import {
  crmSegmentRuleGroupSchema,
  type CrmSegmentRuleGroupInput,
  type CrmSegmentRuleInput,
} from '@/lib/schemas/crm'

type Provider = 'gemini' | 'openai' | 'rules'

type SegmentDraft = {
  name: string
  description: string
  match_mode: 'all' | 'any'
  rule_tree: CrmSegmentRuleGroupInput
  translation: string[]
  confidence: number
  provider: Provider
  source_citations: string[]
  warnings: string[]
}

export type CrmSegmentDraftResult =
  | { status: 'draft'; draft: SegmentDraft }
  | { status: 'refused'; reason: string; safety_flags: string[] }

const UNSAFE_PATTERNS = [
  { pattern: /\b(race|ethnicity|religion|church|mosque|synagogue|political|party affiliation)\b/i, flag: 'protected_class_targeting' },
  { pattern: /\b(gender|sexual orientation|marital status|national origin|citizenship)\b/i, flag: 'protected_class_targeting' },
  { pattern: /\b(disability|pregnan|medical|diagnosis|health condition|mental health)\b/i, flag: 'health_or_disability_targeting' },
  { pattern: /\b(minor|children|kids only|under 18|age over|age under)\b/i, flag: 'age_targeting' },
  { pattern: /\b(password|card number|ssn|social security|raw sql|drop table|delete from)\b/i, flag: 'unsafe_data_or_sql_request' },
]

const FIELD_LABELS: Record<CrmSegmentRuleInput['field'], string> = {
  lifecycle_stage: 'Lifecycle stage',
  total_spend: 'Lifetime spend',
  total_visits: 'Visit count',
  average_check: 'Average check',
  days_since_last_visit: 'Days since last visit',
  birthday_month: 'Birthday month',
  location_id: 'Location',
  is_vip: 'VIP flag',
  tag_slug: 'Smart tag',
  tag_category: 'Tag category',
  email_marketing_consent: 'Email marketing consent',
  sms_marketing_consent: 'SMS marketing consent',
  loyalty_points_balance: 'Loyalty points balance',
  loyalty_tier: 'Loyalty tier',
  favorite_item_contains: 'Menu item affinity',
  order_channel: 'Order channel',
}

function unsafeFlags(prompt: string): string[] {
  return UNSAFE_PATTERNS.filter(({ pattern }) => pattern.test(prompt)).map(({ flag }) => flag)
}

function numberNear(prompt: string, patterns: RegExp[], fallback: number): number {
  for (const pattern of patterns) {
    const match = prompt.match(pattern)
    if (match?.[1] && Number.isFinite(Number(match[1]))) return Number(match[1])
  }
  return fallback
}

function inactivityDays(prompt: string): number {
  const months = prompt.match(/(\d+)\s+months?/)
  if (months?.[1] && Number.isFinite(Number(months[1]))) return Number(months[1]) * 30
  return numberNear(prompt, [/(\d+)\s+days?/], 60)
}

function addRule(rules: CrmSegmentRuleInput[], rule: CrmSegmentRuleInput) {
  if (!rules.some((item) => item.field === rule.field && item.operator === rule.operator && String(item.value) === String(rule.value))) {
    rules.push(rule)
  }
}

function deterministicDraft(prompt: string): SegmentDraft {
  const lower = prompt.toLowerCase()
  const rules: CrmSegmentRuleInput[] = []
  const warnings: string[] = []

  if (/\b(vip|high value|best guests|top guests)\b/.test(lower)) addRule(rules, { field: 'is_vip', operator: 'equals', value: true })
  if (/\bregular|repeat|loyal\b/.test(lower)) addRule(rules, { field: 'total_visits', operator: 'greater_than', value: numberNear(lower, [/(?:more than|over|at least)\s+(\d+)\s+(?:visits|orders|checks)/], 4) })
  if (/\blapsed|at risk|haven'?t been|have not been|not visited|no visit|win back|winback\b/.test(lower)) addRule(rules, { field: 'days_since_last_visit', operator: 'days_since', value: inactivityDays(lower) })
  if (/\bspend|spent|lifetime|ltv\b/.test(lower)) addRule(rules, { field: 'total_spend', operator: 'greater_than', value: numberNear(lower, [/\$?(\d+)\+?\s+(?:spent|spend|lifetime|ltv)/, /(?:over|more than|at least)\s+\$?(\d+)/], 500) })
  if (/\bemail|newsletter\b/.test(lower)) addRule(rules, { field: 'email_marketing_consent', operator: 'equals', value: true })
  if (/\bsms|text message|texts\b/.test(lower)) addRule(rules, { field: 'sms_marketing_consent', operator: 'equals', value: true })
  if (/\bbirthday\b/.test(lower)) addRule(rules, { field: 'birthday_month', operator: 'exists' })
  if (/\bloyalty|points\b/.test(lower)) addRule(rules, { field: 'loyalty_points_balance', operator: 'greater_than', value: numberNear(lower, [/(\d+)\s+points/], 0) })

  const favoriteMatch = lower.match(/(?:like|likes|love|loves|ordered|order|affinity for)\s+([a-z][a-z\s-]{2,40})(?:\s+and|\s+with|$|,|\.)/)
  if (favoriteMatch?.[1]) {
    addRule(rules, { field: 'favorite_item_contains', operator: 'contains', value: favoriteMatch[1].trim() })
  }
  if (/\bdelivery\b/.test(lower)) addRule(rules, { field: 'order_channel', operator: 'equals', value: 'delivery' })
  if (/\bdine[- ]?in\b/.test(lower)) addRule(rules, { field: 'order_channel', operator: 'equals', value: 'dine_in' })

  if (rules.length === 0) {
    warnings.push('The request was broad, so the draft uses repeat visits as the safest starting signal.')
    addRule(rules, { field: 'total_visits', operator: 'greater_than', value: 1 })
  }

  const rule_tree = crmSegmentRuleGroupSchema.parse({ match: lower.includes(' or ') ? 'any' : 'all', rules })
  return {
    name: prompt.slice(0, 68).replace(/[.?!]+$/, '') || 'AI drafted segment',
    description: `Drafted from operator request: "${prompt.slice(0, 160)}"`,
    match_mode: rule_tree.match,
    rule_tree,
    translation: rules.map((rule) => `${FIELD_LABELS[rule.field]} ${rule.operator.replace(/_/g, ' ')}${rule.value === undefined ? '' : ` ${Array.isArray(rule.value) ? rule.value.join(' and ') : String(rule.value)}`}`),
    confidence: rules.length > 1 ? 0.78 : 0.62,
    provider: 'rules',
    source_citations: ['CRM semantic segment fields', 'Guest profile, consent, loyalty, order, and tag facts'],
    warnings,
  }
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i)?.[1]
  const source = fenced ?? text.match(/\{[\s\S]*\}/)?.[0] ?? text
  return JSON.parse(source)
}

function validateModelDraft(value: unknown, fallbackPrompt: string, provider: Provider): SegmentDraft {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const rule_tree = crmSegmentRuleGroupSchema.parse(row.rule_tree)
  return {
    name: typeof row.name === 'string' && row.name.trim() ? row.name.trim().slice(0, 160) : fallbackPrompt.slice(0, 68),
    description: typeof row.description === 'string' ? row.description.slice(0, 1000) : `Drafted from operator request: "${fallbackPrompt.slice(0, 160)}"`,
    match_mode: rule_tree.match,
    rule_tree,
    translation: Array.isArray(row.translation) ? row.translation.map(String).slice(0, 12) : deterministicDraft(fallbackPrompt).translation,
    confidence: typeof row.confidence === 'number' ? Math.min(1, Math.max(0, row.confidence)) : 0.7,
    provider,
    source_citations: ['CRM semantic segment fields', 'Model output validated by Zod before use'],
    warnings: Array.isArray(row.warnings) ? row.warnings.map(String).slice(0, 6) : [],
  }
}

async function callModel(prompt: string, provider: Exclude<Provider, 'rules'>): Promise<SegmentDraft | null> {
  const system = [
    'Return only JSON for a restaurant CRM audience segment draft.',
    'Allowed fields: lifecycle_stage,total_spend,total_visits,average_check,days_since_last_visit,birthday_month,location_id,is_vip,tag_slug,tag_category,email_marketing_consent,sms_marketing_consent,loyalty_points_balance,loyalty_tier,favorite_item_contains,order_channel.',
    'Allowed operators: equals,not_equals,contains,greater_than,less_than,between,exists,not_exists,days_since,count_at_least.',
    'Shape: {"name":string,"description":string,"rule_tree":{"match":"all"|"any","rules":[{"field":string,"operator":string,"value":string|number|boolean|[number,number]}]},"translation":string[],"confidence":number,"warnings":string[]}.',
    'Do not target protected classes, health, religion, politics, minors, raw SQL, or payment credentials.',
  ].join(' ')

  if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
    const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = client.getGenerativeModel({ model: process.env.GEMINI_CRM_MODEL ?? 'gemini-2.0-flash' })
    const result = await model.generateContent(`${system}\n\nRequest: ${prompt}`)
    return validateModelDraft(extractJson(result.response.text()), prompt, 'gemini')
  }

  if (provider === 'openai' && process.env.OPENAI_API_KEY) {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const result = await client.chat.completions.create({
      model: process.env.OPENAI_CRM_MODEL ?? 'gpt-4.1-mini',
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
      temperature: 0.1,
    })
    const text = result.choices[0]?.message.content
    return text ? validateModelDraft(extractJson(text), prompt, 'openai') : null
  }

  return null
}

export async function buildCrmSegmentDraft(prompt: string): Promise<CrmSegmentDraftResult> {
  const flags = unsafeFlags(prompt)
  if (flags.length > 0) {
    return {
      status: 'refused',
      reason: 'This request appears to target sensitive or unsafe attributes. Use behavioral, consent, loyalty, menu, visit, or lifecycle signals instead.',
      safety_flags: flags,
    }
  }

  const provider: Provider = process.env.GEMINI_API_KEY ? 'gemini' : process.env.OPENAI_API_KEY ? 'openai' : 'rules'
  if (provider !== 'rules') {
    try {
      const draft = await callModel(prompt, provider)
      if (draft) return { status: 'draft', draft }
    } catch {
      return { status: 'draft', draft: { ...deterministicDraft(prompt), warnings: ['Model draft failed validation, so a deterministic semantic draft was used.'] } }
    }
  }

  return { status: 'draft', draft: deterministicDraft(prompt) }
}
