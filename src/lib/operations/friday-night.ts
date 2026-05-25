import { differenceInMinutes, formatDistanceToNowStrict, startOfDay } from 'date-fns'
import { createAdminClient } from '@/lib/supabase/admin'

export type CockpitSeverity = 'healthy' | 'watch' | 'critical'

export interface FridayNightMetric {
  label: string
  value: string
  detail: string
  severity: CockpitSeverity
}

export interface FridayNightAlert {
  id: string
  title: string
  detail: string
  owner: string
  severity: Exclude<CockpitSeverity, 'healthy'>
  href: string
}

export interface FridayNightData {
  updated_at: string
  live_sales: FridayNightMetric
  labor: FridayNightMetric
  ticket_times: FridayNightMetric
  voids_comps: FridayNightMetric
  offline_terminals: FridayNightMetric
  payment_failures: FridayNightMetric
  printer_failures: FridayNightMetric
  kds_stress: FridayNightMetric
  needs_help_now: FridayNightAlert[]
  service_pulse: Array<{
    id: string
    label: string
    value: string
    severity: CockpitSeverity
  }>
}

type OrderRow = {
  id: string
  display_number: string | null
  total: number | string | null
  discount_total: number | string | null
  status: string
  created_at: string
  opened_at: string | null
  voided_at: string | null
}

type PaymentRow = {
  id: string
  status: string
  total_amount: number | string | null
  created_at: string
}

type TerminalRow = {
  id: string
  name: string
  is_online: boolean
  is_active: boolean
  last_heartbeat_at: string | null
}

type PrintJobRow = {
  id: string
  job_type: string
  status: string | null
  attempts: number | null
  error_message: string | null
  created_at: string | null
}

type TimeEntryRow = {
  id: string
  clock_in: string
  hourly_rate: number | string | null
}

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

function toNumber(value: number | string | null | undefined): number {
  return Number(value) || 0
}

function pct(value: number): string {
  return `${value.toFixed(1)}%`
}

function severityForCount(count: number, watchAt: number, criticalAt: number): CockpitSeverity {
  if (count >= criticalAt) return 'critical'
  if (count >= watchAt) return 'watch'
  return 'healthy'
}

function severityForPct(value: number, watchAt: number, criticalAt: number): CockpitSeverity {
  if (value >= criticalAt) return 'critical'
  if (value >= watchAt) return 'watch'
  return 'healthy'
}

function shiftCost(entries: TimeEntryRow[], now: Date): number {
  return entries.reduce((total, entry) => {
    const minutes = Math.max(0, differenceInMinutes(now, new Date(entry.clock_in)))
    const rate = toNumber(entry.hourly_rate) || 18
    return total + (minutes / 60) * rate
  }, 0)
}

