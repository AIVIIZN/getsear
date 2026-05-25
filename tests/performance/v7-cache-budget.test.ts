import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { cacheTags, orderCacheTags } from '@/lib/cache/keys'

describe('V7.2 performance contracts', () => {
  it('uses org-scoped cache tags for order SWR reads and mutations', () => {
    expect(cacheTags.orders('org-a')).toBe('orders:org-a')
    expect(cacheTags.activeOrders('org-a')).toBe('orders-active:org-a')
    expect(cacheTags.order('org-a', 'order-1')).toBe('order:org-a:order-1')
    expect(orderCacheTags('org-a', 'order-1')).toEqual([
      'orders:org-a',
      'orders-active:org-a',
      'order:org-a:order-1',
    ])
  })

  it('keeps the bundle budget script pointed at POS route entrypoints', () => {
    const script = readFileSync('scripts/check-bundle-budget.mjs', 'utf8')

    expect(script).toContain('/(pos)/orders/page')
    expect(script).toContain('POS_FIRST_LOAD_BUDGET_KB ?? 200')
  })
})
