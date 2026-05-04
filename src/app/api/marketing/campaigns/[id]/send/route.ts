import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { compare } from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
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
  /** 4–8 digit PIN; only consulted when campaign.requires_approval. */
  manager_pin: z.string().min(4).max(8).optional(),
})

const MANAGER_ROLES = ['manager', 'admin', 'owner', 'platform_admin']

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
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
  }
  const parsed = sendBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
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
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
    return NextResponse.json(
      { error: `Campaign cannot be sent from status '${campaign.status}'` },
      { status: 409 },
    )
  }

  // 2. Manager-PIN gate ------------------------------------------------------
  if (campaign.requires_approval === true) {
    const callerIsManager = MANAGER_ROLES.includes(user.role)
    if (!callerIsManager) {
      if (!manager_pin) {
        return NextResponse.json(
          {
            error: 'This campaign requires manager approval. Provide manager_pin.',
            requires_manager_pin: true,
          },
          { status: 403 },
        )
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: managers } = await (supabase.from('users') as any)
        .select('id, pin_hash')
        .eq('org_id', user.org_id)
        .eq('is_active', true)
        .in('role', ['manager', 'admin', 'owner'])
        .not('pin_hash', 'is', null)

      let pinValid = false
      let approvingManagerId: string | null = null
      if (managers) {
        for (const mgr of managers as Array<{ id: string; pin_hash: string | null }>) {
          if (!mgr.pin_hash) continue
          // eslint-disable-next-line no-await-in-loop
          if (await compare(manager_pin, mgr.pin_hash)) {
            pinValid = true
            approvingManagerId = mgr.id
            break
          }
        }
      }

      if (!pinValid) {
        return NextResponse.json({ error: 'Invalid manager PIN' }, { status: 403 })
      }
      // approvingManagerId is captured for the future audit-log task; not
      // persisted yet because the audit_log row lives in a sister batch.
      void approvingManagerId
    }
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
      return NextResponse.json(
        { error: 'Failed to schedule campaign' },
        { status: 500 },
      )
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to resolve recipients' },
      { status: 500 },
    )
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
    return NextResponse.json(
      { error: 'Failed to populate recipients' },
      { status: 500 },
    )
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
    return NextResponse.json(
      { error: 'Recipients enqueued but campaign status update failed' },
      { status: 500 },
    )
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
