/**
 * BullMQ queue definition for marketing campaign email sends.
 *
 * V5 batch 5.1.2 — recipient population enqueues jobs here. The actual
 * worker (src/workers/campaign-email-worker.ts) is built in task 5.1.3
 * and consumes this queue.
 *
 * Idempotency: every job is keyed `${campaign_id}:${recipient_id}`, so a
 * retried enqueue (e.g. partial failure during the send-route insert+enqueue
 * loop) is a no-op rather than a duplicate send.
 */

import { Queue, type ConnectionOptions, type JobsOptions } from 'bullmq'
import IORedis, { type Redis } from 'ioredis'

export const CAMPAIGN_EMAIL_QUEUE_NAME = 'send-campaign-email' as const

/**
 * Job payload consumed by the campaign-email worker. Kept narrow so the
 * worker can re-fetch the recipient + campaign with strong consistency at
 * dispatch time (avoid stale snapshots from queue payload).
 */
export interface CampaignEmailJobData {
  campaign_id: string
  recipient_id: string
  customer_id: string
  org_id: string
  /** UUID embedded in tracking pixel + click-redirect URLs. */
  tracking_id: string
}

/** Redis connection — singleton, shared across the process. */
let connection: Redis | null = null

/**
 * Returns a BullMQ-compatible connection spec. BullMQ bundles its own
 * ioredis instance whose types differ structurally from the top-level
 * `ioredis` package, so we either hand it a URL string (it constructs the
 * client itself) or cast our shared client. We use the cast so a single
 * Redis socket is shared with the rest of the app (e.g. rate-limiter).
 *
 * `maxRetriesPerRequest: null` is required by BullMQ for any client used
 * with blocking commands.
 */
function getConnection(): ConnectionOptions {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    })
    connection.on('error', (err) => {
      console.error('[campaign-email-queue] Redis error:', err.message)
    })
  }
  return connection as unknown as ConnectionOptions
}

let queue: Queue | null = null

/** Lazy-singleton accessor. Survives Next.js dev hot-reloads in the same
 *  process by reusing the cached instance. BullMQ v5's generics are
 *  awkward to thread through — we keep the queue untyped at the boundary
 *  and rely on `enqueueCampaignEmails` for type-safe enqueues. */
export function getCampaignEmailQueue(): Queue {
  if (!queue) {
    queue = new Queue(CAMPAIGN_EMAIL_QUEUE_NAME, {
      connection: getConnection(),
      // ---------------------------------------------------------------
      // P0 fix (5.99.6 #4) — idempotency / no double-sends.
      //
      // The worker (src/workers/campaign-email-worker.ts) owns the
      // 5s/30s/5min retry schedule via a MANUAL re-enqueue loop in
      // `handleTransient`. If BullMQ ALSO retries (attempts > 1) on top
      // of the manual loop, an arbitrary processor error AFTER a
      // successful Resend send (e.g. markRecipient throws on a flaky
      // network) will cause BullMQ to re-run processJob, which re-fetches
      // the recipient, finds status='queued' (because markRecipient
      // never succeeded), and SENDS AGAIN. → duplicate emails.
      //
      // The contract is: producers set attempts=1, worker owns retries.
      // Match `CAMPAIGN_EMAIL_JOB_OPTS` exactly so any caller that
      // forgets to override `opts` still gets the safe default.
      // ---------------------------------------------------------------
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { age: 60 * 60 * 24 * 7, count: 10_000 }, // 7d / 10k
        removeOnFail: { age: 60 * 60 * 24 * 30 }, // 30d
      },
    })
  }
  return queue
}

/** Deterministic jobId for idempotent retries. Worker also uses this shape
 *  to look up jobs by id; do not change the format without coordinating. */
export function campaignEmailJobId(campaignId: string, recipientId: string): string {
  return `${campaignId}:${recipientId}`
}

export interface EnqueueResult {
  enqueued: number
  /** jobIds that BullMQ refused because they already existed (idempotent skips). */
  skipped: number
}

/**
 * Bulk-enqueue one job per recipient. Uses `Queue.addBulk` for efficiency,
 * with a deterministic jobId per (campaign, recipient) so a retried call is
 * idempotent.
 *
 * Returns counts; throws on Redis errors so the caller can decide whether
 * to roll back the campaign_recipients insert.
 */
export async function enqueueCampaignEmails(
  jobs: CampaignEmailJobData[],
  opts: JobsOptions = {},
): Promise<EnqueueResult> {
  if (jobs.length === 0) return { enqueued: 0, skipped: 0 }

  const q = getCampaignEmailQueue()
  const payload = jobs.map((data) => ({
    name: 'send' as const,
    data,
    opts: {
      jobId: campaignEmailJobId(data.campaign_id, data.recipient_id),
      ...opts,
    },
  }))

  const added = await q.addBulk(payload)
  // BullMQ returns a Job for each entry; duplicates with the same jobId are
  // collapsed (no new job scheduled). We count what actually became active.
  const enqueued = added.filter((j) => j !== undefined && j.id !== undefined).length
  return { enqueued, skipped: jobs.length - enqueued }
}

/** Test/teardown helper. Not used in production code paths. */
export async function __resetCampaignEmailQueueForTests(): Promise<void> {
  if (queue) {
    await queue.close()
    queue = null
  }
  if (connection) {
    await connection.quit().catch(() => {})
    connection = null
  }
}
