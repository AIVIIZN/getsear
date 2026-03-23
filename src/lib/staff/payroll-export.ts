/**
 * Payroll CSV Export Generator
 *
 * Generates CSV files in 4 formats:
 * 1. Generic CSV
 * 2. ADP Workforce Now
 * 3. Gusto
 * 4. Paychex Flex
 *
 * All money values are passed in cents and converted to dollars for export.
 * SSN data (last 4 for Paychex) is only included if available; never displayed in UI.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PayrollFormat = 'generic' | 'adp' | 'gusto' | 'paychex'

export interface PayrollEmployee {
  userId: string
  employeeId: string
  firstName: string
  lastName: string
  email: string
  role: string
  /** Last 4 of SSN (for Paychex only, from secure storage) */
  ssnLast4?: string
  regularHours: number
  overtimeHours: number
  regularRateCents: number
  overtimeRateCents: number
  regularPayCents: number
  overtimePayCents: number
  cardTipsCents: number
  cashTipsDeclaredCents: number
  tipPoolShareCents: number
  totalCompensationCents: number
}

export interface PayrollExportOptions {
  format: PayrollFormat
  periodStart: string
  periodEnd: string
  locationName: string
  employees: PayrollEmployee[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2)
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function toCSV(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCSV).join(',')
  const dataLines = rows.map((row) => row.map(escapeCSV).join(','))
  return [headerLine, ...dataLines].join('\n')
}

// ---------------------------------------------------------------------------
// Format: Generic CSV
// ---------------------------------------------------------------------------

function generateGeneric(options: PayrollExportOptions): string {
  const headers = [
    'Period Start',
    'Period End',
    'Employee Name',
    'Employee ID',
    'Role',
    'Regular Hours',
    'OT Hours',
    'Regular Rate',
    'OT Rate',
    'Regular Pay',
    'OT Pay',
    'Card Tips',
    'Cash Tips Declared',
    'Tip Pool Share',
    'Total Compensation',
  ]

  const rows = options.employees.map((emp) => [
    options.periodStart,
    options.periodEnd,
    `${emp.firstName} ${emp.lastName}`,
    emp.employeeId,
    emp.role,
    emp.regularHours.toFixed(2),
    emp.overtimeHours.toFixed(2),
    centsToDollars(emp.regularRateCents),
    centsToDollars(emp.overtimeRateCents),
    centsToDollars(emp.regularPayCents),
    centsToDollars(emp.overtimePayCents),
    centsToDollars(emp.cardTipsCents),
    centsToDollars(emp.cashTipsDeclaredCents),
    centsToDollars(emp.tipPoolShareCents),
    centsToDollars(emp.totalCompensationCents),
  ])

  return toCSV(headers, rows)
}

// ---------------------------------------------------------------------------
// Format: ADP Workforce Now
// ---------------------------------------------------------------------------

function generateADP(options: PayrollExportOptions): string {
  const headers = [
    'Co Code',
    'Batch ID',
    'File #',
    'Reg Hours',
    'O/T Hours',
    'Reg Earnings',
    'O/T Earnings',
    'Earnings 3 Code',
    'Earnings 3 Amount',
    'Memo Code',
    'Memo Amount',
  ]

  const rows = options.employees.map((emp) => [
    '', // Co Code — client fills
    '', // Batch ID — client fills
    emp.employeeId,
    emp.regularHours.toFixed(2),
    emp.overtimeHours.toFixed(2),
    centsToDollars(emp.regularPayCents),
    centsToDollars(emp.overtimePayCents),
    'TIP', // Earnings 3 Code for tips
    centsToDollars(emp.cardTipsCents + emp.cashTipsDeclaredCents + emp.tipPoolShareCents),
    '', // Memo Code
    '', // Memo Amount
  ])

  return toCSV(headers, rows)
}

// ---------------------------------------------------------------------------
// Format: Gusto
// ---------------------------------------------------------------------------

function generateGusto(options: PayrollExportOptions): string {
  const headers = [
    'Employee Email',
    'Employee First Name',
    'Employee Last Name',
    'Regular Hours',
    'Overtime Hours',
    'Regular Pay',
    'Overtime Pay',
    'Tips',
    'Additional Earnings',
    'Additional Earnings Type',
  ]

  const rows = options.employees.map((emp) => [
    emp.email,
    emp.firstName,
    emp.lastName,
    emp.regularHours.toFixed(2),
    emp.overtimeHours.toFixed(2),
    centsToDollars(emp.regularPayCents),
    centsToDollars(emp.overtimePayCents),
    centsToDollars(emp.cardTipsCents + emp.cashTipsDeclaredCents),
    centsToDollars(emp.tipPoolShareCents),
    emp.tipPoolShareCents > 0 ? 'Tip Pool' : '',
  ])

  return toCSV(headers, rows)
}

// ---------------------------------------------------------------------------
// Format: Paychex Flex
// ---------------------------------------------------------------------------

function generatePaychex(options: PayrollExportOptions): string {
  const headers = [
    'SSN Last 4',
    'Employee ID',
    'First Name',
    'Last Name',
    'Regular Hours',
    'OT Hours',
    'Regular Earnings',
    'OT Earnings',
    'Reported Tips',
    'Pay Period Start',
    'Pay Period End',
  ]

  const rows = options.employees.map((emp) => [
    emp.ssnLast4 ?? '',
    emp.employeeId,
    emp.firstName,
    emp.lastName,
    emp.regularHours.toFixed(2),
    emp.overtimeHours.toFixed(2),
    centsToDollars(emp.regularPayCents),
    centsToDollars(emp.overtimePayCents),
    centsToDollars(emp.cardTipsCents + emp.cashTipsDeclaredCents + emp.tipPoolShareCents),
    options.periodStart,
    options.periodEnd,
  ])

  return toCSV(headers, rows)
}

// ---------------------------------------------------------------------------
// Main: generate export
// ---------------------------------------------------------------------------

export function generatePayrollExport(options: PayrollExportOptions): string {
  switch (options.format) {
    case 'generic':
      return generateGeneric(options)
    case 'adp':
      return generateADP(options)
    case 'gusto':
      return generateGusto(options)
    case 'paychex':
      return generatePaychex(options)
    default:
      return generateGeneric(options)
  }
}

/**
 * Get the filename for a payroll export.
 */
export function getPayrollFilename(format: PayrollFormat, periodStart: string, periodEnd: string): string {
  const formatLabel = format.toUpperCase()
  return `payroll_${formatLabel}_${periodStart}_to_${periodEnd}.csv`
}
