/**
 * Tip Pool Calculator
 *
 * 4 models:
 * 1. Direct: server keeps 100% of their tips
 * 2. Tip-out by % of Sales: configurable percentage per support role
 * 3. Pool by Hours: all tips pooled, split proportionally by hours worked
 * 4. Hybrid (Points): each role has a point value, pool split by weighted points
 *
 * Processing fee deduction option: deducts card processing fee before pooling.
 * FLSA compliance: managers/owners cannot participate in tip pools.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TipPoolModel = 'direct' | 'tipout_sales' | 'pool_hours' | 'hybrid_points'

export interface TipPoolConfig {
  model: TipPoolModel
  /** Tip-out percentages by role (for tipout_sales model) */
  tipoutPercentages: Record<string, number>
  /** Point values by role (for hybrid_points model) */
  pointValues: Record<string, number>
  /** Roles eligible for tip pool */
  eligibleRoles: string[]
  /** Whether to include BOH in the pool */
  includeBoh: boolean
  /** Whether to deduct card processing fee */
  deductProcessingFee: boolean
  /** Processing fee percentage (e.g. 2.49) */
  processingFeePct: number
}

export interface EmployeeTipData {
  userId: string
  name: string
  role: string
  hoursWorked: number
  /** Card tips earned by this employee */
  cardTipsCents: number
  /** Cash tips declared by this employee */
  cashTipsDeclaredCents: number
  /** Net sales for this employee (for tipout_sales model) */
  netSalesCents: number
}

export interface TipDistributionResult {
  userId: string
  name: string
  role: string
  /** Original card tips earned */
  cardTipsCents: number
  /** Cash tips declared */
  cashTipsDeclaredCents: number
  /** Share from pool (if applicable) */
  poolShareCents: number
  /** Tip-out owed to support staff */
  tipOutGivenCents: number
  /** Tip-out received from tipped employees */
  tipOutReceivedCents: number
  /** Processing fee deducted */
  processingFeeDeductedCents: number
  /** Net tips after all calculations */
  netTipsCents: number
  /** Breakdown explanation */
  breakdown: string
}

export interface TipPoolSummary {
  totalCardTipsCents: number
  totalCashTipsDeclaredCents: number
  totalProcessingFeesCents: number
  totalPoolAmountCents: number
  tipsPerLaborHour: number
  distributions: TipDistributionResult[]
}

// ---------------------------------------------------------------------------
// Managers/owners cannot be in tip pool (FLSA)
// ---------------------------------------------------------------------------

const EXCLUDED_ROLES = ['owner', 'admin', 'manager', 'platform_admin']

function isEligibleForPool(role: string, eligibleRoles: string[]): boolean {
  if (EXCLUDED_ROLES.includes(role)) return false
  return eligibleRoles.includes(role)
}

// ---------------------------------------------------------------------------
// Model 1: Direct — server keeps 100%
// ---------------------------------------------------------------------------

function calculateDirect(
  employees: EmployeeTipData[],
  config: TipPoolConfig
): TipPoolSummary {
  const distributions: TipDistributionResult[] = []
  let totalCardTips = 0
  let totalCashTips = 0
  let totalFees = 0

  for (const emp of employees) {
    totalCardTips += emp.cardTipsCents
    totalCashTips += emp.cashTipsDeclaredCents

    let processingFee = 0
    if (config.deductProcessingFee) {
      processingFee = Math.round(emp.cardTipsCents * (config.processingFeePct / 100))
    }
    totalFees += processingFee

    const netTips = emp.cardTipsCents - processingFee + emp.cashTipsDeclaredCents

    distributions.push({
      userId: emp.userId,
      name: emp.name,
      role: emp.role,
      cardTipsCents: emp.cardTipsCents,
      cashTipsDeclaredCents: emp.cashTipsDeclaredCents,
      poolShareCents: 0,
      tipOutGivenCents: 0,
      tipOutReceivedCents: 0,
      processingFeeDeductedCents: processingFee,
      netTipsCents: netTips,
      breakdown: `Direct: keeps 100% of own tips${processingFee > 0 ? ` minus $${(processingFee / 100).toFixed(2)} processing fee` : ''}`,
    })
  }

  const totalHours = employees.reduce((s, e) => s + e.hoursWorked, 0)

  return {
    totalCardTipsCents: totalCardTips,
    totalCashTipsDeclaredCents: totalCashTips,
    totalProcessingFeesCents: totalFees,
    totalPoolAmountCents: 0,
    tipsPerLaborHour: totalHours > 0 ? (totalCardTips + totalCashTips - totalFees) / totalHours / 100 : 0,
    distributions,
  }
}

