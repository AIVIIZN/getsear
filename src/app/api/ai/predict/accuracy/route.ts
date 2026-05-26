import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getPredictionAccuracy } from '@/lib/ai/prediction-engine'

/**
 * GET /api/ai/predict/accuracy — get prediction accuracy metrics
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const searchParams = request.nextUrl.searchParams

  // Default: last 30 days
  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const startDate = searchParams.get('start_date') ?? thirtyDaysAgo.toISOString().split('T')[0]
  const endDate = searchParams.get('end_date') ?? now.toISOString().split('T')[0]

  try {
    const accuracy = await getPredictionAccuracy({
      orgId: user.org_id,
      locationId: user.location_ids[0] ?? '',
      startDate,
      endDate,
    })

    return NextResponse.json(accuracy)
  } catch (err) {
    console.error('[api/ai/predict/accuracy] Error:', err)
    return apiError(500, 'Failed to calculate accuracy')
  }
}
