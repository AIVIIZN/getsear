/**
 * PDF generation utility using server-side rendering.
 * Generates branded PDF reports as CSV fallback (since @react-pdf/renderer
 * is not installed — we use CSV export with proper formatting).
 *
 * For full PDF with charts/branding, install @react-pdf/renderer.
 * This module provides CSV + structured JSON for client-side rendering.
 */

// ── Types ───────────────────────────────────────────────────────────────

export interface PDFReportOptions {
  title: string
  subtitle?: string
  dateRange: string
  locationName: string
  generatedAt?: string
}

export interface PDFTableColumn {
  header: string
  key: string
  align?: 'left' | 'right' | 'center'
  format?: 'currency' | 'percent' | 'number' | 'text'
}

export interface PDFReportData {
  options: PDFReportOptions
  columns: PDFTableColumn[]
  rows: Record<string, string | number>[]
  summary?: Record<string, string | number>
  kpis?: Array<{ label: string; value: string }>
}

// ── CSV Generation ──────────────────────────────────────────────────────

function escapeCSV(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}

function formatValue(val: string | number, format?: PDFTableColumn['format']): string {
  if (val === null || val === undefined) return ''
  const num = typeof val === 'number' ? val : parseFloat(val)

  switch (format) {
    case 'currency':
      return isNaN(num) ? String(val) : `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    case 'percent':
      return isNaN(num) ? String(val) : `${num.toFixed(1)}%`
    case 'number':
      return isNaN(num) ? String(val) : num.toLocaleString('en-US')
    default:
      return String(val)
  }
}

export function generateCSV(data: PDFReportData): string {
  const lines: string[] = []

  // Header info
  lines.push(escapeCSV(`Sear POS - ${data.options.title}`))
  lines.push(escapeCSV(`Location: ${data.options.locationName}`))
  lines.push(escapeCSV(`Date Range: ${data.options.dateRange}`))
  lines.push(escapeCSV(`Generated: ${data.options.generatedAt ?? new Date().toLocaleString()}`))
  lines.push('')

  // KPIs
  if (data.kpis && data.kpis.length > 0) {
    lines.push('Key Metrics')
    for (const kpi of data.kpis) {
      lines.push(`${escapeCSV(kpi.label)},${escapeCSV(kpi.value)}`)
    }
    lines.push('')
  }

  // Table headers
  lines.push(data.columns.map(c => escapeCSV(c.header)).join(','))

  // Data rows
  for (const row of data.rows) {
    const cells = data.columns.map(col => {
      const val = row[col.key]
      return escapeCSV(formatValue(val, col.format))
    })
    lines.push(cells.join(','))
  }

  // Summary row
  if (data.summary) {
    lines.push('')
    const summaryLine = data.columns.map(col => {
      const val = data.summary?.[col.key]
      if (val === undefined) return ''
      return escapeCSV(formatValue(val, col.format))
    })
    lines.push(summaryLine.join(','))
  }

  return lines.join('\n')
}

// ── Report-specific CSV builders ────────────────────────────────────────

export function buildDailySalesCSV(
  data: {
    date: string
    total_revenue: number
    net_revenue: number
    order_count: number
    average_check: number
    covers: number
    discount_total: number
    tax_total: number
    tip_total: number
    by_hour: Array<{ hour: string; sales: number; orders: number }>
  },
  locationName: string
): string {
  const reportData: PDFReportData = {
    options: {
      title: 'Daily Sales Report',
      dateRange: data.date,
      locationName,
    },
    columns: [
      { header: 'Hour', key: 'hour', align: 'left' },
      { header: 'Sales', key: 'sales', format: 'currency' },
      { header: 'Orders', key: 'orders', format: 'number' },
    ],
    rows: data.by_hour,
    kpis: [
      { label: 'Total Revenue', value: `$${data.total_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
      { label: 'Net Revenue', value: `$${data.net_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
      { label: 'Orders', value: data.order_count.toLocaleString() },
      { label: 'Average Check', value: `$${data.average_check.toFixed(2)}` },
      { label: 'Covers', value: data.covers.toLocaleString() },
      { label: 'Discounts', value: `$${data.discount_total.toFixed(2)}` },
      { label: 'Tax', value: `$${data.tax_total.toFixed(2)}` },
      { label: 'Tips', value: `$${data.tip_total.toFixed(2)}` },
    ],
  }

  return generateCSV(reportData)
}

export function buildLaborCSV(
  data: {
    entries: Array<{ name: string; role: string; hours: number; rate: number; total_pay: number; tips: number; overtime_hours: number }>
    total_labor_cost: number
    total_hours: number
    labor_percentage: number
    revenue: number
  },
  dateRange: string,
  locationName: string
): string {
  const reportData: PDFReportData = {
    options: {
      title: 'Labor Report',
      dateRange,
      locationName,
    },
    columns: [
      { header: 'Name', key: 'name' },
      { header: 'Role', key: 'role' },
      { header: 'Hours', key: 'hours', format: 'number' },
      { header: 'Rate', key: 'rate', format: 'currency' },
      { header: 'Total Pay', key: 'total_pay', format: 'currency' },
      { header: 'Tips', key: 'tips', format: 'currency' },
      { header: 'OT Hours', key: 'overtime_hours', format: 'number' },
    ],
    rows: data.entries,
    kpis: [
      { label: 'Total Labor Cost', value: `$${data.total_labor_cost.toFixed(2)}` },
      { label: 'Total Hours', value: data.total_hours.toFixed(1) },
      { label: 'Labor %', value: `${data.labor_percentage.toFixed(1)}%` },
      { label: 'Revenue', value: `$${data.revenue.toFixed(2)}` },
    ],
    summary: {
      name: 'Total',
      hours: data.total_hours,
      total_pay: data.total_labor_cost,
      tips: data.entries.reduce((s, e) => s + e.tips, 0),
      overtime_hours: data.entries.reduce((s, e) => s + e.overtime_hours, 0),
    },
  }

  return generateCSV(reportData)
}

export function buildGenericCSV(
  title: string,
  columns: PDFTableColumn[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: Record<string, any>[],
  dateRange: string,
  locationName: string,
  kpis?: Array<{ label: string; value: string }>
): string {
  return generateCSV({
    options: { title, dateRange, locationName },
    columns,
    rows,
    kpis,
  })
}
