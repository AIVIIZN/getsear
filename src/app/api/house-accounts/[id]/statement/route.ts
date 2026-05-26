import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { generateStatementHtml } from '@/lib/house-accounts/statement-template'

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
    return apiError(400, 'date_from and date_to parameters are required')
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
    return apiError(404, 'House account not found')
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
    return apiError(500, 'Failed to fetch transactions')
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

  // Get org info for statement
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: org } = await (supabase.from('organizations') as any)
    .select('name, address, phone, email')
    .eq('id', user.org_id)
    .single()

  const chargesList = txList
    .filter((t: Record<string, unknown>) => t.type === 'charge')
    .map((t: Record<string, unknown>) => ({
      date: new Date(t.created_at as string).toLocaleDateString(),
      description: (t.description as string) ?? 'Charge',
      server: (t.server_name as string) ?? '',
      amount: parseFloat(t.amount as string),
    }))

  const paymentsList = txList
    .filter((t: Record<string, unknown>) => t.type === 'payment')
    .map((t: Record<string, unknown>) => ({
      date: new Date(t.created_at as string).toLocaleDateString(),
      method: (t.payment_method as string) ?? 'Payment',
      amount: Math.abs(parseFloat(t.amount as string)),
    }))

  const creditLimit = parseFloat(account.credit_limit ?? '0')

  const statementHtml = generateStatementHtml({
    account_name: account.account_name ?? '',
    account_number: (account.id as string).slice(-8).toUpperCase(),
    contact_name: account.contact_name ?? account.account_name ?? '',
    contact_email: account.billing_email ?? '',
    billing_address: account.billing_address ?? '',
    statement_period: `${dateFrom} to ${dateTo}`,
    statement_date: new Date().toLocaleDateString(),
    beginning_balance: parseFloat(beginningBalance.toFixed(2)),
    charges: chargesList,
    payments: paymentsList,
    total_charges: parseFloat(chargesTotal.toFixed(2)),
    total_payments: parseFloat(paymentsTotal.toFixed(2)),
    ending_balance: parseFloat(endingBalance.toFixed(2)),
    credit_limit: creditLimit,
    available_credit: Math.max(0, creditLimit - endingBalance),
    payment_terms: `Net ${account.payment_terms_days ?? 30}`,
    due_date: new Date(new Date(dateTo).getTime() + (account.payment_terms_days ?? 30) * 86400000).toLocaleDateString(),
    restaurant_name: org?.name ?? '',
    restaurant_address: org?.address ?? '',
    restaurant_phone: org?.phone ?? '',
  })

  // Return HTML if format=html requested
  const format = request.nextUrl.searchParams.get('format')
  if (format === 'html') {
    return new NextResponse(statementHtml, {
      headers: { 'Content-Type': 'text/html' },
    })
  }

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
      statement_html: statementHtml,
    },
  })
}
