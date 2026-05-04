/**
 * Marketing analytics + tracking helpers.
 *
 * Backs:
 *   - GET /api/marketing/track/open  → upsertOpen(tracking_id)
 *   - GET /api/marketing/track/click → upsertClick(tracking_id, decoded_url)
 *   - Marketing analytics tab        → getCampaignAnalytics(campaign_id)
 *
 * All writes go through the service-role admin client because the tracking
 * endpoints are public (no Supabase session). Reads here are also admin —
 * caller is expected to have already enforced tenant scoping at the route
 * boundary (e.g. by joining campaign_id → org_id before calling).
 *
 * Schema dependency (added by sister batch 5.1.2 migration):
 *   campaign_recipients.tracking_id   uuid unique
 *   campaign_recipients.open_count    int  default 0
 *   campaign_recipients.click_count   int  default 0
 *   campaign_recipients.clicked_url   text
 */

import { createAdminClient } from '@/lib/supabase/admin'

export interface CampaignAnalytics {
  sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  opens_unique: number
  clicks_unique: number
}

interface RecipientRollupRow {
  status: string | null
  opened_at: string | null
  clicked_at: string | null
  open_count: number | null
  click_count: number | null
}

/**
 * Roll up real engagement numbers for a single campaign from
 * `campaign_recipients`. Returns zeros when the campaign has no rows yet.
 *
 * Counts:
 *   sent          = rows with status in ('sent','delivered','opened','clicked')
 *   delivered     = rows with status in ('delivered','opened','clicked') OR sent_at not null AND not bounced
 *   opened        = sum(open_count)        — total opens, including repeats
 *   clicked       = sum(click_count)       — total clicks, including repeats
 *   bounced       = rows with status='bounced'
 *   opens_unique  = rows with opened_at not null
 *   clicks_unique = rows with clicked_at not null
 */
export async function getCampaignAnalytics(
  campaign_id: string
): Promise<CampaignAnalytics> {
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recipients = supabase.from('campaign_recipients') as any
  const { data, error } = await recipients
    .select('status, opened_at, clicked_at, open_count, click_count')
    .eq('campaign_id', campaign_id)

  if (error || !data) {
    return {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      opens_unique: 0,
      clicks_unique: 0,
    }
  }

  const rows = data as RecipientRollupRow[]
  const SENT_STATES = new Set(['sent', 'delivered', 'opened', 'clicked'])
  const DELIVERED_STATES = new Set(['delivered', 'opened', 'clicked'])

  let sent = 0
  let delivered = 0
  let opened = 0
  let clicked = 0
  let bounced = 0
  let opens_unique = 0
  let clicks_unique = 0

  for (const r of rows) {
    const status = r.status ?? ''
    if (SENT_STATES.has(status)) sent += 1
    if (DELIVERED_STATES.has(status)) delivered += 1
    if (status === 'bounced') bounced += 1
    opened += r.open_count ?? 0
    clicked += r.click_count ?? 0
    if (r.opened_at) opens_unique += 1
    if (r.clicked_at) clicks_unique += 1
  }

  return { sent, delivered, opened, clicked, bounced, opens_unique, clicks_unique }
}

/**
 * Mark an open event for a recipient identified by its tracking_id.
 *
 * Sets `opened_at` only on the first open (COALESCE) and increments
 * `open_count` every call. Failures are swallowed — the caller (the pixel
 * route) must always render the GIF regardless.
 *
 * Returns true if a row was updated, false otherwise.
 */
export async function upsertOpen(tracking_id: string): Promise<boolean> {
  const supabase = createAdminClient()

  // Read current row first so COALESCE + increment can be expressed without
  // a SQL function. One round-trip read + one write — both keyed on a unique
  // index, so total cost is well under the 100ms budget.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recipients = supabase.from('campaign_recipients') as any
  const { data: existing, error: readErr } = await recipients
    .select('id, opened_at, open_count, status')
    .eq('tracking_id', tracking_id)
    .maybeSingle()

  if (readErr || !existing) return false

  const now = new Date().toISOString()
  // Only bump status to 'opened' if it's currently sent/delivered. Don't
  // demote 'clicked' back to 'opened' — clicks are a stronger signal.
  const nextStatus =
    existing.status === 'sent' || existing.status === 'delivered'
      ? 'opened'
      : existing.status

  const { error: writeErr } = await recipients
    .update({
      opened_at: existing.opened_at ?? now,
      open_count: (existing.open_count ?? 0) + 1,
      status: nextStatus,
    })
    .eq('id', existing.id)

  return !writeErr
}

/**
 * Mark a click event for a recipient identified by its tracking_id and the
 * URL they clicked through to.
 *
 * Sets `clicked_at` only on the first click (COALESCE), records the latest
 * `clicked_url`, and increments `click_count`. Returns true on success.
 */
export async function upsertClick(
  tracking_id: string,
  url: string
): Promise<boolean> {
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recipients = supabase.from('campaign_recipients') as any
  const { data: existing, error: readErr } = await recipients
    .select('id, clicked_at, click_count')
    .eq('tracking_id', tracking_id)
    .maybeSingle()

  if (readErr || !existing) return false

  const now = new Date().toISOString()

  const { error: writeErr } = await recipients
    .update({
      clicked_at: existing.clicked_at ?? now,
      clicked_url: url,
      click_count: (existing.click_count ?? 0) + 1,
      status: 'clicked',
    })
    .eq('id', existing.id)

  return !writeErr
}
