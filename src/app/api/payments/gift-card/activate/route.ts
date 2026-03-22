import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import crypto from 'crypto'

const activateSchema = z.object({
  card_number: z.string().min(8).max(50),
  initial_balance_cents: z.number().int().min(100).max(50000), // $1 - $500
  order_id: z.string().uuid().optional(),
})

/**
 * POST /api/payments/gift-card/activate — activate a new gift card
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

  const parsed = activateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { card_number, initial_balance_cents, order_id } = parsed.data
  const cardHash = crypto.createHash('sha256').update(card_number).digest('hex')
  const balanceDollars = (initial_balance_cents / 100).toFixed(2)
  const supabase = createAdminClient()

  // Check if card already exists
  const { data: existing } = await (supabase.from('gift_cards') as any)
    .select('id')
    .eq('card_number_hash', cardHash)
    .eq('org_id', user.org_id)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Gift card number already in use' }, { status: 409 })
  }

  // Create gift card
  const { data: card, error: cardErr } = await (supabase.from('gift_cards') as any)
    .insert({
      org_id: user.org_id,
      card_number_hash: cardHash,
      balance: balanceDollars,
      is_active: true,
      activated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (cardErr) {
    return NextResponse.json({ error: 'Failed to activate gift card' }, { status: 500 })
  }

  // Create activation transaction
  await (supabase.from('gift_card_transactions') as any)
    .insert({
      gift_card_id: card.id,
      order_id: order_id ?? null,
      amount: balanceDollars,
      type: 'activate',
      balance_after: balanceDollars,
    })

  return NextResponse.json({
    data: {
      id: card.id,
      balance_cents: initial_balance_cents,
      is_active: true,
      activated_at: card.activated_at,
    },
  }, { status: 201 })
}