// ---------------------------------------------------------------------------
// Model 2: Tip-out by % of Sales
// ---------------------------------------------------------------------------

function calculateTipoutBySales(
  employees: EmployeeTipData[],
  config: TipPoolConfig
): TipPoolSummary {
  const distributions: TipDistributionResult[] = []
  let totalCardTips = 0
  let totalCashTips = 0
  let totalFees = 0

  // Separate tipped employees (servers/bartenders) from support staff
  const tippedEmployees = employees.filter(
    (e) => e.cardTipsCents > 0 || e.cashTipsDeclaredCents > 0
  )
  const supportEmployees = employees.filter(
    (e) => e.cardTipsCents === 0 && e.cashTipsDeclaredCents === 0
  )

  // Calculate tip-outs from tipped employees
  const tipOutPool: Record<string, number> = {} // role -> total tipout cents

  for (const emp of tippedEmployees) {
    totalCardTips += emp.cardTipsCents
    totalCashTips += emp.cashTipsDeclaredCents

    let processingFee = 0
    if (config.deductProcessingFee) {
      processingFee = Math.round(emp.cardTipsCents * (config.processingFeePct / 100))
    }
    totalFees += processingFee

    let totalTipOut = 0
    const tipOutDetails: string[] = []

    // Calculate tip-out based on net sales
    for (const [role, pct] of Object.entries(config.tipoutPercentages)) {
      if (pct > 0) {
        const tipout = Math.round(emp.netSalesCents * (pct / 100))
        tipOutPool[role] = (tipOutPool[role] ?? 0) + tipout
        totalTipOut += tipout
        tipOutDetails.push(`${role}: ${pct}% of $${(emp.netSalesCents / 100).toFixed(2)} = $${(tipout / 100).toFixed(2)}`)
      }
    }

    const netTips = emp.cardTipsCents - processingFee + emp.cashTipsDeclaredCents - totalTipOut

    distributions.push({
      userId: emp.userId,
      name: emp.name,
      role: emp.role,
      cardTipsCents: emp.cardTipsCents,
      cashTipsDeclaredCents: emp.cashTipsDeclaredCents,
      poolShareCents: 0,
      tipOutGivenCents: totalTipOut,
      tipOutReceivedCents: 0,
      processingFeeDeductedCents: processingFee,
      netTipsCents: netTips,
      breakdown: `Tip-out: ${tipOutDetails.join(', ')}`,
    })
  }

  // Distribute tip-outs to support staff proportionally by hours worked within each role
  for (const emp of supportEmployees) {
    const roleTipOut = tipOutPool[emp.role] ?? 0
    const roleHours = supportEmployees
      .filter((e) => e.role === emp.role)
      .reduce((s, e) => s + e.hoursWorked, 0)

    const share = roleHours > 0 ? Math.round(roleTipOut * (emp.hoursWorked / roleHours)) : 0

    distributions.push({
      userId: emp.userId,
      name: emp.name,
      role: emp.role,
      cardTipsCents: 0,
      cashTipsDeclaredCents: emp.cashTipsDeclaredCents,
      poolShareCents: 0,
      tipOutGivenCents: 0,
      tipOutReceivedCents: share,
      processingFeeDeductedCents: 0,
      netTipsCents: share + emp.cashTipsDeclaredCents,
      breakdown: `Receives ${emp.role} tip-out: $${(share / 100).toFixed(2)} (${emp.hoursWorked.toFixed(1)}h of ${roleHours.toFixed(1)}h total)`,
    })
  }

  const totalHours = employees.reduce((s, e) => s + e.hoursWorked, 0)

  return {
    totalCardTipsCents: totalCardTips,
    totalCashTipsDeclaredCents: totalCashTips,
    totalProcessingFeesCents: totalFees,
    totalPoolAmountCents: Object.values(tipOutPool).reduce((s, v) => s + v, 0),
    tipsPerLaborHour: totalHours > 0 ? (totalCardTips + totalCashTips - totalFees) / totalHours / 100 : 0,
    distributions,
  }
}

