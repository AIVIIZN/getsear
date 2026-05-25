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
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = paymentTestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const db = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: terminal, error } = await (db.from('payment_terminals') as any)
    .select('id, name, device_class, status')
    .eq('id', parsed.data.terminalId)
    .eq('org_id', user.org_id)
    .single()

  if (error || !terminal) {
    return NextResponse.json({ error: 'Payment terminal not found' }, { status: 404 })
  }

  if (!['registered', 'online', 'ready', 'active'].includes(terminal.status)) {
    return NextResponse.json(
      { error: 'Payment terminal is not ready for a test authorization' },
      { status: 409 }
    )
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
