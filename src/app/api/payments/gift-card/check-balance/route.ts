import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import crypto from 'crypto'

const checkBalanceSchema = z.object({
  card_number: z.string().min(1).max(50),
})

/**
 * POST /api/payments/gift-card/check-balance — check gift card balance
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

  const parsed = checkBalanceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const cardHash = crypto.createHash('sha256').update(parsed.data.card_number).digest('hex')
  const supabase = createAdminClient()

  const { data: card, error } = await (supabase.from('gift_cards') as any)
    .select('id, balance, is_active, expires_at')
    .eq('card_number_hash', cardHash)
    .eq('org_id', user.org_id)
    .single()

  if (error || !card) {
    return NextResponse.json({ error: 'Gift card not found' }, { status: 404 })
  }

  const balanceCents = Math.round(parseFloat(card.balance) * 100)

  return NextResponse.json({
    data: {
      id: card.id,
      balance_cents: balanceCents,
      is_active: card.is_active,
      expires_at: card.expires_at,
    },
  })
}
