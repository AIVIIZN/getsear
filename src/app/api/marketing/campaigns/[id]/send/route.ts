import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { validateManagerPinForAction } from '@/lib/auth/manager-pin'
import { applyRateLimitHeaders } from '@/lib/api/rate-limit'
import { resolveRecipients, type CampaignChannel } from '@/lib/marketing/recipients'
import {
  enqueueCampaignEmails,
  type CampaignEmailJobData,
} from '@/lib/queue/campaign-email-queue'

/**
 * POST /api/marketing/campaigns/:id/send
 *
 * V5 batch 5.1.2 — real recipient population + queue enqueue.
 *
 * Pipeline:
 *   1. AuthN/Z (manager+).
 *   2. Validate body (manager_pin optional, only required when the
 *      campaign has requires_approval=true).
 *   3. Load + lock campaign in 'draft' or 'scheduled'.
 *   4. If requires_approval: verify manager_pin against an org manager.
 *   5. Resolve recipients via segment criteria (org-scoped, opt-in only).
 *   6. Insert one campaign_recipients row per customer (status='queued')
 *      with `onConflict: campaign_id,customer_id, ignoreDuplicates` so a
 *      retried send doesn't double-insert.
 *   7. Enqueue one BullMQ job per inserted recipient (deterministic jobId).
 *   8. Update campaigns: status='sending' / 'scheduled', recipients_count,
 *      sent_at.
 */

