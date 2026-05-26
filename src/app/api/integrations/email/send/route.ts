import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { sendEmail } from '@/lib/integrations/sendgrid-client'
import type { EmailTemplateType } from '@/lib/integrations/email-templates'

const SendSchema = z.object({
  location_id: z.string().uuid(),
  to: z.string().email(),
  subject: z.string().min(1),
  html: z.string().min(1),
  template_type: z.enum(['receipt', 'daily_report', 'marketing', 'password_reset', 'welcome']),
  idempotency_key: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const auth = await getAuthUser()
  if (auth instanceof NextResponse) return auth
  const roleCheck = requireRole(auth, ['owner', 'manager', 'server', 'bartender'])
  if (roleCheck) return roleCheck

  const body = await request.json()
  const parsed = SendSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, parsed.error.issues[0].message)
  }

  const result = await sendEmail({
    locationId: parsed.data.location_id,
    to: parsed.data.to,
    subject: parsed.data.subject,
    html: parsed.data.html,
    templateType: parsed.data.template_type as EmailTemplateType,
    idempotencyKey: parsed.data.idempotency_key,
  })

  if (!result.success) {
    return NextResponse.json({ data: { sent: false, error: result.error } })
  }

  return NextResponse.json({
    data: { sent: true, messageId: result.messageId, logId: result.logId },
  })
}
