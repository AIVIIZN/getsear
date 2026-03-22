import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

/**
 * GET /api/staff/tips — tip summary for date range
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('start')
  const endDate = searchParams.get('end')

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'start and end query params required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Fetch time entries with tips for the date range
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entries, error } = await (supabase.from('time_entries') as any)
    .select('id, user_id, clock_in, clock_out, cash_tips, credit_tips, regular_hours, overtime_hours')
    .eq('org_id', user.org_id)
    .gte('clock_in', `${startDate}T00:00:00Z`)
    .lte('clock_in', `${endDate}T23:59:59Z`)
    .not('clock_out', 'is', null)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch tip data' }, { status: 500 })
  }

  if (!entries || entries.length === 0) {
    return NextResponse.json({
      data: {
        total_cash_tips: '0.00',
        total_credit_tips: '0.00',
        combined_total: '0.00',
        by_staff: [],
      },
    })
  }

  // Get staff names
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userIds = [...new Set(entries.map((e: any) => e.user_id))]
  const { data: staff } = await (supabase.from('users') as any)
    .select('id, first_name, last_name, display_name')
    .in('id', userIds)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const staffMap = new Map((staff ?? []).map((s: any) => [s.id, s]))

  // Aggregate by user
  const byStaff = new Map<string, {
    user_id: string
    name: string
    cash_tips: number
    credit_tips: number
    hours_worked: number
  }>()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const entry of entries as any[]) {
    const existing = byStaff.get(entry.user_id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const staffMember = staffMap.get(entry.user_id) as any
    const name = staffMember
      ? (staffMember.display_name || `${staffMember.first_name} ${staffMember.last_name}`)
      : 'Unknown'

    const cashTips = parseFloat(entry.cash_tips ?? '0')
    const creditTips = parseFloat(entry.credit_tips ?? '0')
    const hours = (parseFloat(entry.regular_hours ?? '0') + parseFloat(entry.overtime_hours ?? '0'))

    if (existing) {
      existing.cash_tips += cashTips
      existing.credit_tips += creditTips
      existing.hours_worked += hours
    } else {
      byStaff.set(entry.user_id, {
        user_id: entry.user_id,
        name,
        cash_tips: cashTips,
        credit_tips: creditTips,
        hours_worked: hours,
      })
    }
  }

  const staffSummaries = Array.from(byStaff.values()).map((s) => ({
    ...s,
    cash_tips: s.cash_tips.toFixed(2),
    credit_tips: s.credit_tips.toFixed(2),
    total_tips: (s.cash_tips + s.credit_tips).toFixed(2),
    hours_worked: s.hours_worked.toFixed(2),
    tips_per_hour: s.hours_worked > 0
      ? ((s.cash_tips + s.credit_tips) / s.hours_worked).toFixed(2)
      : '0.00',
  }))

  const totalCash = staffSummaries.reduce((sum, s) => sum + parseFloat(s.cash_tips), 0)
  const totalCredit = staffSummaries.reduce((sum, s) => sum + parseFloat(s.credit_tips), 0)

  return NextResponse.json({
    data: {
      total_cash_tips: totalCash.toFixed(2),
      total_credit_tips: totalCredit.toFixed(2),
      combined_total: (totalCash + totalCredit).toFixed(2),
      by_staff: staffSummaries,
    },
  })
}
