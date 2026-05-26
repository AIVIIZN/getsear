import { apiError } from '@/lib/api/error-response'
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
    return apiError(400, 'Invalid JSON')
  }

  const parsed = checkBalanceSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const cardHash = crypto.createHash('sha256').update(parsed.data.card_number).digest('hex')
  const supabase = createAdminClient()

  const { data: card, error } = await supabase.from('gift_cards')
    .select('id, current_balance, is_active, expires_at')
    .eq('card_number_hash', cardHash)
    .eq('org_id', user.org_id)
    .single()

  if (error || !card) {
    return apiError(404, 'Gift card not found')
  }

  const balanceCents = Math.round(parseFloat(card.current_balance) * 100)

  return NextResponse.json({
    data: {
      id: card.id,
      balance_cents: balanceCents,
      is_active: card.is_active,
      expires_at: card.expires_at,
    },
  })
}
