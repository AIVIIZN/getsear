/**
 * Server Checkout Calculator
 *
 * Calculates end-of-shift checkout report:
 * - Net sales, total checks, avg check, guest count
 * - Card tips, auto-gratuity, cash declared, tip-out owed/received, net tips
 * - Cash owed to house: starting_cash + cash_sales - cash_tips_kept - tip_out_paid_cash
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ServerCheckoutInput {
  /** Employee's time entry for the shift */
  timeEntry: {
    id: string
    clockIn: string
    clockOut: string | null
    regularHours: number
    overtimeHours: number
    hourlyRateCents: number
  }
  /** Orders closed by this server during the shift */
  orders: {
    orderId: string
    subtotalCents: number
    taxCents: number
    totalCents: number
    guestCount: number
    paymentMethod: string
    tipCents: number
    autoGratuityCents: number
    cashReceivedCents: number
  }[]
  /** Tip pool config for tip-out calculations */
  tipOutOwedCents: number
  tipOutReceivedCents: number
  /** Cash tips declared by the server */
  cashTipsDeclaredCents: number
  /** Starting cash in the drawer */
  startingCashCents: number
}

export interface ServerCheckoutResult {
  // Sales Summary
  netSalesCents: number
  totalChecks: number
  avgCheckCents: number
  guestCount: number
  avgPerGuestCents: number

  // Tip Summary
  cardTipsCents: number
  autoGratuityCents: number
  cashTipsDeclaredCents: number
  tipOutOwedCents: number
  tipOutReceivedCents: number
  netTipsCents: number

  // Cash Owed
  startingCashCents: number
  cashSalesReceivedCents: number
  cashTipsKeptCents: number
  tipOutPaidCashCents: number
  cashOwedToHouseCents: number

  // Labor
  hoursWorked: number
  laborCostCents: number
  salesPerLaborHour: number
  tipsPerHour: number
}

// ---------------------------------------------------------------------------
// Calculate
// ---------------------------------------------------------------------------

export function calculateServerCheckout(
  input: ServerCheckoutInput
): ServerCheckoutResult {
  const { orders, tipOutOwedCents, tipOutReceivedCents, cashTipsDeclaredCents, startingCashCents } = input
  const { regularHours, overtimeHours, hourlyRateCents } = input.timeEntry

  // Sales Summary
  const netSalesCents = orders.reduce((s, o) => s + o.subtotalCents, 0)
  const totalChecks = orders.length
  const avgCheckCents = totalChecks > 0 ? Math.round(netSalesCents / totalChecks) : 0
  const guestCount = orders.reduce((s, o) => s + o.guestCount, 0)
  const avgPerGuestCents = guestCount > 0 ? Math.round(netSalesCents / guestCount) : 0

  // Tip Summary
  const cardTipsCents = orders.reduce((s, o) => s + o.tipCents, 0)
  const autoGratuityCents = orders.reduce((s, o) => s + o.autoGratuityCents, 0)
  const netTipsCents =
    cardTipsCents + autoGratuityCents + cashTipsDeclaredCents - tipOutOwedCents + tipOutReceivedCents

  // Cash Owed
  const cashSalesReceivedCents = orders
    .filter((o) => o.paymentMethod === 'cash')
    .reduce((s, o) => s + o.cashReceivedCents, 0)

  const cashTipsKeptCents = cashTipsDeclaredCents
  const tipOutPaidCashCents = tipOutOwedCents // Tip-out assumed paid in cash

  // Formula: starting_cash + cash_sales_received - cash_tips_kept - tip_out_paid_cash = cash_due_to_house
  const cashOwedToHouseCents =
    startingCashCents + cashSalesReceivedCents - cashTipsKeptCents - tipOutPaidCashCents

  // Labor
  const hoursWorked = regularHours + overtimeHours
  const laborCostCents = Math.round(
    regularHours * hourlyRateCents + overtimeHours * hourlyRateCents * 1.5
  )
  const salesPerLaborHour = hoursWorked > 0 ? netSalesCents / 100 / hoursWorked : 0
  const tipsPerHour = hoursWorked > 0 ? netTipsCents / 100 / hoursWorked : 0

  return {
    netSalesCents,
    totalChecks,
    avgCheckCents,
    guestCount,
    avgPerGuestCents,
    cardTipsCents,
    autoGratuityCents,
    cashTipsDeclaredCents,
    tipOutOwedCents,
    tipOutReceivedCents,
    netTipsCents,
    startingCashCents,
    cashSalesReceivedCents,
    cashTipsKeptCents,
    tipOutPaidCashCents,
    cashOwedToHouseCents,
    hoursWorked,
    laborCostCents,
    salesPerLaborHour,
    tipsPerHour,
  }
}
