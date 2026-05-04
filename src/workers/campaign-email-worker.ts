/**
 * Marketing campaign dispatch worker.
 *
 * Consumes the `send-campaign-email` BullMQ queue (sister task 5.1.2 owns
 * the producer at `src/lib/queue/campaign-email-queue.ts`). For each job,
 * fetches the campaign + recipient + customer rows, renders the
 * react-email template, and sends via Resend.
 *
 * Resend response handling:
 *   200    → status='sent',     resend_message_id, sent_at=now()
 *   4xx    → status='bounced',  bounce_reason — no retry
 *   5xx/network → manually re-enqueue with delay 5s / 30s / 5min;
 *                 after exhaustion → status='failed'.
 *
 * Retry strategy: Per fix-cycle-2 review (P0 #2), we cannot rely on
 * BullMQ's built-in backoff because the sister-5.1.2 producer sets a
 * generic `exponential` strategy that yields 5s/10s/20s — not the
 * 5s/30s/5min the spec calls for. To keep the spec'd schedule regardless
 * of producer config, on a transient (5xx/network) failure we re-enqueue
 * the job ourselves with the correct delay and return success from the
 * current attempt so BullMQ doesn't double-retry. The custom-named
 * backoff strategy is also registered defensively — harmless if unused.
 *
 * Tenant scoping: every Supabase query filters by org_id (RLS is the
 * second line; we use the service-role client so first line is the where
 * clause itself).
 */

// TODO(post-V5.1-merge): de-duplicate CampaignEmailJobData with
// src/lib/queue/campaign-email-queue.ts (sister 5.1.2)

import { Queue, Worker, type ConnectionOptions, type Job } from 'bullmq'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  renderCampaignEmail,
  type CampaignEmailProps,
} from '@/lib/marketing/email-templates/campaign'

export const CAMPAIGN_EMAIL_QUEUE = 'send-campaign-email'

/**
 * Job payload shape — mirrored exactly between this worker and the
 * sister producer (5.1.2). Reviewer cross-checks at integration.
 */
export interface CampaignEmailJobData {
  campaign_id: string
  recipient_id: string
  tracking_id: string
  org_id: string
  /**
   * Manual retry counter — incremented each time we re-enqueue ourselves
   * after a transient failure. Independent of BullMQ's `attemptsMade` so
   * the spec'd 5s/30s/5min schedule holds regardless of producer backoff
   * config (see file header for context).
   */
  _manual_attempt?: number
}

export interface CampaignEmailJobResult {
  status: 'sent' | 'bounced' | 'skipped' | 'retried' | 'failed'
  message_id?: string
  bounce_reason?: string
  reason?: string
  /** Set when status='retried' — the next manual attempt number. */
  next_attempt?: number
  /** Set when status='retried' — delay until next attempt (ms). */
  retry_delay_ms?: number
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Sear <noreply@getsear.com>'

// ---------------------------------------------------------------------------
// Connection singletons (lazy — workers may be imported in test/dev where
// Redis isn't running and we don't want module load to throw).
// ---------------------------------------------------------------------------

/**
 * BullMQ connection options. BullMQ vendors its own ioredis copy, so we
 * hand it a plain options object (or URL) and let it construct the
 * client — avoids cross-package type/instance mismatch.
 */
function getConnection(): ConnectionOptions {
  const url = process.env.REDIS_URL
  if (url) {
    // Parse URL into the options BullMQ expects.
    const u = new URL(url)
    return {
      host: u.hostname,
      port: Number(u.port || 6379),
      password: u.password ? decodeURIComponent(u.password) : undefined,
      username: u.username ? decodeURIComponent(u.username) : undefined,
      db: u.pathname && u.pathname.length > 1 ? Number(u.pathname.slice(1)) : 0,
      // BullMQ requirement for blocking commands.
      maxRetriesPerRequest: null,
    }
  }
  return {
    host: '127.0.0.1',
    port: 6379,
    maxRetriesPerRequest: null,
  }
}

let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not set')
    }
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

// ---------------------------------------------------------------------------
// Resend response classification
// ---------------------------------------------------------------------------