// ---------------------------------------------------------------------------
// Model 3: Pool by Hours
// ---------------------------------------------------------------------------

function calculatePoolByHours(
  employees: EmployeeTipData[],
  config: TipPoolConfig
): TipPoolSummary {
  let totalCardTips = 0
  let totalCashTips = 0
  let totalFees = 0

  // Sum all tips
  for (const emp of employees) {
    totalCardTips += emp.cardTipsCents
    totalCashTips += emp.cashTipsDeclaredCents
  }

  // Deduct processing fees
  if (config.deductProcessingFee) {
    totalFees = Math.round(totalCardTips * (config.processingFeePct / 100))
  }

  const poolTotal = totalCardTips - totalFees + totalCashTips

  // Eligible employees
  const eligible = employees.filter((e) => isEligibleForPool(e.role, config.eligibleRoles))
  const totalEligibleHours = eligible.reduce((s, e) => s + e.hoursWorked, 0)

  const distributions: TipDistributionResult[] = employees.map((emp) => {
    const isInPool = isEligibleForPool(emp.role, config.eligibleRoles)
    const share =
      isInPool && totalEligibleHours > 0
        ? Math.round(poolTotal * (emp.hoursWorked / totalEligibleHours))
        : 0

    return {
      userId: emp.userId,
      name: emp.name,
      role: emp.role,
      cardTipsCents: emp.cardTipsCents,
      cashTipsDeclaredCents: emp.cashTipsDeclaredCents,
      poolShareCents: share,
      tipOutGivenCents: isInPool ? emp.cardTipsCents + emp.cashTipsDeclaredCents : 0,
      tipOutReceivedCents: 0,
      processingFeeDeductedCents: isInPool ? Math.round(emp.cardTipsCents * (config.processingFeePct / 100)) : 0,
      netTipsCents: isInPool ? share : emp.cardTipsCents + emp.cashTipsDeclaredCents,
      breakdown: isInPool
        ? `Pool share: ${emp.hoursWorked.toFixed(1)}h / ${totalEligibleHours.toFixed(1)}h = $${(share / 100).toFixed(2)}`
        : 'Not eligible for pool',
    }
  })

  return {
    totalCardTipsCents: totalCardTips,
    totalCashTipsDeclaredCents: totalCashTips,
    totalProcessingFeesCents: totalFees,
    totalPoolAmountCents: poolTotal,
    tipsPerLaborHour: totalEligibleHours > 0 ? poolTotal / totalEligibleHours / 100 : 0,
    distributions,
  }
}

// ---------------------------------------------------------------------------
// Model 4: Hybrid (Points)
// ---------------------------------------------------------------------------

