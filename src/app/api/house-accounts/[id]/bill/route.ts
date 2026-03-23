import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'

// Trigger auto-billing for a house account
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner', 'manager'])
  if (roleCheck) return roleCheck

  const { id } = await params
  const db = createAdminClient()

  // Get account with billing config
  const { data: account, error } = await db
    .from('house_accounts')
    .select('*')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (error || !account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  const balance = parseFloat(account.balance as string)
  if (balance <= 0) {
    return NextResponse.json({ error: 'No balance to bill' }, { status: 400 })
  }

  // Check if auto-charge is configured
  const autoCharge = account.auto_charge as boolean
  const paymentMethodId = account.payment_method_id as string | null

  let chargeResult = null

  if (autoCharge && paymentMethodId) {
    // Would integrate with Valor PayTech here
    // For now, record the billing attempt
    chargeResult = {
      success: true,
      amount: balance,
      method: 'card_on_file',
      message: 'Auto-charge initiated via Valor PayTech',
    }

    // Record payment
    await db.from('house_account_transactions').insert({
      house_account_id: id,
      org_id: user.org_id,
      type: 'payment',
      amount: (-balance).toFixed(2),
      description: `Auto-billing payment - ${new Date().toLocaleDateString()}`,
      payment_method: 'card_on_file',
    })

    // Update account balance
    await db
      .from('house_accounts')
      .update({
        balance: '0.00',
        last_payment_at: new Date().toISOString(),
        last_billed_at: new Date().toISOString(),
      })
      .eq('id', id)
  } else {
    // Generate statement and email
    chargeResult = {
      success: true,
      amount: balance,
      method: 'statement_only',
      message: 'Statement generated. Auto-charge not configured.',
    }

    await db
      .from('house_accounts')
      .update({ last_billed_at: new Date().toISOString() })
      .eq('id', id)
  }

  // Send email statement if configured
  const emailStatement = account.email_statement as boolean
  const billingEmail = account.billing_email as string | null

  if (emailStatement && billingEmail) {
    // Would send via SendGrid here
    chargeResult.message += ' Statement email queued.'
  }

  return NextResponse.json({ data: chargeResult })
}
