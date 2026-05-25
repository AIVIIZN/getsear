import type { AuthUser } from '@/lib/api/auth'
import { crmGuestOwnerRoles } from '@/lib/crm/api'
import { createAdminClient } from '@/lib/supabase/admin'
import type { z } from 'zod'
import type { restaurantMemoryRuleSchema, restaurantMemoryAppliesToSchema } from '@/lib/schemas/crm'

type DbClient = ReturnType<typeof createAdminClient>
export type RestaurantMemoryAppliesTo = z.infer<typeof restaurantMemoryAppliesToSchema>
export type RestaurantMemoryRuleInput = z.infer<typeof restaurantMemoryRuleSchema>

export type RestaurantMemoryRule = RestaurantMemoryRuleInput & {
  id: string
  org_id: string
  created_at: string
  updated_at: string
}

export const defaultRestaurantMemoryRules: RestaurantMemoryRuleInput[] = [
  {
    rule_key: 'no-aggressive-discounts',
    category: 'discount_policy',
    title: 'No aggressive discounts',
    rule_text: 'Do not lead with aggressive discounts. Prefer hospitality, recognition, and curated invitations before price cuts.',
    applies_to: ['campaign', 'next_best_action', 'recovery_message'],
    priority: 10,
    active: true,
  },
  {
    rule_key: 'vip-invites-not-coupons',
    category: 'vip_hospitality',
    title: 'VIP invites are not coupons',
    rule_text: 'VIP guests should receive personal invitations, manager greetings, priority reservations, or event access instead of coupon language.',
    applies_to: ['campaign', 'next_best_action', 'server_brief'],
    priority: 20,
    active: true,
  },
  {
    rule_key: 'birthday-dessert',
    category: 'birthday',
    title: 'Birthdays get dessert',
    rule_text: 'Birthday recommendations should offer a complimentary dessert or hospitality moment, not a percent discount.',
    applies_to: ['campaign', 'next_best_action'],
    priority: 30,
    active: true,
  },
  {
    rule_key: 'wine-guests-event-invites',
    category: 'wine',
    title: 'Wine guests get event invites',
    rule_text: 'Guests with wine preferences should be invited to tastings, pairing dinners, and cellar events.',
    applies_to: ['campaign', 'next_best_action'],
    priority: 40,
    active: true,
  },
]

export function canManageRestaurantMemory(user: Pick<AuthUser, 'role'>): boolean {
  return crmGuestOwnerRoles.includes(user.role as never)
}

function normalizeRule(rule: RestaurantMemoryRuleInput): RestaurantMemoryRuleInput {
  return {
    ...rule,
    rule_key: rule.rule_key.trim().toLowerCase(),
    title: rule.title.trim(),
    rule_text: rule.rule_text.trim(),
    applies_to: [...new Set(rule.applies_to)],
  }
}

export async function listRestaurantMemoryRules(input: {
  user: Pick<AuthUser, 'org_id'>
  db?: DbClient
}): Promise<RestaurantMemoryRule[]> {
  const db = input.db ?? createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db.from('restaurant_memory_rules') as any)
    .select('id, org_id, location_id, rule_key, category, title, rule_text, applies_to, priority, active, created_at, updated_at')
    .eq('org_id', input.user.org_id)
    .is('deleted_at', null)
    .order('priority', { ascending: true })
    .order('updated_at', { ascending: false })

  return (data ?? []) as RestaurantMemoryRule[]
}

export async function fetchActiveRestaurantMemoryRules(input: {
  user: Pick<AuthUser, 'org_id'>
  appliesTo?: RestaurantMemoryAppliesTo
  locationId?: string | null
  db?: DbClient
}): Promise<RestaurantMemoryRule[]> {
  const db = input.db ?? createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (db.from('restaurant_memory_rules') as any)
    .select('id, org_id, location_id, rule_key, category, title, rule_text, applies_to, priority, active, created_at, updated_at')
    .eq('org_id', input.user.org_id)
    .eq('active', true)
    .is('deleted_at', null)
    .order('priority', { ascending: true })
    .limit(24)

  if (input.locationId) query = query.or(`location_id.is.null,location_id.eq.${input.locationId}`)
  if (input.appliesTo) query = query.contains('applies_to', [input.appliesTo])

  const { data } = await query
  const rules = (data ?? []) as RestaurantMemoryRule[]
  if (rules.length > 0) return rules

  const now = new Date().toISOString()
  return defaultRestaurantMemoryRules
    .filter((rule) => rule.active && (!input.appliesTo || rule.applies_to.includes(input.appliesTo)))
    .map((rule) => ({
      ...rule,
      id: `default-${rule.rule_key}`,
      org_id: input.user.org_id,
      created_at: now,
      updated_at: now,
    }))
}

export async function upsertRestaurantMemoryRules(input: {
  user: Pick<AuthUser, 'id' | 'org_id'>
  rules: RestaurantMemoryRuleInput[]
  db?: DbClient
}): Promise<RestaurantMemoryRule[]> {
  const db = input.db ?? createAdminClient()
  const rows = input.rules.map((rawRule) => {
    const rule = normalizeRule(rawRule)
    return {
      ...rule,
      org_id: input.user.org_id,
      updated_by_user_id: input.user.id,
      created_by_user_id: input.user.id,
      updated_at: new Date().toISOString(),
      deleted_at: null,
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.from('restaurant_memory_rules') as any)
    .upsert(rows, { onConflict: 'org_id,rule_key' })
    .select('id, org_id, location_id, rule_key, category, title, rule_text, applies_to, priority, active, created_at, updated_at')

  if (error) throw new Error(error.message)
  return (data ?? []) as RestaurantMemoryRule[]
}

export async function seedDefaultRestaurantMemoryRules(input: {
  user: Pick<AuthUser, 'id' | 'org_id'>
  db?: DbClient
}): Promise<RestaurantMemoryRule[]> {
  const existing = await listRestaurantMemoryRules({ user: input.user, db: input.db })
  if (existing.length > 0) return existing
  return upsertRestaurantMemoryRules({ user: input.user, rules: defaultRestaurantMemoryRules, db: input.db })
}

export function restaurantMemoryRulesToSource(rules: RestaurantMemoryRule[]) {
  return {
    source_id: 'restaurant-memory:active-rules',
    source_type: 'restaurant_memory' as const,
    title: 'Restaurant Memory Rules',
    visibility: 'service' as const,
    data: {
      records: rules.map((rule) => ({
        rule_key: rule.rule_key,
        category: rule.category,
        title: rule.title,
        rule_text: rule.rule_text,
        applies_to: rule.applies_to,
        priority: rule.priority,
      })),
    },
  }
}

export function applyRestaurantMemoryToText(text: string, rules: Array<{ rule_text: string; category: string }>): string {
  let output = text
  const lowerRules = rules.map((rule) => `${rule.category} ${rule.rule_text}`.toLowerCase())
  if (lowerRules.some((rule) => rule.includes('no aggressive discounts') || rule.includes('not a percent discount'))) {
    output = output.replace(/\b\d{1,2}%\s+off\b/gi, 'a curated hospitality moment')
    output = output.replace(/\bpercent discount\b/gi, 'hospitality gesture')
    output = output.replace(/\bcoupon(s)?\b/gi, 'personal invitation')
  }
  if (lowerRules.some((rule) => rule.includes('birthday') && rule.includes('dessert')) && /birthday/i.test(output)) {
    output = output.replace(/birthday reward/gi, 'birthday dessert')
  }
  return output
}