interface ClassifiedError {
  /** 'bounced' = permanent failure (do not retry); 'retry' = transient. */
  kind: 'bounced' | 'retry'
  reason: string
  statusCode?: number
}

function classifyResendError(err: unknown): ClassifiedError {
  // Resend SDK returns { error: { name, message, statusCode? } } shape, or
  // throws on network errors. Normalize both.
  if (err && typeof err === 'object') {
    const e = err as { name?: string; message?: string; statusCode?: number; status?: number }
    const status = typeof e.statusCode === 'number' ? e.statusCode : e.status
    const message = e.message || e.name || 'unknown error'
    if (typeof status === 'number') {
      if (status >= 400 && status < 500) {
        return { kind: 'bounced', reason: message, statusCode: status }
      }
      if (status >= 500) {
        return { kind: 'retry', reason: message, statusCode: status }
      }
    }
    // No status code → treat as transient (network / DNS / timeout).
    return { kind: 'retry', reason: message }
  }
  return { kind: 'retry', reason: String(err) }
}

/**
 * Manual retry schedule per spec: 5s / 30s / 5min between the 3 attempts.
 * Indexed by `attempt` (0-based — the count of prior attempts already
 * performed for this logical recipient).
 */
const MANUAL_RETRY_DELAYS_MS = [5_000, 30_000, 300_000]
const MAX_MANUAL_ATTEMPTS = MANUAL_RETRY_DELAYS_MS.length

let _queue: Queue<CampaignEmailJobData> | null = null
function getQueue(): Queue<CampaignEmailJobData> {
  if (!_queue) {
    _queue = new Queue<CampaignEmailJobData>(CAMPAIGN_EMAIL_QUEUE, {
      connection: getConnection(),
    })
  }
  return _queue
}

// ---------------------------------------------------------------------------
// Job processor
// ---------------------------------------------------------------------------

