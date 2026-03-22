import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import {
  getMockDailySales,
  getMockLaborData,
  getMockPMIX,
  getMockServerPerformance,
  getMockPaymentMix,
  getMockDiscounts,
  getMockTax,
  getMockCategoryMix,
} from '@/lib/reports/mock-data'

type ReportType = 'daily' | 'weekly' | 'monthly' | 'labor' | 'pmix' | 'server-performance' | 'payments' | 'discounts' | 'tax' | 'category-mix'

function toCsv(headers: string[], rows: string[][]): string {
  const escape = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`
    }
    return val
  }
  const lines = [headers.map(escape).join(',')]
  for (const row of rows) {
    lines.push(row.map(escape).join(','))
  }
  return lines.join('\n')
}

/**
 * GET /api/reports/export — CSV export for any report type
 * Query params: type (report type)
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner', 'manager', 'admin'])
  if (roleCheck) return roleCheck

  const params = request.nextUrl.searchParams
  const reportType = params.get('type') as ReportType | null

  if (!reportType) {
    return NextResponse.json({ error: 'type parameter is required' }, { status: 400 })
  }

  let csv = ''

  switch (reportType) {
    case 'daily':
    case 'weekly':
    case 'monthly': {
      const data = getMockDailySales(reportType === 'daily' ? 7 : reportType === 'weekly' ? 28 : 180)
      csv = toCsv(
        ['Date', 'Gross Sales', 'Net Sales', 'Orders', 'Discounts', 'Tax'],
        data.map((d) => [d.date, d.gross_sales.toString(), d.net_sales.toString(), d.orders.toString(), d.discounts.toString(), d.tax.toString()])
      )
      break
    }
    case 'labor': {
      const data = getMockLaborData()
      csv = toCsv(
        ['Name', 'Role', 'Hours', 'Rate', 'Total Pay', 'Tips', 'OT Hours'],
        data.entries.map((e) => [e.name, e.role, e.hours.toString(), e.rate.toString(), e.total_pay.toString(), e.tips.toString(), e.overtime_hours.toString()])
      )
      break
    }
    case 'pmix': {
      const data = getMockPMIX()
      csv = toCsv(
        ['Item', 'Category', 'Qty Sold', 'Revenue', 'Food Cost %', 'Margin %', 'Classification'],
        data.map((d) => [d.name, d.category, d.quantity_sold.toString(), d.revenue.toString(), d.food_cost_pct.toString(), d.margin_pct.toString(), d.classification])
      )
      break
    }
    case 'server-performance': {
      const data = getMockServerPerformance()
      csv = toCsv(
        ['Server', 'Total Sales', 'Orders', 'Avg Check', 'Avg Tip %', 'Covers'],
        data.map((d) => [d.name, d.total_sales.toString(), d.orders.toString(), d.avg_check.toString(), d.avg_tip_pct.toString(), d.covers.toString()])
      )
      break
    }
    case 'payments': {
      const data = getMockPaymentMix()
      csv = toCsv(
        ['Method', 'Amount', 'Percentage'],
        data.map((d) => [d.method, d.amount.toString(), d.percentage.toString()])
      )
      break
    }
    case 'discounts': {
      const data = getMockDiscounts()
      csv = toCsv(
        ['Discount', 'Count', 'Amount'],
        data.discounts.map((d) => [d.name, d.count.toString(), d.amount.toString()])
      )
      break
    }
    case 'tax': {
      const data = getMockTax()
      csv = toCsv(
        ['Rate Name', 'Rate %', 'Taxable Sales', 'Tax Collected'],
        data.map((d) => [d.rate_name, d.rate_pct.toString(), d.taxable_sales.toString(), d.tax_collected.toString()])
      )
      break
    }
    case 'category-mix': {
      const data = getMockCategoryMix()
      csv = toCsv(
        ['Category', 'Sales', 'Percentage'],
        data.map((d) => [d.category, d.sales.toString(), d.percentage.toString()])
      )
      break
    }
    default:
      return NextResponse.json({ error: `Unknown report type: ${reportType}` }, { status: 400 })
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${reportType}-report-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}
