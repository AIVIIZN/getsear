import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getDailySales } from '@/lib/reports/queries'

/**
 * GET /api/reports/daily — daily sales summary
 * Query params: date (YYYY-MM-DD), location_id
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner', 'manager', 'admin'])
  if (roleCheck) return roleCheck

  const params = request.nextUrl.searchParams
  const date = params.get('date') ?? new Date().toISOString().split('T')[0]
  const locationId = params.get('location_id') ?? undefined

  const result = await getDailySales(user.org_id, date, locationId)

  if (result.is_mock || !result.data) {
    return NextResponse.json({
      is_mock: true,
      data: {
        date,
        total_sales: 0,
        total_revenue: 0,
        orders: 0,
        order_count: 0,
        avg_check: 0,
        average_check: 0,
        labor_pct: 0,
        labor_percentage: 0,
        prev_period: null,
      },
    })
  }

  // Map to response format (backward compatible)
  const d = result.data
  return NextResponse.json({
    is_mock: false,
    data: {
      date: d.date,
      total_sales: d.total_revenue,
      total_revenue: d.total_revenue,
      net_sales: d.net_revenue,
      net_revenue: d.net_revenue,
      orders: d.order_count,
      order_count: d.order_count,
      avg_check: d.average_check,
      average_check: d.average_check,
      covers: d.covers,
      discounts: d.discount_total,
      discount_total: d.discount_total,
      tax: d.tax_total,
      tax_total: d.tax_total,
      tips: d.tip_total,
      tip_total: d.tip_total,
      labor_pct: 0,
      labor_percentage: 0,
      by_order_type: d.by_order_type,
      by_hour: d.by_hour,
      by_payment_method: d.by_payment_method,
      prev_period: d.prev_period ? {
        total_sales: d.prev_period.total_revenue,
        orders: d.prev_period.order_count,
        avg_check: d.prev_period.average_check,
        labor_pct: 0,
      } : null,
    },
  })
}
