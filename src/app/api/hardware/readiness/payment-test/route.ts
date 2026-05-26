import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const paymentTestSchema = z.object({
  terminalId: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleCheck = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleCheck) return roleCheck

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = paymentTestSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const db = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: terminal, error } = await (db.from('payment_terminals') as any)
    .select('id, name, device_class, status')
    .eq('id', parsed.data.terminalId)
    .eq('org_id', user.org_id)
    .single()

  if (error || !terminal) {
    return apiError(404, 'Payment terminal not found')
  }

  if (!['registered', 'online', 'ready', 'active'].includes(terminal.status)) {
    return apiError(409, 'Payment terminal is not ready for a test authorization')
  }

  return NextResponse.json({
    data: {
      success: true,
      terminal_id: terminal.id,
      device_class: terminal.device_class,
      environment: process.env.VALOR_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
      message: 'Payment terminal readiness test passed. No card was charged.',
    },
  })
}
