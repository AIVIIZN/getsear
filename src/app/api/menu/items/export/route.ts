import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api/auth'
import { exportMenuCSV } from '@/lib/menu/csv-exporter'

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { searchParams } = request.nextUrl
  const locationId = searchParams.get('location_id')
  const categoryId = searchParams.get('category_id') ?? undefined
  const activeOnly = searchParams.get('active_only') === 'true'

  if (!locationId) {
    return apiError(400, 'location_id is required')
  }

  const csv = await exportMenuCSV(user.org_id, locationId, {
    categoryId,
    activeOnly,
  })

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="menu-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
