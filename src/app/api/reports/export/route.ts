import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getDailySales, getLaborData, getProductMix, getServerPerformance, getPaymentSummary, getTaxData, getCashDrawerReport, getVoidCompData } from '@/lib/reports/queries'
import { buildDailySalesCSV, buildLaborCSV, buildGenericCSV } from '@/lib/reports/pdf-generator'

type ReportType = 'daily' | 'labor' | 'pmix' | 'server-performance' | 'payments' | 'tax' | 'cash' | 'voids-comps' | 'category-mix'

/**
 * GET /api/reports/export — CSV/PDF export for any report type
 * Query params: type, date, date_from, date_to, location_id, format (csv|pdf)
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner', 'manager', 'admin'])
  if (roleCheck) return roleCheck

  const params = request.nextUrl.searchParams
  const reportType = params.get('type') as ReportType | null
  const date = params.get('date') ?? new Date().toISOString().split('T')[0]
  const dateFrom = params.get('date_from') ?? date
  const dateTo = params.get('date_to') ?? date
  const locationId = params.get('location_id') ?? undefined

  if (!reportType) {
    return apiError(400, 'type parameter is required')
  }

  const locationName = 'Sear POS Location' // Would resolve from DB
  let csv = ''

  switch (reportType) {
    case 'daily': {
      const result = await getDailySales(user.org_id, date, locationId)
      if (result.data) {
        csv = buildDailySalesCSV(result.data, locationName)
      } else {
        csv = 'No data available for this date'
      }
      break
    }
    case 'labor': {
      const result = await getLaborData(user.org_id, dateFrom, dateTo, locationId)
      if (result.data) {
        csv = buildLaborCSV(result.data, `${dateFrom} to ${dateTo}`, locationName)
      } else {
        csv = 'No labor data available for this period'
      }
      break
    }
    case 'pmix': {
      const result = await getProductMix(user.org_id, dateFrom, dateTo, locationId)
      if (result.data) {
        csv = buildGenericCSV(
          'Product Mix Report',
          [
            { header: 'Item', key: 'name' },
            { header: 'Category', key: 'category' },
            { header: 'Qty Sold', key: 'quantity_sold', format: 'number' },
            { header: 'Revenue', key: 'revenue', format: 'currency' },
            { header: 'Food Cost %', key: 'food_cost_pct', format: 'percent' },
            { header: 'Margin %', key: 'margin_pct', format: 'percent' },
            { header: 'Classification', key: 'classification' },
          ],
          result.data,
          `${dateFrom} to ${dateTo}`,
          locationName
        )
      } else {
        csv = 'No PMIX data available for this period'
      }
      break
    }
    case 'server-performance': {
      const result = await getServerPerformance(user.org_id, dateFrom, dateTo, locationId)
      if (result.data) {
        csv = buildGenericCSV(
          'Server Performance Report',
          [
            { header: 'Server', key: 'name' },
            { header: 'Total Sales', key: 'total_sales', format: 'currency' },
            { header: 'Orders', key: 'orders', format: 'number' },
            { header: 'Avg Check', key: 'avg_check', format: 'currency' },
            { header: 'Avg Tip %', key: 'avg_tip_pct', format: 'percent' },
            { header: 'Covers', key: 'covers', format: 'number' },
          ],
          result.data,
          `${dateFrom} to ${dateTo}`,
          locationName
        )
      } else {
        csv = 'No server performance data available'
      }
      break
    }
    case 'payments': {
      const result = await getPaymentSummary(user.org_id, dateFrom, dateTo, locationId)
      if (result.data) {
        csv = buildGenericCSV(
          'Payment Summary',
          [
            { header: 'Method', key: 'method' },
            { header: 'Amount', key: 'amount', format: 'currency' },
            { header: 'Percentage', key: 'percentage', format: 'percent' },
            { header: 'Tips', key: 'tip_total', format: 'currency' },
            { header: 'Refunds', key: 'refund_total', format: 'currency' },
            { header: 'Count', key: 'count', format: 'number' },
          ],
          result.data,
          `${dateFrom} to ${dateTo}`,
          locationName
        )
      } else {
        csv = 'No payment data available'
      }
      break
    }
    case 'tax': {
      const result = await getTaxData(user.org_id, dateFrom, dateTo, locationId)
      if (result.data) {
        csv = buildGenericCSV(
          'Tax Report',
          [
            { header: 'Rate Name', key: 'rate_name' },
            { header: 'Rate %', key: 'rate_pct', format: 'percent' },
            { header: 'Taxable Sales', key: 'taxable_sales', format: 'currency' },
            { header: 'Tax Collected', key: 'tax_collected', format: 'currency' },
          ],
          result.data,
          `${dateFrom} to ${dateTo}`,
          locationName
        )
      } else {
        csv = 'No tax data available'
      }
      break
    }
    case 'cash': {
      const result = await getCashDrawerReport(user.org_id, date, locationId)
      if (result.data) {
        csv = buildGenericCSV(
          'Cash Drawer Report',
          [
            { header: 'Employee', key: 'employee_name' },
            { header: 'Starting Cash', key: 'starting_cash', format: 'currency' },
            { header: 'Cash Sales', key: 'cash_sales', format: 'currency' },
            { header: 'Payouts', key: 'cash_payouts', format: 'currency' },
            { header: 'Expected', key: 'expected_cash', format: 'currency' },
            { header: 'Actual', key: 'actual_cash', format: 'currency' },
            { header: 'Over/Short', key: 'over_short', format: 'currency' },
          ],
          result.data,
          date,
          locationName
        )
      } else {
        csv = 'No cash drawer data available'
      }
      break
    }
    case 'voids-comps': {
      const result = await getVoidCompData(user.org_id, dateFrom, dateTo, locationId)
      if (result.data) {
        csv = buildGenericCSV(
          'Voids & Comps Report',
          [
            { header: 'Employee', key: 'employee_name' },
            { header: 'Voids', key: 'void_count', format: 'number' },
            { header: 'Void Total', key: 'void_total', format: 'currency' },
            { header: 'Comps', key: 'comp_count', format: 'number' },
            { header: 'Comp Total', key: 'comp_total', format: 'currency' },
            { header: 'Discounts', key: 'discount_count', format: 'number' },
            { header: 'Discount Total', key: 'discount_total', format: 'currency' },
            { header: 'Flagged', key: 'is_flagged' },
          ],
          result.data.by_employee,
          `${dateFrom} to ${dateTo}`,
          locationName,
          [
            { label: 'Total Voids', value: `$${result.data.total_void.toFixed(2)}` },
            { label: 'Total Comps', value: `$${result.data.total_comp.toFixed(2)}` },
            { label: 'Total Discounts', value: `$${result.data.total_discount.toFixed(2)}` },
          ]
        )
      } else {
        csv = 'No void/comp data available'
      }
      break
    }
    default:
      return apiError(400, `Unknown report type: ${reportType}`)
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${reportType}-report-${date}.csv"`,
    },
  })
}
