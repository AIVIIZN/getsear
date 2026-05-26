import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { generatePayrollExport, getPayrollFilename, type PayrollEmployee, type PayrollFormat } from '@/lib/staff/payroll-export'

const exportSchema = z.object({
  format: z.enum(['generic', 'adp', 'gusto', 'paychex']),
  period_start: z.string(),
  period_end: z.string(),
  location_id: z.string().uuid(),
})

/**
 * POST /api/staff/payroll/export — generate payroll CSV export
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = exportSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const { format, period_start, period_end, location_id } = parsed.data
  const supabase = createAdminClient()

  // Get location name
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: location } = await (supabase.from('locations') as any)
    .select('name')
    .eq('id', location_id)
    .single()

  // Get all time entries in the pay period
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entries } = await (supabase.from('time_entries') as any)
    .select('user_id, regular_hours, overtime_hours, hourly_rate, cash_tips, credit_tips, tip_out_received, total_pay')
    .eq('org_id', user.org_id)
    .eq('location_id', location_id)
    .gte('clock_in', `${period_start}T00:00:00Z`)
    .lte('clock_in', `${period_end}T23:59:59Z`)
    .not('clock_out', 'is', null)

  if (!entries || entries.length === 0) {
    return apiError(404, 'No time entries found for this period')
  }

  // Get unique users
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userIds = [...new Set(entries.map((e: any) => e.user_id))]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: users } = await (supabase.from('users') as any)
    .select('id, first_name, last_name, email, role')
    .in('id', userIds)

  // Aggregate entries per user
  const userMap = new Map<string, {
    regularHours: number
    overtimeHours: number
    regularPayCents: number
    overtimePayCents: number
    cardTipsCents: number
    cashTipsCents: number
    tipPoolShareCents: number
  }>()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const e of entries as any[]) {
    const existing = userMap.get(e.user_id) ?? {
      regularHours: 0,
      overtimeHours: 0,
      regularPayCents: 0,
      overtimePayCents: 0,
      cardTipsCents: 0,
      cashTipsCents: 0,
      tipPoolShareCents: 0,
    }

    const regHrs = parseFloat(e.regular_hours ?? '0')
    const otHrs = parseFloat(e.overtime_hours ?? '0')
    const rate = Math.round(parseFloat(e.hourly_rate ?? '0') * 100)

    existing.regularHours += regHrs
    existing.overtimeHours += otHrs
    existing.regularPayCents += Math.round(regHrs * rate)
    existing.overtimePayCents += Math.round(otHrs * rate * 1.5)
    existing.cardTipsCents += Math.round(parseFloat(e.credit_tips ?? '0') * 100)
    existing.cashTipsCents += Math.round(parseFloat(e.cash_tips ?? '0') * 100)
    existing.tipPoolShareCents += Math.round(parseFloat(e.tip_out_received ?? '0') * 100)

    userMap.set(e.user_id, existing)
  }

  // Build employee data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employees: PayrollEmployee[] = (users ?? []).map((u: any) => {
    const data = userMap.get(u.id) ?? {
      regularHours: 0, overtimeHours: 0,
      regularPayCents: 0, overtimePayCents: 0,
      cardTipsCents: 0, cashTipsCents: 0, tipPoolShareCents: 0,
    }

    const totalComp = data.regularPayCents + data.overtimePayCents +
      data.cardTipsCents + data.cashTipsCents + data.tipPoolShareCents

    return {
      userId: u.id,
      employeeId: u.id.slice(0, 8),
      firstName: u.first_name,
      lastName: u.last_name,
      email: u.email ?? '',
      role: u.role,
      regularHours: data.regularHours,
      overtimeHours: data.overtimeHours,
      regularRateCents: data.regularHours > 0 ? Math.round(data.regularPayCents / data.regularHours) : 0,
      overtimeRateCents: data.overtimeHours > 0 ? Math.round(data.overtimePayCents / data.overtimeHours) : 0,
      regularPayCents: data.regularPayCents,
      overtimePayCents: data.overtimePayCents,
      cardTipsCents: data.cardTipsCents,
      cashTipsDeclaredCents: data.cashTipsCents,
      tipPoolShareCents: data.tipPoolShareCents,
      totalCompensationCents: totalComp,
    }
  })

  const csv = generatePayrollExport({
    format: format as PayrollFormat,
    periodStart: period_start,
    periodEnd: period_end,
    locationName: location?.name ?? 'Unknown',
    employees,
  })

  const filename = getPayrollFilename(format as PayrollFormat, period_start, period_end)

  // Log the export for audit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('payroll_exports') as any)
    .insert({
      org_id: user.org_id,
      location_id,
      pay_period_start: period_start,
      pay_period_end: period_end,
      format,
      exported_by: user.id,
      created_at: new Date().toISOString(),
    })
    .catch(() => {
      // Table may not exist yet — that's fine
    })

  return NextResponse.json({
    data: {
      csv,
      filename,
      employeeCount: employees.length,
      format,
      periodStart: period_start,
      periodEnd: period_end,
    },
  })
}
