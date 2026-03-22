import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

/** GET /api/house-accounts/[id]/statement — generate statement for date range */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await params
  const searchParams = request.nextUrl.searchParams
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')

  if (!dateFrom || !dateTo) {
    return NextResponse.json(
      { error: 'date_from and date_to parameters are required' },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Get account
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: account, error: accErr } = await (supabase.from('house_accounts') as any)
    .select('*')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (accErr || !account) {
    return NextResponse.json({ error: 'House account not found' }, { status: 404 })
  }

  // Get transactions in date range
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: transactions, error: txErr } = await (supabase.from('house_account_transactions') as any)
    .select('*')
    .eq('house_account_id', id)
    .gte('created_at', `${dateFrom}T00:00:00Z`)
    .lte('created_at', `${dateTo}T23:59:59Z`)
    .order('created_at', { ascending: true })

  if (txErr) {
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }

  const txList = transactions ?? []

  // Compute statement totals
  let chargesTotal = 0
  let paymentsTotal = 0
  let adjustmentsTotal = 0

  for (const tx of txList) {
    const amount = parseFloat(tx.amount)
    if (tx.type === 'charge') {
      chargesTotal += amount
    } else if (tx.type === 'payment') {
      paymentsTotal += Math.abs(amount)
    } else if (tx.type === 'adjustment' || tx.type === 'credit') {
      adjustmentsTotal += amount
    }
  }

  // Get balance at start of period (sum of all transactions before dateFrom)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: priorTx } = await (supabase.from('house_account_transactions') as any)
    .select('amount')
    .eq('house_account_id', id)
    .lt('created_at', `${dateFrom}T00:00:00Z`)

  const beginningBalance = (priorTx ?? []).reduce(
    (sum: number, t: { amount: string }) => sum + parseFloat(t.amount),
    0
  )

  const endingBalance = beginningBalance + chargesTotal - paymentsTotal + adjustmentsTotal

  return NextResponse.json({
    data: {
      account: {
        id: account.id,
        account_name: account.account_name,
        billing_email: account.billing_email,
        billing_address: account.billing_address,
        payment_terms_days: account.payment_terms_days,
      },
      period: {
        date_from: dateFrom,
        date_to: dateTo,
      },
      beginning_balance: parseFloat(beginningBalance.toFixed(2)),
      charges_total: parseFloat(chargesTotal.toFixed(2)),
      payments_total: parseFloat(paymentsTotal.toFixed(2)),
      adjustments_total: parseFloat(adjustmentsTotal.toFixed(2)),
      ending_balance: parseFloat(endingBalance.toFixed(2)),
      transactions: txList,
    },
  })
}
