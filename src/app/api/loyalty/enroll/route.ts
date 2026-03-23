import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const enrollSchema = z.object({
  phone: z.string().min(10).max(15),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  order_total: z.number().optional(), // cents, to earn points on first transaction
})

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const body = await request.json()
  const parsed = enrollSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const db = createAdminClient()
  const { phone, first_name, last_name, order_total } = parsed.data

  // Normalize phone
  const normalizedPhone = phone.replace(/\D/g, '').slice(-10)

  // Check if customer already exists with this phone
  const { data: existingCustomer } = await db
    .from('customers')
    .select('id, first_name, last_name')
    .eq('org_id', user.org_id)
    .eq('phone', normalizedPhone)
    .single()

  let customerId: string

  if (existingCustomer) {
    customerId = existingCustomer.id as string
  } else {
    // Create customer
    const { data: newCustomer, error: custError } = await db
      .from('customers')
      .insert({
        org_id: user.org_id,
        phone: normalizedPhone,
        first_name: first_name ?? null,
        last_name: last_name ?? null,
        source: 'loyalty_enrollment',
      })
      .select()
      .single()

    if (custError || !newCustomer) {
      return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 })
    }
    customerId = newCustomer.id as string
  }

  // Check if already enrolled in loyalty
  const { data: existingAccount } = await db
    .from('loyalty_accounts')
    .select('id, points_balance, tier, total_earned, total_redeemed')
    .eq('org_id', user.org_id)
    .eq('customer_id', customerId)
    .single()

  if (existingAccount) {
    return NextResponse.json({
      data: {
        ...existingAccount,
        is_new: false,
        customer_id: customerId,
      },
    })
  }

  // Get active loyalty program
  const { data: program } = await db
    .from('loyalty_programs')
    .select('id, points_per_dollar, points_per_visit')
    .eq('org_id', user.org_id)
    .eq('is_active', true)
    .single()

  if (!program) {
    return NextResponse.json({ error: 'No active loyalty program found' }, { status: 404 })
  }

  // Create loyalty account
  const initialPoints = order_total && program.points_per_dollar
    ? Math.floor((order_total / 100) * (program.points_per_dollar as number))
    : 0

  const { data: account, error: accountError } = await db
    .from('loyalty_accounts')
    .insert({
      org_id: user.org_id,
      customer_id: customerId,
      program_id: program.id,
      points_balance: initialPoints,
      tier: 'Bronze',
      total_earned: initialPoints,
      total_redeemed: 0,
    })
    .select()
    .single()

  if (accountError) {
    return NextResponse.json({ error: accountError.message }, { status: 500 })
  }

  // Record initial earn transaction if points were earned
  if (initialPoints > 0) {
    await db.from('loyalty_transactions').insert({
      org_id: user.org_id,
      account_id: account.id,
      type: 'earn',
      points: initialPoints,
      description: 'Welcome bonus - first transaction',
      location_id: user.location_ids?.[0] ?? null,
    })
  }

  return NextResponse.json({
    data: {
      ...account,
      is_new: true,
      customer_id: customerId,
      points_earned: initialPoints,
    },
  }, { status: 201 })
}
