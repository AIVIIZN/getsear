/**
 * Report constants: thresholds, daypart definitions, color maps, chart colors.
 * Shared across all report pages and API routes.
 */

// ── Chart Colors (Sear Design System) ───────────────────────────────────
export const CHART_COLORS = {
  primary: '#007AFF',     // Ember orange
  blue: '#2563EB',
  green: '#16A34A',
  purple: '#7C3AED',
  amber: '#D97706',
  red: '#DC2626',
  gray: '#6B7280',
  lightGray: '#D1D5DB',
  warmGray50: '#F9FAFB',
  warmGray100: '#F3F4F6',
} as const

export const CHART_SERIES = [
  CHART_COLORS.primary,
  CHART_COLORS.blue,
  CHART_COLORS.green,
  CHART_COLORS.purple,
  CHART_COLORS.amber,
] as const

// ── Payment Method Color Map ────────────────────────────────────────────
export const PAYMENT_METHOD_COLORS: Record<string, string> = {
  cash: CHART_COLORS.green,
  credit_card: CHART_COLORS.primary,
  debit_card: CHART_COLORS.blue,
  gift_card: CHART_COLORS.purple,
  house_account: CHART_COLORS.amber,
  apple_pay: '#000000',
  google_pay: '#4285F4',
  external: CHART_COLORS.gray,
}

// ── Daypart Definitions ─────────────────────────────────────────────────
export interface Daypart {
  name: string
  startHour: number // inclusive
  endHour: number   // exclusive
}

export const DAYPARTS: Daypart[] = [
  { name: 'Breakfast', startHour: 6, endHour: 11 },
  { name: 'Lunch', startHour: 11, endHour: 15 },
  { name: 'Dinner', startHour: 15, endHour: 22 },
  { name: 'Late Night', startHour: 22, endHour: 6 },
]

export function getDaypart(hour: number): string {
  for (const dp of DAYPARTS) {
    if (dp.startHour < dp.endHour) {
      if (hour >= dp.startHour && hour < dp.endHour) return dp.name
    } else {
      // Wraps midnight (e.g. Late Night 22-6)
      if (hour >= dp.startHour || hour < dp.endHour) return dp.name
    }
  }
  return 'Other'
}

// ── Business Thresholds ─────────────────────────────────────────────────
export const THRESHOLDS = {
  /** Labor cost percentage target range */
  labor: {
    healthy: 30,     // <30% = green
    warning: 35,     // 30-35% = yellow
    // >35% = red
  },
  /** Food cost percentage target range */
  foodCost: {
    healthy: 28,     // <28% = green
    warning: 35,     // 28-35% = yellow
    // >35% = red
  },
  /** Cash drawer over/short tolerance (in cents) */
  cashOverShort: {
    green: 500,      // <$5 = green
    yellow: 2000,    // $5-$20 = yellow
    // >$20 = red
  },
  /** Void rate threshold: employee flagged if >2x location average */
  voidRateMultiplier: 2,
  /** Speed of service: outlier threshold (>2x average) */
  speedOutlierMultiplier: 2,
  /** Food cost variance: flag items >10% above theoretical */
  foodCostVarianceThreshold: 10,
  /** 13-week trend: highlight >10% deviation from average */
  trendDeviationThreshold: 10,
  /** Default business day cutoff hour (4 AM) */
  businessDayCutoffHour: 4,
} as const

// ── Cash Tolerance Color Helper ─────────────────────────────────────────
export type CashToleranceLevel = 'green' | 'yellow' | 'red'

export function getCashToleranceLevel(overShortCents: number): CashToleranceLevel {
  const abs = Math.abs(overShortCents)
  if (abs <= THRESHOLDS.cashOverShort.green) return 'green'
  if (abs <= THRESHOLDS.cashOverShort.yellow) return 'yellow'
  return 'red'
}

export const TOLERANCE_COLORS: Record<CashToleranceLevel, string> = {
  green: CHART_COLORS.green,
  yellow: CHART_COLORS.amber,
  red: CHART_COLORS.red,
}

// ── Health Color Helper ─────────────────────────────────────────────────
export type HealthLevel = 'good' | 'warning' | 'critical'

export function getLaborHealth(pct: number): HealthLevel {
  if (pct <= THRESHOLDS.labor.healthy) return 'good'
  if (pct <= THRESHOLDS.labor.warning) return 'warning'
  return 'critical'
}

