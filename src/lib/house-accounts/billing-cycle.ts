/**
 * Billing cycle calculation utilities for house accounts.
 */

export type BillingCycle = 'weekly' | 'biweekly' | 'monthly'

export interface BillingConfig {
  cycle: BillingCycle
  auto_charge: boolean
  email_statement: boolean
  payment_method_id: string | null
  day_of_week: number // 0=Sunday for weekly
  day_of_month: number // 1-28 for monthly
}

/**
 * Calculate the next billing date based on cycle config.
 */
export function getNextBillingDate(config: BillingConfig, fromDate: Date = new Date()): Date {
  const next = new Date(fromDate)

  switch (config.cycle) {
    case 'weekly': {
      const currentDay = next.getDay()
      const targetDay = config.day_of_week ?? 1 // Monday default
      let daysUntil = targetDay - currentDay
      if (daysUntil <= 0) daysUntil += 7
      next.setDate(next.getDate() + daysUntil)
      break
    }
    case 'biweekly': {
      const currentDay = next.getDay()
      const targetDay = config.day_of_week ?? 1
      let daysUntil = targetDay - currentDay
      if (daysUntil <= 0) daysUntil += 14
      next.setDate(next.getDate() + daysUntil)
      break
    }
    case 'monthly': {
      const targetDay = Math.min(config.day_of_month ?? 1, 28)
      if (next.getDate() >= targetDay) {
        next.setMonth(next.getMonth() + 1)
      }
      next.setDate(targetDay)
      break
    }
  }

  next.setHours(0, 0, 0, 0)
  return next
}

/**
 * Calculate aging buckets for AR.
 */
export function calculateAging(
  accounts: Array<{
    id: string
    name: string
    balance: number
    last_payment_at: string | null
    charges: Array<{ date: string; amount: number }>
  }>
): {
  current: number
  days_30: number
  days_60: number
  days_90: number
  days_90_plus: number
  total: number
  accounts: Array<{
    id: string
    name: string
    balance: number
    current: number
    days_30: number
    days_60: number
    days_90: number
    days_90_plus: number
  }>
} {
  const now = new Date()
  const day30 = new Date(now)
  day30.setDate(day30.getDate() - 30)
  const day60 = new Date(now)
  day60.setDate(day60.getDate() - 60)
  const day90 = new Date(now)
  day90.setDate(day90.getDate() - 90)

  let totalCurrent = 0
  let total30 = 0
  let total60 = 0
  let total90 = 0
  let total90Plus = 0

  const accountAging = accounts.map((account) => {
    let current = 0
    let d30 = 0
    let d60 = 0
    const d90 = 0
    let d90Plus = 0

    for (const charge of account.charges) {
      const chargeDate = new Date(charge.date)
      if (chargeDate >= day30) {
        current += charge.amount
      } else if (chargeDate >= day60) {
        d30 += charge.amount
      } else if (chargeDate >= day90) {
        d60 += charge.amount
      } else {
        d90Plus += charge.amount
      }
    }

    totalCurrent += current
    total30 += d30
    total60 += d60
    total90 += d90
    total90Plus += d90Plus

    return {
      id: account.id,
      name: account.name,
      balance: account.balance,
      current,
      days_30: d30,
      days_60: d60,
      days_90: d90,
      days_90_plus: d90Plus,
    }
  })

  return {
    current: totalCurrent,
    days_30: total30,
    days_60: total60,
    days_90: total90,
    days_90_plus: total90Plus,
    total: totalCurrent + total30 + total60 + total90 + total90Plus,
    accounts: accountAging,
  }
}

/**
 * Check credit limit status.
 */
export function getCreditStatus(
  balance: number,
  creditLimit: number
): {
  utilization_pct: number
  status: 'ok' | 'warning' | 'blocked'
  remaining: number
} {
  if (creditLimit <= 0) {
    return { utilization_pct: 0, status: 'ok', remaining: 0 }
  }

  const pct = Math.round((balance / creditLimit) * 100)
  let status: 'ok' | 'warning' | 'blocked' = 'ok'
  if (pct >= 100) status = 'blocked'
  else if (pct >= 80) status = 'warning'

  return {
    utilization_pct: pct,
    status,
    remaining: Math.max(0, creditLimit - balance),
  }
}