function calculateHybridPoints(
  employees: EmployeeTipData[],
  config: TipPoolConfig
): TipPoolSummary {
  let totalCardTips = 0
  let totalCashTips = 0
  let totalFees = 0

  for (const emp of employees) {
    totalCardTips += emp.cardTipsCents
    totalCashTips += emp.cashTipsDeclaredCents
  }

  if (config.deductProcessingFee) {
    totalFees = Math.round(totalCardTips * (config.processingFeePct / 100))
  }

  const poolTotal = totalCardTips - totalFees + totalCashTips

  // Calculate weighted points for each eligible employee
  const eligible = employees.filter((e) => isEligibleForPool(e.role, config.eligibleRoles))
  const employeePoints = eligible.map((emp) => {
    const pointValue = config.pointValues[emp.role] ?? 1
    return {
      userId: emp.userId,
      points: pointValue * emp.hoursWorked,
    }
  })

  const totalPoints = employeePoints.reduce((s, e) => s + e.points, 0)
  const pointsMap = new Map(employeePoints.map((e) => [e.userId, e.points]))

  const distributions: TipDistributionResult[] = employees.map((emp) => {
    const isInPool = isEligibleForPool(emp.role, config.eligibleRoles)
    const empPoints = pointsMap.get(emp.userId) ?? 0
    const share =
      isInPool && totalPoints > 0
        ? Math.round(poolTotal * (empPoints / totalPoints))
        : 0

    const pointValue = config.pointValues[emp.role] ?? 1

    return {
      userId: emp.userId,
      name: emp.name,
      role: emp.role,
      cardTipsCents: emp.cardTipsCents,
      cashTipsDeclaredCents: emp.cashTipsDeclaredCents,
      poolShareCents: share,
      tipOutGivenCents: isInPool ? emp.cardTipsCents + emp.cashTipsDeclaredCents : 0,
      tipOutReceivedCents: 0,
      processingFeeDeductedCents: isInPool ? Math.round(emp.cardTipsCents * (config.processingFeePct / 100)) : 0,
      netTipsCents: isInPool ? share : emp.cardTipsCents + emp.cashTipsDeclaredCents,
      breakdown: isInPool
        ? `Hybrid: ${pointValue} pts x ${emp.hoursWorked.toFixed(1)}h = ${empPoints.toFixed(1)} pts / ${totalPoints.toFixed(1)} total = $${(share / 100).toFixed(2)}`
        : 'Not eligible for pool',
    }
  })

  return {
    totalCardTipsCents: totalCardTips,
    totalCashTipsDeclaredCents: totalCashTips,
    totalProcessingFeesCents: totalFees,
    totalPoolAmountCents: poolTotal,
    tipsPerLaborHour: eligible.reduce((s, e) => s + e.hoursWorked, 0) > 0
      ? poolTotal / eligible.reduce((s, e) => s + e.hoursWorked, 0) / 100
      : 0,
    distributions,
  }
}

// ---------------------------------------------------------------------------
// Main: calculate tip distribution
// ---------------------------------------------------------------------------

export function calculateTipDistribution(
  employees: EmployeeTipData[],
  config: TipPoolConfig
): TipPoolSummary {
  switch (config.model) {
    case 'direct':
      return calculateDirect(employees, config)
    case 'tipout_sales':
      return calculateTipoutBySales(employees, config)
    case 'pool_hours':
      return calculatePoolByHours(employees, config)
    case 'hybrid_points':
      return calculateHybridPoints(employees, config)
    default:
      return calculateDirect(employees, config)
  }
}

// ---------------------------------------------------------------------------
// Default config
// ---------------------------------------------------------------------------

export function getDefaultTipPoolConfig(): TipPoolConfig {
  return {
    model: 'direct',
    tipoutPercentages: {
      busser: 3,
      bar: 1,
      runner: 1,
    },
    pointValues: {
      server: 10,
      bartender: 8,
      busser: 5,
      runner: 3,
      host: 2,
    },
    eligibleRoles: ['server', 'bartender', 'host', 'busser', 'runner', 'cashier'],
    includeBoh: false,
    deductProcessingFee: false,
    processingFeePct: 2.49,
  }
}
