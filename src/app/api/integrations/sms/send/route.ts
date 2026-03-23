import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { sendSms } from '@/lib/integrations/twilio-client'
import type { SmsTemplateType } from '@/lib/integrations/sms-templates'

const SendSchema = z.object({
  location_id: z.string().uuid(),
  to: z.string().min(1),
  template_type: z.enum(['order_ready', 'reservation_reminder_24hr', 'reservation_reminder_2hr', 'waitlist_alert', 'marketing']),
  variables: z.record(z.string(), z.string()).default({}),
  idempotency_key: z.string().optional(),
  custom_body: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const auth = await getAuthUser()
  if (auth instanceof NextResponse) return auth
  const roleCheck = requireRole(auth, ['owner', 'manager', 'server', 'bartender', 'host'])
  if (roleCheck) return roleCheck

  const body = await request.json()
  const parsed = SendSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const result = await sendSms({
    locationId: parsed.data.location_id,
    to: parsed.data.to,
    templateType: parsed.data.template_type as SmsTemplateType,
    variables: parsed.data.variables,
    idempotencyKey: parsed.data.idempotency_key,
    customBody: parsed.data.custom_body,
  })

  if (!result.success) {
    // Return 200 even on failure — graceful degradation
    return NextResponse.json({
      data: { sent: false, error: result.error },
    })
  }

  return NextResponse.json({
    data: { sent: true, sid: result.sid, logId: result.logId },
  })
}