const sendBodySchema = z.object({
  /** 4-6 digit PIN; only consulted when campaign.requires_approval. */
  manager_pin: z
    .string()
    .min(4)
    .max(6)
    .regex(/^\d+$/, 'PIN must be digits only')
    .optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await params

  // Body is optional — empty POST is valid for campaigns that don't require approval.
  let body: unknown = {}
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    try {
      body = await request.json()
    } catch {
      return apiError(400, 'Invalid JSON')
    }
  }
  const parsed = sendBodySchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Invalid request', { details: parsed.error.flatten(), extra: { "details": parsed.error.flatten() } })
  }
  const { manager_pin } = parsed.data

  const supabase = createAdminClient()

  // 1. Load campaign (tenant-scoped) -----------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: campaign, error: campaignErr } = await (supabase.from('campaigns') as any)
    .select(
      'id, org_id, name, campaign_type, status, target_segment, scheduled_for, requires_approval',
    )
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (campaignErr || !campaign) {
    return apiError(404, 'Campaign not found')
  }

  if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
    return apiError(409, `Campaign cannot be sent from status '${campaign.status}'`)
  }

  // 2. Manager-PIN gate ------------------------------------------------------
  if (campaign.requires_approval === true) {
    if (!manager_pin) {
      return apiError(403, 'This campaign requires manager approval. Provide manager_pin.', { extra: { "requires_manager_pin": true } })
    }

    const pinResult = await validateManagerPinForAction({
      actor: user,
      pin: manager_pin,
      request,
      supabase,
    })
    if (pinResult.kind === 'rate_limited') {
      const res = apiError(429, 'Too many PIN attempts. Please wait 15 minutes before trying again.')
      applyRateLimitHeaders(res.headers, pinResult.rateLimit)
      res.headers.set('Retry-After', String(pinResult.rateLimit.retryAfterSeconds))
      return res
    }
    if (pinResult.kind === 'invalid') {
      return apiError(403, 'Invalid manager PIN')
    }
    const approvingManagerId = pinResult.manager_user_id

    // approvingManagerId is captured for the future audit-log task; not
    // persisted yet because the audit_log row lives in a sister batch.
    void approvingManagerId
  }

  // 3. Scheduling check ------------------------------------------------------
  // If the campaign is scheduled for a future time, just transition to
  // 'scheduled' — a separate cron picks it up at scheduled_for and POSTs
  // back here. We do NOT pre-populate recipients for scheduled campaigns
  // because the segment may produce different members at fire time.
  const now = new Date()
  const isFutureScheduled =
    campaign.scheduled_for && new Date(campaign.scheduled_for) > now

  if (isFutureScheduled) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: scheduled, error: schedErr } = await (supabase.from('campaigns') as any)
      .update({
        status: 'scheduled',
        updated_at: now.toISOString(),
      })
      .eq('id', id)
      .eq('org_id', user.org_id)
      .select()
      .single()

    if (schedErr) {
      return apiError(500, 'Failed to schedule campaign')
    }
    return NextResponse.json({ data: scheduled, scheduled: true })
  }

  // 4. Resolve recipients ----------------------------------------------------
  const channel = normalizeChannel(campaign.campaign_type)
  let recipients
  try {
    recipients = await resolveRecipients({
      supabase,
      orgId: user.org_id,
      channel,
      segment: campaign.target_segment,
    })
  } catch (err) {
    return apiError(500, err instanceof Error ? err.message : 'Failed to resolve recipients')
  }

  if (recipients.length === 0) {
    // No recipients — mark as sent with a count of zero rather than leaving
    // it stuck in 'sending' forever.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('campaigns') as any)
      .update({
        status: 'sent',
        recipients_count: 0,
        sent_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', id)
      .eq('org_id', user.org_id)

    return NextResponse.json({
      data: { recipients_count: 0, enqueued: 0 },
      message: 'Campaign had no eligible recipients',
    })
  }

  // 5. Insert campaign_recipients (idempotent on (campaign_id, customer_id)) -
  const recipientRows = recipients.map((c) => ({
    campaign_id: id,
    customer_id: c.id,
    org_id: user.org_id,
    channel: campaign.campaign_type,
    status: 'queued' as const,
  }))

  const { data: insertedRecipients, error: insertErr } = await (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.from('campaign_recipients') as any
  )
    .upsert(recipientRows, {
      onConflict: 'campaign_id,customer_id',
      ignoreDuplicates: false,
    })
    .select('id, customer_id, tracking_id')

  if (insertErr || !insertedRecipients) {
    console.error('[campaign-send] insert failed:', insertErr)
    return apiError(500, 'Failed to populate recipients')
  }

  // 6. Enqueue jobs ----------------------------------------------------------
  const jobs: CampaignEmailJobData[] = (
    insertedRecipients as Array<{
      id: string
      customer_id: string
      tracking_id: string
    }>
  ).map((r) => ({
    campaign_id: id,
    recipient_id: r.id,
    customer_id: r.customer_id,
    org_id: user.org_id,
    tracking_id: r.tracking_id,
  }))

  let enqueued = 0
  let queueError: string | null = null
  try {
    const result = await enqueueCampaignEmails(jobs)
    enqueued = result.enqueued
  } catch (err) {
    queueError = err instanceof Error ? err.message : String(err)
    console.error('[campaign-send] enqueue failed:', queueError)
    // Note: rows are already inserted with status='queued'. The worker can
    // pick them up on its next sweep, OR an operator can re-POST send to
    // re-enqueue (jobIds are deterministic so no duplicates).
  }

  // 7. Flip campaign to 'sending' -------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error: updateErr } = await (supabase.from('campaigns') as any)
    .update({
      status: 'sending',
      recipients_count: recipients.length,
      sent_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (updateErr) {
    console.error('[campaign-send] campaign status update failed:', updateErr)
    return apiError(500, 'Recipients enqueued but campaign status update failed')
  }

  return NextResponse.json({
    data: updated,
    recipients_count: recipients.length,
    enqueued,
    ...(queueError ? { warning: `enqueue partially failed: ${queueError}` } : {}),
  })
}

/** Normalize the persisted campaign_type string to a channel value the
 *  recipient resolver understands. Falls back to 'email' for unknown values. */
function normalizeChannel(campaignType: string | null | undefined): CampaignChannel {
  if (campaignType === 'sms' || campaignType === 'both') return campaignType
  return 'email'
}
