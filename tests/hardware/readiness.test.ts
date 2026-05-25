import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mockDb,
}))

type QueryResult = { data: unknown[]; error?: { code?: string } | null }

let queryResults: Record<string, QueryResult>

function makeQuery(table: string) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    single: vi.fn(() => query),
    then: (resolve: (value: QueryResult) => void) =>
      resolve(queryResults[table] ?? { data: [] }),
  }
  return query
}

const mockDb = {
  from: vi.fn((table: string) => makeQuery(table)),
}

describe('getHardwareReadiness', () => {
  it('issues a service-ready certificate when required devices are ready', async () => {
    queryResults = {
      printers: {
        data: [
          {
            id: 'printer-receipt',
            name: 'Front receipt',
            role: 'receipt',
            status: 'online',
            is_active: true,
            cash_drawer_enabled: true,
          },
          {
            id: 'printer-kitchen',
            name: 'Hot line',
            role: 'kitchen',
            status: 'online',
            is_active: true,
            cash_drawer_enabled: false,
          },
        ],
      },
      payment_terminals: {
        data: [
          {
            id: 'terminal-1',
            name: 'Counter VP800',
            device_class: 'valor-vp800',
            status: 'registered',
            last_seen_at: new Date().toISOString(),
          },
        ],
      },
    }

    const { getHardwareReadiness } = await import('@/lib/hardware/readiness')
    const data = await getHardwareReadiness('org-1')

    expect(data.service_ready).toBe(true)
    expect(data.ready_count).toBe(4)
    expect(data.certificate.issued_at).toBeTruthy()
    expect(data.certificate.blockers).toEqual([])
  })

  it('reports missing hardware blockers without fabricating ready checks', async () => {
    queryResults = {
      printers: {
        data: [
          {
            id: 'printer-receipt',
            name: 'Front receipt',
            role: 'receipt',
            status: 'offline',
            is_active: true,
            cash_drawer_enabled: false,
          },
        ],
      },
      payment_terminals: { data: [] },
    }

    const { getHardwareReadiness } = await import('@/lib/hardware/readiness')
    const data = await getHardwareReadiness('org-1')

    expect(data.service_ready).toBe(false)
    expect(data.ready_count).toBe(0)
    expect(data.certificate.issued_at).toBeNull()
    expect(data.certificate.blockers).toContain('Kitchen or bar printer')
    expect(data.certificate.blockers).toContain('Payment terminal')
  })
})
