import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { updateEmailStatus } from '@/lib/integrations/sendgrid-client'

/**
 * SendGrid Event Webhook
 *
 * Receives delivery/open/bounce events from SendGrid.
 * Updates email delivery log status.
 *
 * Configure in SendGrid: Settings > Mail Settings > Event Webhook
 * URL: https://yourdomain.com/api/integrations/email/webhook
 */
export async function POST(request: NextRequest) {
  try {
    const events = await request.json()

    if (!Array.isArray(events)) {
      return apiError(400, 'Expected array of events')
    }

    for (const event of events) {
      const sgMessageId = event.sg_message_id?.split('.')[0] // Strip domain part
      if (!sgMessageId) continue

      const eventType = event.event
      const validEvents = ['delivered', 'open', 'bounce', 'dropped', 'deferred']
      if (!validEvents.includes(eventType)) continue

      await updateEmailStatus(sgMessageId, eventType)
    }

    return NextResponse.json({ data: { processed: events.length } })
  } catch (err) {
    console.error('[sendgrid-webhook] Error:', err)
    return apiError(500, 'Webhook processing error')
  }
}
