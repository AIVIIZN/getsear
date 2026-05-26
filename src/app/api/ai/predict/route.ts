import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { generatePredictions } from '@/lib/ai/prediction-engine'

/**
 * GET /api/ai/predict — get predictions for a date range
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const searchParams = request.nextUrl.searchParams
  const startDate = searchParams.get('start_date')
  const endDate = searchParams.get('end_date')

  if (!startDate || !endDate) {
    // Default: today + 7 days
    const now = new Date()
    const defaultStart = now.toISOString().split('T')[0]
    const weekOut = new Date(now)
    weekOut.setDate(weekOut.getDate() + 7)
    const defaultEnd = weekOut.toISOString().split('T')[0]

    const result = await generatePredictions({
      orgId: user.org_id,
      locationId: user.location_ids[0] ?? '',
      startDate: defaultStart,
      endDate: defaultEnd,
      restaurantName: 'Your Restaurant',
      locationName: 'Main Location',
    })

    return NextResponse.json({
      predictions: result.predictions,
      accuracy: result.accuracy,
      minimum_data_met: result.minimumDataMet,
      weeks_of_data: result.weeksOfData,
    })
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    return apiError(400, 'Invalid date format. Use YYYY-MM-DD.')
  }

  // Limit range to 30 days
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  if (diffDays > 30) {
    return apiError(400, 'Date range too large. Maximum 30 days.')
  }

  try {
    const result = await generatePredictions({
      orgId: user.org_id,
      locationId: user.location_ids[0] ?? '',
      startDate,
      endDate,
      restaurantName: 'Your Restaurant',
      locationName: 'Main Location',
    })

    return NextResponse.json({
      predictions: result.predictions,
      accuracy: result.accuracy,
      minimum_data_met: result.minimumDataMet,
      weeks_of_data: result.weeksOfData,
    })
  } catch (err) {
    console.error('[api/ai/predict] Error:', err)
    return apiError(500, 'Failed to generate predictions')
  }
}
