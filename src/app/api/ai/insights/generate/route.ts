import { apiError } from '@/lib/api/error-response'
import { NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { generateInsights } from '@/lib/ai/insight-generator'

/**
 * POST /api/ai/insights/generate — manual insight generation (admin only)
 */
export async function POST() {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin'])
  if (roleErr) return roleErr

  const locationId = user.location_ids[0] ?? ''

  try {
    const insights = await generateInsights({
      orgId: user.org_id,
      locationId,
      restaurantName: 'Your Restaurant',
      locationName: 'Main Location',
      timezone: 'America/New_York',
    })

    return NextResponse.json({
      data: insights,
      count: insights.length,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[api/ai/insights/generate] Error:', msg)
    return apiError(500, 'Failed to generate insights')
  }
}