export function getFoodCostHealth(pct: number): HealthLevel {
  if (pct <= THRESHOLDS.foodCost.healthy) return 'good'
  if (pct <= THRESHOLDS.foodCost.warning) return 'warning'
  return 'critical'
}

export const HEALTH_COLORS: Record<HealthLevel, string> = {
  good: CHART_COLORS.green,
  warning: CHART_COLORS.amber,
  critical: CHART_COLORS.red,
}

// ── PMIX Classification Colors ──────────────────────────────────────────
export const CLASSIFICATION_COLORS: Record<string, string> = {
  Star: CHART_COLORS.primary,
  Plowhorse: CHART_COLORS.blue,
  Puzzle: CHART_COLORS.purple,
  Dog: CHART_COLORS.gray,
}

// ── Report Hub Sections ─────────────────────────────────────────────────
export interface ReportDefinition {
  id: string
  name: string
  description: string
  href: string
  icon: string // Lucide icon name
  section: 'daily' | 'financial' | 'staff' | 'trends'
}

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  { id: 'sales', name: 'Daily Sales', description: 'Revenue, orders, and average check', href: '/reports/sales', icon: 'DollarSign', section: 'daily' },
  { id: 'payments', name: 'Payment Summary', description: 'Breakdown by payment method and tips', href: '/reports/payments', icon: 'CreditCard', section: 'daily' },
  { id: 'cash', name: 'Cash Report', description: 'Drawer reconciliation and over/short', href: '/reports/cash', icon: 'Banknote', section: 'daily' },
  { id: 'tax', name: 'Tax Report', description: 'Tax collected by jurisdiction', href: '/reports/tax', icon: 'Receipt', section: 'daily' },
  { id: 'speed', name: 'Speed of Service', description: 'Kitchen ticket times by station', href: '/reports/speed-of-service', icon: 'Timer', section: 'daily' },
  { id: 'pmix', name: 'Product Mix', description: 'Item popularity and profitability', href: '/reports/product-mix', icon: 'ChefHat', section: 'financial' },
  { id: 'food-cost', name: 'Food Cost', description: 'Theoretical vs actual food cost', href: '/reports/food-cost', icon: 'Salad', section: 'financial' },
  { id: 'pnl', name: 'P&L Summary', description: 'Revenue, COGS, labor, and profit', href: '/reports/pnl', icon: 'TrendingUp', section: 'financial' },
  { id: 'voids', name: 'Voids & Comps', description: 'Void patterns and employee flags', href: '/reports/voids-comps', icon: 'AlertTriangle', section: 'financial' },
  { id: 'labor', name: 'Labor', description: 'Hours, cost, and labor percentage', href: '/reports/labor', icon: 'Users', section: 'staff' },
  { id: 'server', name: 'Server Performance', description: 'Sales, tips, and checks per server', href: '/reports/server-performance', icon: 'UserCheck', section: 'staff' },
  { id: 'trends', name: '13-Week Trends', description: 'Rolling averages for key metrics', href: '/reports/trends', icon: 'LineChart', section: 'trends' },
]

export const REPORT_SECTIONS = [
  { id: 'daily', label: 'Daily Operations' },
  { id: 'financial', label: 'Financial' },
  { id: 'staff', label: 'Staff Performance' },
  { id: 'trends', label: 'Trends' },
] as const

// ── Date Helpers ────────────────────────────────────────────────────────
/**
 * Get the business date for a given timestamp based on cutoff hour.
 * Orders at 1 AM Saturday count as Friday's business day.
 */
export function getBusinessDate(timestamp: Date, cutoffHour: number = THRESHOLDS.businessDayCutoffHour): string {
  const d = new Date(timestamp)
  if (d.getHours() < cutoffHour) {
    d.setDate(d.getDate() - 1)
  }
  return d.toISOString().split('T')[0]
}

/**
 * Get the business day time range in UTC (cutoff to cutoff).
 */
export function getBusinessDayRange(date: string, cutoffHour: number = THRESHOLDS.businessDayCutoffHour): { from: string; to: string } {
  const start = new Date(`${date}T00:00:00Z`)
  start.setUTCHours(cutoffHour, 0, 0, 0)

  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  return {
    from: start.toISOString(),
    to: end.toISOString(),
  }
}

// ── Format Helpers ──────────────────────────────────────────────────────
export function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatDollars(dollars: number): string {
  return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}
