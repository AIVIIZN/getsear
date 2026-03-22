import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import crypto from 'crypto'

const reloadSchema = z.object({
  card_number: z.string().min(1).max(50),
  amount_cents: z.number().int().min(100).max(50000), // $1 - $500
  order_id: z.string().uuid().optional(),
})

/**
 * POST /api/payments/gift-card/reload — reload a gift card
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = reloadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { card_number, amount_cents, order_id } = parsed.data
  const cardHash = crypto.createHash('sha256').update(card_number).digest('hex')
  const supabase = createAdminClient()

  const { data: card, error: cardErr } = await (supabase.from('gift_cards') as any)
    .select('id, current_balance, is_active')
    .eq('card_number_hash', cardHash)
    .eq('org_id', user.org_id)
    .single()

  if (cardErr || !card) {
    return NextResponse.json({ error: 'Gift card not found' }, { status: 404 })
  }

  if (!card.is_active) {
    return NextResponse.json({ error: 'Gift card is inactive' }, { status: 400 })
  }

  const currentCents = Math.round(parseFloat(card.current_balance) * 100)
  const newCents = currentCents + amount_cents
  const newBalance = (newCents / 100).toFixed(2)

  // Update balance
  const { error: updateErr } = await (supabase.from('gift_cards') as any)
    .update({ current_balance: newBalance })
    .eq('id', card.id)

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to reload gift card' }, { status: 500 })
  }

  // Record transaction
  await (supabase.from('gift_card_transactions') as any)
    .insert({
      gift_card_id: card.id,
      order_id: order_id ?? null,
      amount: (amount_cents / 100).toFixed(2),
      transaction_type: 'reload',
      balance_after: newBalance,
    })

  return NextResponse.json({
    data: {
      id: card.id,
      previous_balance_cents: currentCents,
      reload_amount_cents: amount_cents,
      new_balance_cents: newCents,
    },
  })
}
