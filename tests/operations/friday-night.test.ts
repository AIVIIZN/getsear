import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mockDb,
}))

type QueryResult = { data: unknown[] }

let queryResults: Record<string, QueryResult>

function makeQuery(table: string) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    gte: vi.fn(() => query),
    in: vi.fn(() => query),
    is: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    then: (resolve: (value: QueryResult) => void) => resolve(queryResults[table] ?? { data: [] }),
  }
  return query
}

const mockDb = {
  from: vi.fn((table: string) => makeQuery(table)),
}

describe('getFridayNightData', () => {
  it('summarizes sales, labor, hardware, payments, KDS stress, and dispatch queue', async () => {
    const now = new Date()
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString()
    const twoHoursAgo = new Date(now.getTime() - 120 * 60 * 1000).toISOString()

    queryResults = {
      orders: {
        data: [
          {
            id: 'order-1',
            display_number: '101',
            total: 400,
            discount_total: 25,
            status: 'closed',
            created_at: twoHoursAgo,
            opened_at: twoHoursAgo,
            voided_at: null,
          },
          {
            id: 'order-2',
            display_number: '102',
            total: 200,
            discount_total: 0,
            status: 'voided',
            created_at: twoHoursAgo,
            opened_at: twoHoursAgo,
            voided_at: twoHoursAgo,
          },
        ],
      },
      payments: {
        data: [
          { id: 'payment-1', status: 'failed', total_amount: 88, created_at: now.toISOString() },
        ],
      },
      terminals: {
        data: [
          { id: 'terminal-1', name: 'Bar iPad', is_online: false, is_active: true, last_heartbeat_at: thirtyMinutesAgo },
        ],
      },
      print_queue: {
        data: [
          { id: 'print-1', job_type: 'kitchen', status: 'failed', attempts: 3, error_message: 'Printer offline', created_at: now.toISOString() },
        ],
      },
      time_entries: {
        data: [
          { id: 'time-1', clock_in: twoHoursAgo, hourly_rate: 20 },
        ],
      },
    }

    const { getFridayNightData } = await import('@/lib/operations/friday-night')
    const data = await getFridayNightData('org-1')

    expect(data.live_sales.value).toBe('$400')
    expect(data.labor.value).toBe('10.0%')
    expect(data.offline_terminals.severity).toBe('watch')
    expect(data.payment_failures.value).toBe('1')
    expect(data.printer_failures.value).toBe('1')
    expect(data.needs_help_now.map((alert) => alert.id)).toContain('payments-failed')
    expect(data.needs_help_now.map((alert) => alert.id)).toContain('printers-failed')
    expect(data.needs_help_now.map((alert) => alert.id)).toContain('terminal-terminal-1')
  })
})
