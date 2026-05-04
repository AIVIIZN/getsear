/**
 * Recipient resolution for marketing campaigns.
 *
 * V5 batch 5.1.2 — given a campaign's `target_segment` (jsonb criteria),
 * returns the list of customers in this org who:
 *   1. Match every segment filter the campaign specifies, AND
 *   2. Are actively opted-in to marketing for the campaign's channel
 *      (email opt-in for email campaigns, SMS opt-in for SMS campaigns), AND
 *   3. Have a deliverable contact field (non-empty email / phone).
 *
 * The shape of `target_segment` mirrors the criteria already supported by
 * `GET /api/marketing/segments` so the same operator vocabulary works in
 * both places.
 */

import { z } from 'zod'
import { type SupabaseClient } from '@supabase/supabase-js'

/** Channel a campaign is being sent on. Drives opt-in + contact-field gating. */
export type CampaignChannel = 'email' | 'sms' | 'both'

/**
 * The segment-criteria DSL persisted on `campaigns.target_segment`. Every
 * field is optional — an empty object selects every opted-in customer in
 * the org.
 */
export const segmentCriteriaSchema = z
  .object({
    /** Customers must have at least this many lifetime visits. */
    min_visits: z.number().int().min(0).optional(),
    /** Customers must have at most this many lifetime visits. */
    max_visits: z.number().int().min(0).optional(),
    /** Lifetime spend floor (numeric, decimal string accepted). */
    min_spend: z.union([z.number(), z.string()]).optional(),
    /** Lifetime spend ceiling. */
    max_spend: z.union([z.number(), z.string()]).optional(),
    /** Last visit must be within the last N days. */
    last_visit_within_days: z.number().int().min(0).optional(),
    /** Last visit must be more than N days ago (re-engagement). */
    last_visit_more_than_days: z.number().int().min(0).optional(),
    /** Customer.tags must overlap with at least one of these. */
    tags: z.array(z.string()).optional(),
    /** Restrict to VIPs only. */
    is_vip: z.boolean().optional(),
    /** Explicit customer-id list (overrides every other filter when present). */
    customer_ids: z.array(z.string().uuid()).optional(),
  })
  .passthrough()

export type SegmentCriteria = z.infer<typeof segmentCriteriaSchema>

export interface RecipientCustomer {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
}

export interface ResolveRecipientsArgs {
  supabase: SupabaseClient
  orgId: string
  channel: CampaignChannel
  /** Raw `campaigns.target_segment` value (already a parsed JSON object). */
  segment: unknown
  /** Hard cap to protect Postgres + the queue — defaults to 50k. */
  maxRecipients?: number
}

const DEFAULT_MAX_RECIPIENTS = 50_000

/**
 * Resolve a campaign's segment to the list of customers that should receive it.
 *
 * Filters applied in Postgres:
 *   - org_id = caller's org (tenant scope)
 *   - deleted_at IS NULL
 *   - marketing_opt_in = true (opt-in invariant)
 *   - For 'email' / 'both': email IS NOT NULL AND email <> ''
 *   - For 'sms'   / 'both': phone IS NOT NULL AND phone <> ''
 *   - Segment criteria (visits, spend, recency, tags, vip)
 *
 * If `segment.customer_ids` is supplied, every other criterion is ignored
 * and we resolve only those specific customers (still gated by org + opt-in
 * + contact-field — never bypass tenancy or consent).
 */
export async function resolveRecipients(
  args: ResolveRecipientsArgs,
): Promise<RecipientCustomer[]> {
  const { supabase, orgId, channel, segment } = args
  const max = args.maxRecipients ?? DEFAULT_MAX_RECIPIENTS

  // Defensive parse: a malformed segment becomes "no extra criteria"
  // rather than throwing — the campaign author already saved this object.
  const parsed = segmentCriteriaSchema.safeParse(segment ?? {})
  const criteria: SegmentCriteria = parsed.success ? parsed.data : {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('customers') as any)
    .select('id, first_name, last_name, email, phone')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .eq('marketing_opt_in', true)

  // Channel-specific deliverability gating.
  if (channel === 'email' || channel === 'both') {
    query = query.not('email', 'is', null).neq('email', '')
  }
  if (channel === 'sms' || channel === 'both') {
    query = query.not('phone', 'is', null).neq('phone', '')
  }

  if (criteria.customer_ids && criteria.customer_ids.length > 0) {
    // Explicit list mode — still enforces org + opt-in + deliverability above.
    query = query.in('id', criteria.customer_ids)
  } else {
    if (criteria.min_visits !== undefined) {
      query = query.gte('total_visits', criteria.min_visits)
    }
    if (criteria.max_visits !== undefined) {
      query = query.lte('total_visits', criteria.max_visits)
    }
    if (criteria.min_spend !== undefined) {
      query = query.gte('total_spent', criteria.min_spend)
    }
    if (criteria.max_spend !== undefined) {
      query = query.lte('total_spent', criteria.max_spend)
    }
    if (criteria.last_visit_within_days !== undefined) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - criteria.last_visit_within_days)
      query = query.gte('last_visit_at', cutoff.toISOString())
    }
    if (criteria.last_visit_more_than_days !== undefined) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - criteria.last_visit_more_than_days)
      query = query.lte('last_visit_at', cutoff.toISOString())
    }
    if (criteria.tags && criteria.tags.length > 0) {
      query = query.overlaps('tags', criteria.tags)
    }
    if (criteria.is_vip === true) {
      query = query.eq('is_vip', true)
    }
  }

  query = query.limit(max)

  const { data, error } = await query
  if (error) {
    throw new Error(`Failed to resolve recipients: ${error.message}`)
  }

  return (data ?? []) as RecipientCustomer[]
}
