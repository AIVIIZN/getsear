import { NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getUsageSummary } from '@/lib/ai/cost-tracker'

/**
 * GET /api/ai/usage — get token usage and cost tracking
 */
export async function GET() {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin'])
  if (roleErr) return roleErr

  try {
    const usage = await getUsageSummary(user.org_id)

    return NextResponse.json({
      today: {
        queries: usage.today.queries,
        tokens_in: usage.today.tokenIn,
        tokens_out: usage.today.tokenOut,
        estimated_cost: `$${usage.today.cost.toFixed(4)}`,
      },
      this_month: {
        queries: usage.thisMonth.queries,
        tokens_in: usage.thisMonth.tokenIn,
        tokens_out: usage.thisMonth.tokenOut,
        estimated_cost: `$${usage.thisMonth.cost.toFixed(4)}`,
      },
      by_type: usage.byType.map((t) => ({
        type: t.type,
        queries: t.queries,
        estimated_cost: `$${t.cost.toFixed(4)}`,
      })),
      projected_monthly_cost: `$${usage.projectedMonthlyCost.toFixed(2)}`,
    })
  } catch (err) {
    console.error('[api/ai/usage] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch usage data' },
      { status: 500 }
    )
  }
}
