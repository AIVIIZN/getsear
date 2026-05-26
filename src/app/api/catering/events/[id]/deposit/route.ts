import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const depositSchema = z.object({
  amount: z.number().positive(),
  payment_method: z.enum(['card', 'cash', 'check', 'transfer']),
  notes: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner', 'manager'])
  if (roleCheck) return roleCheck

  const { id } = await params
  const body = await request.json()
  const parsed = depositSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, parsed.error.flatten().fieldErrors)
  }

  const db = createAdminClient()

  // Get event
  const { data: event, error } = await db
    .from('catering_events')
    .select('id, deposit_amount, total_amount, status')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (error || !event) {
    return apiError(404, 'Event not found')
  }

  const currentDeposit = (event.deposit_amount as number) ?? 0
  const newDeposit = currentDeposit + parsed.data.amount

  // Record deposit
  const { error: updateError } = await db
    .from('catering_events')
    .update({
      deposit_amount: newDeposit,
      deposit_method: parsed.data.payment_method,
      deposit_paid_at: new Date().toISOString(),
      status: event.status === 'proposal' ? 'confirmed' : event.status,
    })
    .eq('id', id)

  if (updateError) {
    return apiError(500, updateError.message)
  }

  // Record payment transaction
  await db.from('catering_payments').insert({
    org_id: user.org_id,
    event_id: id,
    amount: parsed.data.amount,
    type: 'deposit',
    method: parsed.data.payment_method,
    notes: parsed.data.notes ?? null,
    recorded_by: user.id,
  })

  return NextResponse.json({
    data: {
      deposit_total: newDeposit,
      payment_method: parsed.data.payment_method,
      status: event.status === 'proposal' ? 'confirmed' : event.status,
    },
  })
}