async function processJob(job: Job<CampaignEmailJobData>): Promise<CampaignEmailJobResult> {
  const { campaign_id, recipient_id, tracking_id, org_id } = job.data
  const sb = createAdminClient()

  // -- Fetch campaign (org-scoped). --------------------------------------
  const campaignRes = await sb
    .from('campaigns')
    .select(
      'id, org_id, name, subject, body_html, status, sent_at',
    )
    .eq('id', campaign_id)
    .eq('org_id', org_id)
    .maybeSingle()

  if (campaignRes.error) {
    throw new Error(`campaign fetch failed: ${campaignRes.error.message}`)
  }
  const campaign = campaignRes.data as
    | {
        id: string
        org_id: string
        name: string
        subject: string | null
        body_html: string | null
        status: string
      }
    | null
  if (!campaign) {
    return { status: 'skipped', reason: 'campaign not found in org' }
  }
  if (!campaign.subject || !campaign.body_html) {
    await markRecipient(sb, recipient_id, org_id, {
      status: 'bounced',
      bounce_reason: 'campaign missing subject or body',
    })
    return { status: 'bounced', bounce_reason: 'campaign missing subject or body' }
  }

  // -- Fetch recipient row (org-scoped via campaign_id join). -----------
  const recipientRes = await sb
    .from('campaign_recipients')
    .select('id, campaign_id, customer_id, status')
    .eq('id', recipient_id)
    .eq('campaign_id', campaign_id)
    .maybeSingle()
  if (recipientRes.error) {
    throw new Error(`recipient fetch failed: ${recipientRes.error.message}`)
  }
  const recipient = recipientRes.data as
    | { id: string; campaign_id: string; customer_id: string; status: string }
    | null
  if (!recipient) {
    return { status: 'skipped', reason: 'recipient not found' }
  }
  // Idempotency guard — if it already sent, don't re-send.
  if (recipient.status === 'sent') {
    return { status: 'skipped', reason: 'already sent' }
  }

  // -- Fetch customer (org-scoped). -------------------------------------
  const customerRes = await sb
    .from('customers')
    .select('id, first_name, email, marketing_opt_in, unsubscribe_token')
    .eq('id', recipient.customer_id)
    .eq('org_id', org_id)
    .maybeSingle()
  if (customerRes.error) {
    throw new Error(`customer fetch failed: ${customerRes.error.message}`)
  }
  const customer = customerRes.data as
    | {
        id: string
        first_name: string | null
        email: string | null
        marketing_opt_in: boolean
        unsubscribe_token: string | null
      }
    | null
  if (!customer || !customer.email) {
    await markRecipient(sb, recipient_id, org_id, {
      status: 'bounced',
      bounce_reason: 'customer missing email',
    })
    return { status: 'bounced', bounce_reason: 'customer missing email' }
  }
  if (customer.marketing_opt_in === false) {
    await markRecipient(sb, recipient_id, org_id, {
      status: 'bounced',
      bounce_reason: 'customer opted out',
    })
    return { status: 'bounced', bounce_reason: 'customer opted out' }
  }
  if (!customer.unsubscribe_token) {
    await markRecipient(sb, recipient_id, org_id, {
      status: 'bounced',
      bounce_reason: 'customer missing unsubscribe_token',
    })
    return { status: 'bounced', bounce_reason: 'customer missing unsubscribe_token' }
  }

  // -- Fetch org (for branding). ----------------------------------------
  const orgRes = await sb
    .from('organizations')
    .select('id, name, logo_url, mailing_address')
    .eq('id', org_id)
    .maybeSingle()
  // organizations may not have logo_url/mailing_address; fall back gracefully.
  const org = (orgRes.data as
    | { id: string; name: string; logo_url?: string | null; mailing_address?: string | null }
    | null) ?? { id: org_id, name: campaign.name }

  // -- Render. ----------------------------------------------------------
  const props: CampaignEmailProps = {
    firstName: customer.first_name,
    orgName: org.name || campaign.name,
    orgLogoUrl: org.logo_url ?? null,
    mailingAddress: org.mailing_address ?? null,
    bodyHtml: campaign.body_html,
    previewText: campaign.subject,
    trackingId: tracking_id,
    unsubscribeToken: customer.unsubscribe_token,
  }
  const html = await renderCampaignEmail(props)

  // -- Send via Resend. -------------------------------------------------
  let messageId: string | undefined
  try {
    const resend = getResend()
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: customer.email,
      subject: campaign.subject,
      html,
      headers: {
        'X-Tracking-Id': tracking_id,
        'X-Campaign-Id': campaign_id,
        // RFC 8058 one-click unsubscribe — gives Gmail/Apple Mail a
        // first-class unsubscribe button.
        'List-Unsubscribe': `<https://getsear.com/api/marketing/unsubscribe?t=${encodeURIComponent(
          customer.unsubscribe_token,
        )}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })

    if (result.error) {
      // SDK returns errors in a structured field rather than throwing
      // for some 4xx responses.
      const classified = classifyResendError(result.error)
      if (classified.kind === 'bounced') {
        await markRecipient(sb, recipient_id, org_id, {
          status: 'bounced',
          bounce_reason: classified.reason,
        })
        return { status: 'bounced', bounce_reason: classified.reason }
      }
      return await handleTransient(sb, job, classified.reason)
    }
    messageId = result.data?.id
  } catch (err) {
    const classified = classifyResendError(err)
    if (classified.kind === 'bounced') {
      await markRecipient(sb, recipient_id, org_id, {
        status: 'bounced',
        bounce_reason: classified.reason,
      })
      return { status: 'bounced', bounce_reason: classified.reason }
    }
    return await handleTransient(sb, job, classified.reason)
  }

  await markRecipient(sb, recipient_id, org_id, {
    status: 'sent',
    resend_message_id: messageId ?? null,
    sent_at: new Date().toISOString(),
  })

  return { status: 'sent', message_id: messageId }
}

// ---------------------------------------------------------------------------
// Recipient status updater (org-scoped via the campaigns join).
// Updates are idempotent — safe to call repeatedly.
// ---------------------------------------------------------------------------

async function markRecipient(
  sb: ReturnType<typeof createAdminClient>,
  recipientId: string,
  orgId: string,
  patch: {
    status: 'sent' | 'bounced' | 'failed'
    bounce_reason?: string | null
    resend_message_id?: string | null
    sent_at?: string | null
  },
): Promise<void> {
  // Look up the campaign_id for org scoping (defense-in-depth — the
  // recipient was already found inside the org via the campaign_id filter
  // earlier; this just keeps the update statement explicit).
  const lookup = await sb
    .from('campaign_recipients')
    .select('campaign_id, campaigns!inner(org_id)')
    .eq('id', recipientId)
    .maybeSingle()
  if (lookup.error || !lookup.data) {
    console.error(
      `[campaign-email-worker] cannot mark recipient ${recipientId}: ${lookup.error?.message ?? 'not found'}`,
    )
    return
  }
  const joinedOrg = (
    lookup.data as { campaigns: { org_id: string } | { org_id: string }[] }
  ).campaigns
  const orgFromJoin = Array.isArray(joinedOrg) ? joinedOrg[0]?.org_id : joinedOrg?.org_id
  if (orgFromJoin !== orgId) {
    console.error(
      `[campaign-email-worker] org mismatch for recipient ${recipientId}: expected ${orgId}, got ${orgFromJoin}`,
    )
    return
  }

  const update: Record<string, unknown> = { status: patch.status }
  if (patch.bounce_reason !== undefined) update.bounce_reason = patch.bounce_reason
  if (patch.resend_message_id !== undefined) update.resend_message_id = patch.resend_message_id
  if (patch.sent_at !== undefined) update.sent_at = patch.sent_at

  const res = await sb.from('campaign_recipients').update(update).eq('id', recipientId)
  if (res.error) {
    console.error(
      `[campaign-email-worker] update failed for ${recipientId}: ${res.error.message}`,
    )
  }
}

/**
 * On a transient (5xx/network) failure, manually re-enqueue the job with
 * the spec'd delay schedule (5s/30s/5min) and return success from the
 * current attempt — this prevents BullMQ from also retrying with its own
 * (possibly producer-misconfigured) backoff, which would double up.
 *
 * After exhausting MAX_MANUAL_ATTEMPTS, mark the recipient as 'failed'
 * and return — the job ends successfully so BullMQ doesn't keep it in
 * the `failed` set.
 */
async function handleTransient(
  sb: ReturnType<typeof createAdminClient>,
  job: Job<CampaignEmailJobData>,
  reason: string,
): Promise<CampaignEmailJobResult> {
  const data = job.data
  const priorAttempt = data._manual_attempt ?? 0
  const nextAttempt = priorAttempt + 1

  if (nextAttempt > MAX_MANUAL_ATTEMPTS) {
    // Exhausted — mark recipient failed.
    await markRecipient(sb, data.recipient_id, data.org_id, {
      status: 'failed',
      bounce_reason: `transient error after ${MAX_MANUAL_ATTEMPTS} retries: ${reason}`,
    })
    return {
      status: 'failed',
      bounce_reason: reason,
    }
  }

  const delay = MANUAL_RETRY_DELAYS_MS[priorAttempt]
  const queue = getQueue()
  // Deterministic jobId per (campaign,recipient,attempt) for idempotency
  // — even if BullMQ also tries to retry, the duplicate is dropped.
  const retryJobId = `${data.campaign_id}:${data.recipient_id}:retry${nextAttempt}`
  await queue.add(
    job.name,
    { ...data, _manual_attempt: nextAttempt },
    {
      delay,
      jobId: retryJobId,
      // Same lifecycle policy as the original — see CAMPAIGN_EMAIL_JOB_OPTS.
      removeOnComplete: { age: 7 * 24 * 60 * 60, count: 10_000 },
      removeOnFail: { age: 30 * 24 * 60 * 60 },
      // Single attempt for the manual-retry job — we own the retry loop.
      attempts: 1,
    },
  )

  console.log(
    `[campaign-email-worker] re-enqueued ${data.recipient_id} attempt ${nextAttempt}/${MAX_MANUAL_ATTEMPTS} in ${delay}ms (${reason})`,
  )
  return {
    status: 'retried',
    next_attempt: nextAttempt,
    retry_delay_ms: delay,
    reason,
  }
}

// ---------------------------------------------------------------------------
// Worker factory
// ---------------------------------------------------------------------------

let _worker: Worker<CampaignEmailJobData, CampaignEmailJobResult> | null = null

export function startCampaignEmailWorker(): Worker<
  CampaignEmailJobData,
  CampaignEmailJobResult
> {
  if (_worker) return _worker
  _worker = new Worker<CampaignEmailJobData, CampaignEmailJobResult>(
    CAMPAIGN_EMAIL_QUEUE,
    processJob,
    {
      connection: getConnection(),
      concurrency: 10,
      // Custom backoff: 5s → 30s → 5min between the 3 attempts so we
      // ride out short Resend outages without hammering. Producer (5.1.2)
      // applies `CAMPAIGN_EMAIL_JOB_OPTS` so each job picks this up.
      settings: {
        backoffStrategy: campaignEmailBackoff,
      },
    },
  )

  _worker.on('failed', (job, err) => {
    const data = job?.data as CampaignEmailJobData | undefined
    const attempts = job?.attemptsMade ?? 0
    const max = job?.opts?.attempts ?? 1
    console.warn(
      `[campaign-email-worker] job ${job?.id ?? '?'} failed (attempt ${attempts}/${max}): ${err.message}`,
    )

    // Defensive net: handleTransient owns the manual-retry loop and
    // marks recipients failed when MAX_MANUAL_ATTEMPTS is exhausted.
    // We only land here if the processor threw an *unexpected* error
    // (e.g. fetch query crashed) — in that case, after BullMQ exhausts
    // its own attempts, mark the recipient failed so it isn't stuck in
    // limbo. Best-effort: do not throw out of the listener.
    if (data && attempts >= max) {
      const sb = createAdminClient()
      void markRecipient(sb, data.recipient_id, data.org_id, {
        status: 'failed',
        bounce_reason: err.message,
      })
    }
  })

  _worker.on('completed', (job, result) => {
    console.log(
      `[campaign-email-worker] job ${job.id} ${result.status}` +
        (result.message_id ? ` (${result.message_id})` : ''),
    )
  })

  _worker.on('error', (err) => {
    console.error('[campaign-email-worker] worker error:', err.message)
  })

  return _worker
}

/**
 * Recommended job options for producers — exposed so sister task 5.1.2
 * can apply consistent retry semantics.
 *
 * Retry schedule (5s / 30s / 5min) is owned by the WORKER via
 * `handleTransient` + manual re-enqueue, not by BullMQ — see file
 * header. Producers should set `attempts: 1` so BullMQ does not
 * double-retry on top of the manual loop. The worker still registers a
 * `campaignEmailBackoff` strategy defensively (see `settings.backoffStrategy`)
 * for any producer that does set `backoff: { type: 'campaignEmailBackoff' }`.
 */
export const CAMPAIGN_EMAIL_JOB_OPTS = {
  attempts: 1,
  removeOnComplete: { age: 7 * 24 * 60 * 60, count: 10_000 },
  removeOnFail: { age: 30 * 24 * 60 * 60 },
}

/**
 * BullMQ custom backoff strategy for `send-campaign-email` jobs.
 * Register on the QueueScheduler/Worker via `settings.backoffStrategies`.
 *   attempt 1 → 5s, attempt 2 → 30s, attempt 3 → 300s.
 */
export function campaignEmailBackoff(attemptsMade: number): number {
  if (attemptsMade <= 1) return 5_000
  if (attemptsMade === 2) return 30_000
  return 300_000
}

// Auto-start in production process. Tests/scripts can opt in via
// `startCampaignEmailWorker()` directly.
if (process.env.START_WORKERS === '1') {
  startCampaignEmailWorker()
}

export const campaignEmailWorker = {
  start: startCampaignEmailWorker,
  queueName: CAMPAIGN_EMAIL_QUEUE,
  jobOpts: CAMPAIGN_EMAIL_JOB_OPTS,
  backoff: campaignEmailBackoff,
}

export default campaignEmailWorker
