import { createAdminClient } from '@/lib/supabase/admin'

export type HardwareReadinessStatus = 'ready' | 'attention' | 'missing'

export interface HardwareReadinessItem {
  id: 'receipt_printer' | 'kitchen_printer' | 'cash_drawer' | 'payment_terminal'
  label: string
  status: HardwareReadinessStatus
  detail: string
  action: string
  deviceId: string | null
}

export interface HardwareReadinessData {
  updated_at: string
  service_ready: boolean
  ready_count: number
  total_count: number
  printers: {
    total: number
    online: number
    receipt: number
    kitchen: number
    cash_drawer_enabled: number
  }
  payment_terminals: {
    total: number
    ready: number
    sandbox: boolean
  }
  checklist: HardwareReadinessItem[]
  certificate: {
    title: string
    issued_at: string | null
    summary: string
    blockers: string[]
  }
}

type PrinterRow = {
  id: string
  name: string
  role: string
  status: string | null
  is_active: boolean | null
  cash_drawer_enabled: boolean | null
}

type PaymentTerminalRow = {
  id: string
  name: string | null
  device_class: string | null
  status: string | null
  last_seen_at: string | null
}

const PAYMENT_TERMINALS_UNAVAILABLE = '42P01'

function item(
  id: HardwareReadinessItem['id'],
  label: string,
  status: HardwareReadinessStatus,
  detail: string,
  action: string,
  deviceId: string | null
): HardwareReadinessItem {
  return { id, label, status, detail, action, deviceId }
}

function isPrinterOnline(printer: PrinterRow): boolean {
  return printer.is_active !== false && printer.status === 'online'
}

function terminalReady(terminal: PaymentTerminalRow): boolean {
  return ['registered', 'online', 'ready', 'active'].includes(terminal.status ?? '')
}

export async function getHardwareReadiness(
  orgId: string,
  locationId?: string
): Promise<HardwareReadinessData> {
  const db = createAdminClient()

  let printersQuery = db
    .from('printers')
    .select('id, name, role, status, is_active, cash_drawer_enabled')
    .eq('org_id', orgId)

  if (locationId) {
    printersQuery = printersQuery.eq('location_id', locationId)
  }

  const [{ data: printerData }, terminalResult] = await Promise.all([
    printersQuery,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db.from('payment_terminals') as any)
      .select('id, name, device_class, status, last_seen_at')
      .eq('org_id', orgId),
  ])

  const printers = (printerData ?? []) as PrinterRow[]
  const terminalsError = terminalResult.error as { code?: string } | null | undefined
  const terminals = terminalsError?.code === PAYMENT_TERMINALS_UNAVAILABLE
    ? []
    : ((terminalResult.data ?? []) as PaymentTerminalRow[])

  const receiptPrinter = printers.find((printer) => printer.role === 'receipt')
  const kitchenPrinter = printers.find((printer) => ['kitchen', 'expo', 'bar'].includes(printer.role))
  const drawerPrinter = printers.find((printer) => printer.cash_drawer_enabled)
  const readyTerminal = terminals.find(terminalReady)

  const checklist: HardwareReadinessItem[] = [
    receiptPrinter
      ? item(
          'receipt_printer',
          'Receipt printer',
          isPrinterOnline(receiptPrinter) ? 'ready' : 'attention',
          `${receiptPrinter.name} is configured${isPrinterOnline(receiptPrinter) ? ' and online' : ' but needs a successful test print'}.`,
          'Run test print',
          receiptPrinter.id
        )
      : item(
          'receipt_printer',
          'Receipt printer',
          'missing',
          'No receipt printer is configured for customer receipts.',
          'Add receipt printer',
          null
        ),
    kitchenPrinter
      ? item(
          'kitchen_printer',
          'Kitchen or bar printer',
          isPrinterOnline(kitchenPrinter) ? 'ready' : 'attention',
          `${kitchenPrinter.name} is configured${isPrinterOnline(kitchenPrinter) ? ' and online' : ' but needs a successful test print'}.`,
          'Run test print',
          kitchenPrinter.id
        )
      : item(
          'kitchen_printer',
          'Kitchen or bar printer',
          'missing',
          'No kitchen, bar, or expo printer is configured for service tickets.',
          'Add kitchen printer',
          null
        ),
    drawerPrinter
      ? item(
          'cash_drawer',
          'Cash drawer kick',
          isPrinterOnline(drawerPrinter) ? 'ready' : 'attention',
          `${drawerPrinter.name} has cash drawer kick enabled${isPrinterOnline(drawerPrinter) ? '' : ', but its printer is not online'}.`,
          'Kick drawer',
          drawerPrinter.id
        )
      : item(
          'cash_drawer',
          'Cash drawer kick',
          'missing',
          'No configured printer has cash drawer kick enabled.',
          'Enable drawer',
          null
        ),
    readyTerminal
      ? item(
          'payment_terminal',
          'Payment terminal',
          'ready',
          `${readyTerminal.name ?? readyTerminal.device_class ?? 'Payment terminal'} is registered for card tests.`,
          'Run payment test',
          readyTerminal.id
        )
      : item(
          'payment_terminal',
          'Payment terminal',
          terminals.length > 0 ? 'attention' : 'missing',
          terminals.length > 0
            ? 'A terminal exists but is not registered as ready.'
            : 'No Valor payment terminal is registered.',
          terminals.length > 0 ? 'Review terminal' : 'Register terminal',
          terminals[0]?.id ?? null
        ),
  ]

  const readyCount = checklist.filter((entry) => entry.status === 'ready').length
  const blockers = checklist
    .filter((entry) => entry.status !== 'ready')
    .map((entry) => entry.label)
  const serviceReady = blockers.length === 0
  const now = new Date().toISOString()

  return {
    updated_at: now,
    service_ready: serviceReady,
    ready_count: readyCount,
    total_count: checklist.length,
    printers: {
      total: printers.length,
      online: printers.filter(isPrinterOnline).length,
      receipt: printers.filter((printer) => printer.role === 'receipt').length,
      kitchen: printers.filter((printer) => ['kitchen', 'expo', 'bar'].includes(printer.role)).length,
      cash_drawer_enabled: printers.filter((printer) => printer.cash_drawer_enabled).length,
    },
    payment_terminals: {
      total: terminals.length,
      ready: terminals.filter(terminalReady).length,
      sandbox: process.env.VALOR_ENVIRONMENT !== 'production',
    },
    checklist,
    certificate: {
      title: serviceReady ? 'Service-ready certificate' : 'Service readiness pending',
      issued_at: serviceReady ? now : null,
      summary: serviceReady
        ? 'Receipt printing, service ticket printing, drawer kick, and payment terminal checks are ready for service.'
        : `${blockers.length} readiness check${blockers.length === 1 ? '' : 's'} still need attention before service.`,
      blockers,
    },
  }
}
