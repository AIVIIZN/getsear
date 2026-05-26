import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ResendWebhookSchema = z.object({
  type: z.enum([
    'email.sent',
    'email.delivered',
    'email.delivery_delayed',
    'email.bounced',
    'email.complained',
    'email.failed',
    'email.opened',
    'email.clicked',
    'email.suppressed',
  ]),
  created_at: z.string().optional(),
  data: z.object({
    email_id: z.string().min(1),
    bounce: z
      .object({
        message: z.string().optional(),
        type: z.string().optional(),
        subType: z.string().optional(),
      })
      .optional(),
  }),
})

type ResendWebhookEvent = z.infer<typeof ResendWebhookSchema>

const STATUS_PRIORITY: Record<string, number> = {
  queued: 0,
  sent: 1,
  delivered: 2,
  opened: 3,
  clicked: 4,
  bounced: 5,
  failed: 5,
}

function statusAtLeast(current: string | null | undefined, next: string): boolean {
  return (STATUS_PRIORITY[current ?? ''] ?? -1) >= STATUS_PRIORITY[next]
}

function bounceReason(event: ResendWebhookEvent): string {
  if (event.data.bounce?.message) return event.data.bounce.message
  if (event.type === 'email.complained') return 'recipient complained'
  if (event.type === 'email.suppressed') return 'recipient suppressed by Resend'
  if (event.type === 'email.failed') return 'Resend delivery failed'
  return 'Resend bounce'
}

export async function applyResendWebhookEvent(
  supabase: ReturnType<typeof createAdminClient>,
  event: ResendWebhookEvent,
): Promise<'processed' | 'ignored' | 'not_found'> {
  const { data: recipient, error } = await supabase
    .from('campaign_recipients')
    .select('id, customer_id, status, resend_message_id')
    .eq('resend_message_id', event.data.email_id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!recipient) return 'not_found'

  const row = recipient as {
    id: string
    customer_id: string
    status: string | null
    resend_message_id: string
  }

  if (event.type === 'email.delivered') {
    if (statusAtLeast(row.status, 'delivered')) return 'ignored'
    const { error: updateError } = await supabase
      .from('campaign_recipients')
      .update({ status: 'delivered' })
      .eq('id', row.id)
    if (updateError) throw new Error(updateError.message)
    return 'processed'
  }

  if (
    event.type === 'email.bounced' ||
    event.type === 'email.complained' ||
    event.type === 'email.suppressed'
  ) {
    const { error: updateError } = await supabase
      .from('campaign_recipients')
      .update({
        status: 'bounced',
        bounce_reason: bounceReason(event),
      })
      .eq('id', row.id)
    if (updateError) throw new Error(updateError.message)

    await supabase
      .from('customers')
      .update({ marketing_opt_in: false, updated_at: new Date().toISOString() })
      .eq('id', row.customer_id)

    return 'processed'
  }

  if (event.type === 'email.failed') {
    const { error: updateError } = await supabase
      .from('campaign_recipients')
      .update({
        status: 'failed',
        bounce_reason: bounceReason(event),
      })
      .eq('id', row.id)
    if (updateError) throw new Error(updateError.message)
    return 'processed'
  }

  return 'ignored'
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
  if (!webhookSecret) {
    return apiError(500, 'Webhook not configured')
  }

  const payload = await request.text()
  let verifiedPayload: unknown
  try {
    verifiedPayload = new Webhook(webhookSecret).verify(payload, {
      'svix-id': request.headers.get('svix-id') ?? '',
      'svix-timestamp': request.headers.get('svix-timestamp') ?? '',
      'svix-signature': request.headers.get('svix-signature') ?? '',
    })
  } catch {
    return apiError(400, 'Invalid webhook')
  }

  const parsed = ResendWebhookSchema.safeParse(verifiedPayload)
  if (!parsed.success) {
    return apiError(400, 'Invalid payload')
  }

  try {
    const result = await applyResendWebhookEvent(createAdminClient(), parsed.data)
    return NextResponse.json({ data: { result } })
  } catch (err) {
    console.error('[resend-webhook] Error:', err)
    return apiError(500, 'Webhook processing error')
  }
}