export async function getFridayNightData(
  orgId: string,
  locationId?: string
): Promise<FridayNightData> {
  const db = createAdminClient()
  const now = new Date()
  const todayIso = startOfDay(now).toISOString()

  let ordersQuery = db
    .from('orders')
    .select('id, display_number, total, discount_total, status, created_at, opened_at, voided_at')
    .eq('org_id', orgId)
    .gte('created_at', todayIso)

  let activeOrdersQuery = db
    .from('orders')
    .select('id, display_number, status, created_at, opened_at')
    .eq('org_id', orgId)
    .in('status', ['open', 'fired', 'ready'])

  let paymentsQuery = db
    .from('payments')
    .select('id, status, total_amount, created_at')
    .eq('org_id', orgId)
    .gte('created_at', todayIso)

  let terminalsQuery = db
    .from('terminals')
    .select('id, name, is_online, is_active, last_heartbeat_at')
    .eq('org_id', orgId)
    .eq('is_active', true)

  let timeEntriesQuery = db
    .from('time_entries')
    .select('id, clock_in, hourly_rate')
    .eq('org_id', orgId)
    .is('clock_out', null)

  if (locationId) {
    ordersQuery = ordersQuery.eq('location_id', locationId)
    activeOrdersQuery = activeOrdersQuery.eq('location_id', locationId)
    paymentsQuery = paymentsQuery.eq('location_id', locationId)
    terminalsQuery = terminalsQuery.eq('location_id', locationId)
    timeEntriesQuery = timeEntriesQuery.eq('location_id', locationId)
  }

  const [
    { data: ordersData },
    { data: activeOrdersData },
    { data: paymentsData },
    { data: terminalsData },
    { data: printJobsData },
    { data: timeEntriesData },
  ] = await Promise.all([
    ordersQuery,
    activeOrdersQuery,
    paymentsQuery,
    terminalsQuery,
    db
      .from('print_queue')
      .select('id, job_type, status, attempts, error_message, created_at')
      .eq('org_id', orgId)
      .gte('created_at', todayIso)
      .order('created_at', { ascending: false })
      .limit(100),
    timeEntriesQuery,
  ])

  const orders = (ordersData ?? []) as OrderRow[]
  const activeOrders = (activeOrdersData ?? []) as OrderRow[]
  const payments = (paymentsData ?? []) as PaymentRow[]
  const terminals = (terminalsData ?? []) as TerminalRow[]
  const printJobs = (printJobsData ?? []) as PrintJobRow[]
  const timeEntries = (timeEntriesData ?? []) as TimeEntryRow[]

  const closedSales = orders
    .filter((order) => ['closed', 'served', 'ready', 'open', 'fired'].includes(order.status))
    .reduce((sum, order) => sum + toNumber(order.total), 0)
  const laborCost = shiftCost(timeEntries, now)
  const laborPct = closedSales > 0 ? (laborCost / closedSales) * 100 : 0
  const ages = activeOrders.map((order) => {
    const openedAt = order.opened_at ?? order.created_at
    return Math.max(0, differenceInMinutes(now, new Date(openedAt)))
  })
  const avgTicketMinutes = ages.length
    ? ages.reduce((sum, age) => sum + age, 0) / ages.length
    : 0
  const lateTickets = activeOrders.filter((_, index) => ages[index] >= 18)
  const voidedOrders = orders.filter((order) => order.status === 'voided' || order.voided_at)
  const compDiscountTotal = orders.reduce((sum, order) => sum + toNumber(order.discount_total), 0)
  const failedPayments = payments.filter((payment) =>
    ['declined', 'failed', 'voided'].includes(payment.status)
  )
  const failedPaymentDollars = failedPayments.reduce(
    (sum, payment) => sum + toNumber(payment.total_amount),
    0
  )
  const offlineTerminals = terminals.filter((terminal) => !terminal.is_online)
  const failedPrintJobs = printJobs.filter((job) => job.status === 'failed')
  const retryingPrintJobs = printJobs.filter((job) => job.status === 'queued' && (job.attempts ?? 0) > 0)
  const kdsStressScore = lateTickets.length * 2 + activeOrders.filter((order) => order.status === 'fired').length

  const needsHelpNow: FridayNightAlert[] = []
  const worstTicket = lateTickets[lateTickets.length - 1]
  const worstTicketAge = lateTickets.length ? Math.max(...lateTickets.map((ticket) => {
    const openedAt = ticket.opened_at ?? ticket.created_at
    return differenceInMinutes(now, new Date(openedAt))
  })) : 0

  if (worstTicket) {
    needsHelpNow.push({
      id: `ticket-${worstTicket.id}`,
      title: `Ticket ${worstTicket.display_number ?? 'needs expo'} is ${worstTicketAge}m old`,
      detail: `${lateTickets.length} tickets are past the Friday night target.`,
      owner: 'Expo',
      severity: worstTicketAge >= 30 ? 'critical' : 'watch',
      href: '/kds',
    })
  }

  if (failedPayments.length > 0) {
    needsHelpNow.push({
      id: 'payments-failed',
      title: `${failedPayments.length} payment failures`,
      detail: `${money.format(failedPaymentDollars)} at risk until a manager resolves tenders.`,
      owner: 'Manager',
      severity: failedPayments.length >= 3 ? 'critical' : 'watch',
      href: '/reports/payments',
    })
  }

  if (failedPrintJobs.length > 0 || retryingPrintJobs.length > 0) {
    needsHelpNow.push({
      id: 'printers-failed',
      title: `${failedPrintJobs.length} failed prints, ${retryingPrintJobs.length} retrying`,
      detail: failedPrintJobs[0]?.error_message ?? 'Kitchen or receipt printers need attention.',
      owner: 'Shift lead',
      severity: failedPrintJobs.length >= 2 ? 'critical' : 'watch',
      href: '/settings/printers',
    })
  }

  for (const terminal of offlineTerminals.slice(0, 2)) {
    needsHelpNow.push({
      id: `terminal-${terminal.id}`,
      title: `${terminal.name} is offline`,
      detail: terminal.last_heartbeat_at
        ? `Last heartbeat ${formatDistanceToNowStrict(new Date(terminal.last_heartbeat_at))} ago.`
        : 'No heartbeat has been recorded.',
      owner: 'Floor manager',
      severity: 'critical',
      href: '/settings/terminals',
    })
  }

  return {
    updated_at: now.toISOString(),
    live_sales: {
      label: 'Live sales',
      value: money.format(closedSales),
      detail: `${orders.length} orders today`,
      severity: closedSales > 0 ? 'healthy' : 'watch',
    },
    labor: {
      label: 'Labor',
      value: closedSales > 0 ? pct(laborPct) : 'No sales yet',
      detail: `${timeEntries.length} staff clocked in`,
      severity: closedSales > 0 ? severityForPct(laborPct, 30, 36) : 'watch',
    },
    ticket_times: {
      label: 'Ticket times',
      value: `${Math.round(avgTicketMinutes)}m avg`,
      detail: `${lateTickets.length} late of ${activeOrders.length} active`,
      severity: severityForPct(avgTicketMinutes, 12, 18),
    },
    voids_comps: {
      label: 'Voids and comps',
      value: `${voidedOrders.length} / ${money.format(compDiscountTotal)}`,
      detail: 'Voided orders and discount total today',
      severity: voidedOrders.length >= 3 || compDiscountTotal >= 150 ? 'critical' : voidedOrders.length > 0 || compDiscountTotal > 0 ? 'watch' : 'healthy',
    },
    offline_terminals: {
      label: 'Offline terminals',
      value: String(offlineTerminals.length),
      detail: `${terminals.length} active terminals watched`,
      severity: severityForCount(offlineTerminals.length, 1, 2),
    },
    payment_failures: {
      label: 'Payment failures',
      value: String(failedPayments.length),
      detail: `${money.format(failedPaymentDollars)} failed or declined today`,
      severity: severityForCount(failedPayments.length, 1, 3),
    },
    printer_failures: {
      label: 'Printer failures',
      value: String(failedPrintJobs.length),
      detail: `${retryingPrintJobs.length} queued retries`,
      severity: severityForCount(failedPrintJobs.length, 1, 2),
    },
    kds_stress: {
      label: 'KDS stress',
      value: kdsStressScore >= 10 ? 'High' : kdsStressScore >= 4 ? 'Watch' : 'Calm',
      detail: `${activeOrders.length} active tickets, ${lateTickets.length} late`,
      severity: severityForCount(kdsStressScore, 4, 10),
    },
    needs_help_now: needsHelpNow.slice(0, 6),
    service_pulse: [
      { id: 'floor', label: 'Floor', value: `${activeOrders.length} checks open`, severity: severityForCount(activeOrders.length, 16, 24) },
      { id: 'kitchen', label: 'Kitchen', value: `${lateTickets.length} late`, severity: severityForCount(lateTickets.length, 1, 4) },
      { id: 'payments', label: 'Payments', value: `${failedPayments.length} failed`, severity: severityForCount(failedPayments.length, 1, 3) },
      { id: 'hardware', label: 'Hardware', value: `${offlineTerminals.length + failedPrintJobs.length} issues`, severity: severityForCount(offlineTerminals.length + failedPrintJobs.length, 1, 2) },
    ],
  }
}
