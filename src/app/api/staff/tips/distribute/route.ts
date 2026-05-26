import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const distributeSchema = z.object({
  date: z.string(),
  location_id: z.string().uuid(),
  total_pool_amount: z.string(),
  distributions: z.array(z.object({
    user_id: z.string().uuid(),
    amount: z.string(),
  })),
})

/**
 * POST /api/staff/tips/distribute — distribute tip pool
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = distributeSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const { date, location_id, total_pool_amount, distributions } = parsed.data
  const supabase = createAdminClient()

  // Verify total adds up
  const distributionTotal = distributions.reduce((sum, d) => sum + parseFloat(d.amount), 0)
  const poolTotal = parseFloat(total_pool_amount)

  if (Math.abs(distributionTotal - poolTotal) > 0.01) {
    return apiError(400, 'Distribution amounts do not match pool total')
  }

  // Create tip_distributions record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: distribution, error: distError } = await (supabase.from('tip_distributions') as any)
    .insert({
      org_id: user.org_id,
      location_id,
      shift_date: date,
      total_pool_amount,
      distribution_data: distributions,
      distributed_by: user.id,
      distributed_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (distError) {
    // If tip_distributions table doesn't exist yet, update time entries directly
    // Update each staff member's time entries for that date
    for (const dist of distributions) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('time_entries') as any)
        .update({
          tip_out_received: dist.amount,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', dist.user_id)
        .eq('org_id', user.org_id)
        .gte('clock_in', `${date}T00:00:00Z`)
        .lte('clock_in', `${date}T23:59:59Z`)
    }

    return NextResponse.json({
      data: {
        success: true,
        date,
        total_distributed: total_pool_amount,
        staff_count: distributions.length,
      },
    })
  }

  // Also update individual time entries
  for (const dist of distributions) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('time_entries') as any)
      .update({
        tip_out_received: dist.amount,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', dist.user_id)
      .eq('org_id', user.org_id)
      .gte('clock_in', `${date}T00:00:00Z`)
      .lte('clock_in', `${date}T23:59:59Z`)
  }

  return NextResponse.json({ data: distribution }, { status: 201 })
}
