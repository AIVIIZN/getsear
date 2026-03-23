import { NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner', 'manager'])
  if (roleCheck) return roleCheck

  const db = createAdminClient()

  // Get all house accounts with their charges
  const { data: accounts } = await db
    .from('house_accounts')
    .select('id, name, balance, credit_limit, last_payment_at, house_account_charges(date, amount)')
    .eq('org_id', user.org_id)
    .eq('is_active', true)

  const now = new Date()
  const d30 = new Date(now); d30.setDate(d30.getDate() - 30)
  const d60 = new Date(now); d60.setDate(d60.getDate() - 60)
  const d90 = new Date(now); d90.setDate(d90.getDate() - 90)

  let totalCurrent = 0, total30 = 0, total60 = 0, total90Plus = 0

  const accountAging = (accounts ?? []).map((acc: Record<string, unknown>) => {
    const charges = (acc.house_account_charges as Array<Record<string, unknown>>) ?? []
    let current = 0, days30 = 0, days60 = 0, days90Plus = 0

    for (const charge of charges) {
      const chargeDate = new Date(charge.date as string)
      const amount = parseFloat(charge.amount as string)

      if (chargeDate >= d30) current += amount
      else if (chargeDate >= d60) days30 += amount
      else if (chargeDate >= d90) days60 += amount
      else days90Plus += amount
    }

    totalCurrent += current
    total30 += days30
    total60 += days60
    total90Plus += days90Plus

    const balance = parseFloat(acc.balance as string)
    const creditLimit = parseFloat(acc.credit_limit as string)
    const utilizationPct = creditLimit > 0 ? Math.round((balance / creditLimit) * 100) : 0

    return {
      id: acc.id,
      name: acc.name,
      balance,
      credit_limit: creditLimit,
      utilization_pct: utilizationPct,
      current,
      days_30: days30,
      days_60: days60,
      days_90_plus: days90Plus,
      last_payment: acc.last_payment_at,
    }
  })

  return NextResponse.json({
    data: {
      summary: {
        current: totalCurrent,
        days_30: total30,
        days_60: total60,
        days_90_plus: total90Plus,
        total: totalCurrent + total30 + total60 + total90Plus,
      },
      accounts: accountAging.sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        (b.balance as number) - (a.balance as number)
      ),
    },
  })
}
