import { NextRequest, NextResponse } from 'next/server'
import { addOptOut, removeOptOut, normalizePhone } from '@/lib/integrations/twilio-client'

/**
 * Twilio inbound SMS webhook.
 * Handles opt-out (STOP) and re-subscribe (START) messages.
 *
 * This endpoint is called by Twilio when a message is received.
 * It must return a TwiML response.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const from = formData.get('From')?.toString() ?? ''
    const body = (formData.get('Body')?.toString() ?? '').trim().toUpperCase()

    if (!from) {
      return new NextResponse('<Response/>', {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      })
    }

    const normalized = normalizePhone(from)

    // STOP / UNSUBSCRIBE / CANCEL / END / QUIT
    const stopWords = ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']
    const startWords = ['START', 'SUBSCRIBE', 'YES', 'UNSTOP']

    if (stopWords.includes(body)) {
      await addOptOut(normalized)
      console.log(`[twilio-webhook] Opt-out registered for ${normalized}`)

      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>You have been unsubscribed. Reply START to re-subscribe.</Message>
</Response>`,
        {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        }
      )
    }

    if (startWords.includes(body)) {
      await removeOptOut(normalized)
      console.log(`[twilio-webhook] Re-subscribed for ${normalized}`)

      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>You have been re-subscribed to messages.</Message>
</Response>`,
        {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        }
      )
    }

    // C = confirm reservation
    if (body === 'C') {
      // In production, look up pending reservation confirmations for this phone
      console.log(`[twilio-webhook] Reservation confirmation from ${normalized}`)
    }

    // X = cancel reservation
    if (body === 'X') {
      console.log(`[twilio-webhook] Reservation cancellation from ${normalized}`)
    }

    // Empty response for all other messages
    return new NextResponse('<Response/>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    })
  } catch (err) {
    console.error('[twilio-webhook] Error:', err)
    return new NextResponse('<Response/>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    })
  }
}
