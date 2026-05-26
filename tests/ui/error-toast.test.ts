import { describe, expect, it } from 'vitest'

import { normalizeErrorForToast } from '@/components/ui-v2/feedback/ErrorToast'

describe('V8.2 UI error toast normalization', () => {
  it('turns network failures into a retry action', () => {
    expect(normalizeErrorForToast(new TypeError('fetch failed'))).toEqual({
      code: 'NETWORK',
      message: 'Sear could not reach the server.',
      action: 'Try again.',
    })
  })

  it('keeps API-provided human message and action', () => {
    expect(
      normalizeErrorForToast({
        code: 'FORBIDDEN',
        message: 'Only managers can comp an item.',
        action: 'Ask a manager to grant access.',
      }),
    ).toEqual({
      code: 'FORBIDDEN',
      message: 'Only managers can comp an item.',
      action: 'Ask a manager to grant access.',
    })
  })

  it('adds safe defaults for legacy error objects', () => {
    expect(normalizeErrorForToast({ error: 'Payment failed' })).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Payment failed',
      action: "Try again. If it still fails, contact support.",
    })
  })
})
