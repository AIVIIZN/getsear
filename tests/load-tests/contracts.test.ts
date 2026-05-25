import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('CORE-3 load-test API contracts', () => {
  const fullShift = read('load-tests/full-shift.js')
  const chaos = read('load-tests/chaos.js')
  const addItemRoute = read('src/app/api/orders/[id]/items/route.ts')
  const kdsTicketsRoute = read('src/app/api/kds/tickets/route.ts')
  const paymentRoute = read('src/app/api/payments/process/route.ts')

  it('posts the current order-item payload shape used by the route handler', () => {
    expect(addItemRoute).toContain('unit_price')
    expect(addItemRoute).toContain('price_adjustment')

    for (const script of [fullShift, chaos]) {
      expect(script).toContain("`${BASE_URL}/api/orders/${orderId}/items`")
      expect(script).toContain('menu_item_id')
      expect(script).toContain('name:')
      expect(script).toContain('unit_price')
      expect(script).toContain('modifiers')
      expect(script).not.toContain('price_cents')
    }
  })

  it('uses the current cash payment contract and success status', () => {
    expect(paymentRoute).toContain("payment_method: z.enum")
    expect(paymentRoute).toContain("'cash'")
    expect(paymentRoute).toContain('{ status: 201 }')

    for (const script of [fullShift, chaos]) {
      expect(script).toContain('/api/payments/process')
      expect(script).toContain("payment_method: 'cash'")
      expect(script).toContain('cash_tendered_cents')
      expect(script.includes('status === 201') || script.includes('status !== 201')).toBe(true)
      expect(script).not.toContain("payment_method: 'card'")
    }
  })

  it('discovers KDS stations and refuses to pass with idle KDS VUs', () => {
    expect(kdsTicketsRoute).toContain('station_id is required')

    for (const script of [fullShift, chaos]) {
      expect(script).toContain('/api/kds/stations?location_id=')
      expect(script).toContain('/api/kds/tickets?station_id=')
      expect(script).toContain('kdsStationIds.length === 0')
      expect(script).toContain('Refusing to idle KDS VUs')
    }
  })

  it('does not keep runnable stale legacy load scripts around', () => {
    expect(read('src/scripts/load-tests/dinner-rush.ts')).toContain('is retired')
    expect(read('src/scripts/load-tests/stress-test.ts')).toContain('is retired')
  })
})
