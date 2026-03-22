/**
 * Mock Valor PayTech client for development.
 * Simulates card authorization, capture, void, and refund
 * with realistic delays and response shapes.
 *
 * In production, this is replaced by the real Valor Connect
 * (MQTT) + REST integration. Card data never touches Sear servers.
 */

export interface ValorAuthRequest {
  amount_cents: number
  terminal_id?: string
  order_id: string
}

export interface ValorAuthResponse {
  success: boolean
  transaction_id: string
  auth_code: string
  card_last_four: string
  card_brand: 'visa' | 'mastercard' | 'amex' | 'discover'
  decline_reason?: string
}

export interface ValorCaptureRequest {
  transaction_id: string
  amount_cents: number
  tip_cents: number
}

export interface ValorCaptureResponse {
  success: boolean
  transaction_id: string
  captured_amount_cents: number
}

export interface ValorVoidRequest {
  transaction_id: string
}

export interface ValorVoidResponse {
  success: boolean
  transaction_id: string
}

export interface ValorRefundRequest {
  transaction_id: string
  amount_cents: number
}

export interface ValorRefundResponse {
  success: boolean
  transaction_id: string
  refund_amount_cents: number
}

const CARD_BRANDS = ['visa', 'mastercard', 'amex', 'discover'] as const
const LAST_FOURS = ['4242', '1234', '5678', '9012', '3456', '7890']

function randomFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateTransactionId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `VLR-${timestamp}-${random}`
}

function generateAuthCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Mock Valor client. All methods simulate network delays of 1-2 seconds.
 * ~95% approval rate for realism. Amounts ending in 66 cents always decline.
 */
export const valorMock = {
  async authorize(req: ValorAuthRequest): Promise<ValorAuthResponse> {
    // Simulate terminal interaction delay (1-2s)
    await delay(1200 + Math.random() * 800)

    // Decline logic: amounts ending in 66 cents always decline
    const shouldDecline = req.amount_cents % 100 === 66 || Math.random() < 0.05

    if (shouldDecline) {
      return {
        success: false,
        transaction_id: generateTransactionId(),
        auth_code: '',
        card_last_four: randomFrom(LAST_FOURS),
        card_brand: randomFrom(CARD_BRANDS),
        decline_reason: 'Insufficient funds',
      }
    }

    return {
      success: true,
      transaction_id: generateTransactionId(),
      auth_code: generateAuthCode(),
      card_last_four: randomFrom(LAST_FOURS),
      card_brand: randomFrom(CARD_BRANDS),
    }
  },

  async capture(req: ValorCaptureRequest): Promise<ValorCaptureResponse> {
    await delay(800 + Math.random() * 400)

    return {
      success: true,
      transaction_id: req.transaction_id,
      captured_amount_cents: req.amount_cents + req.tip_cents,
    }
  },

  async void(req: ValorVoidRequest): Promise<ValorVoidResponse> {
    await delay(600 + Math.random() * 400)

    return {
      success: true,
      transaction_id: req.transaction_id,
    }
  },

  async refund(req: ValorRefundRequest): Promise<ValorRefundResponse> {
    await delay(1000 + Math.random() * 500)

    return {
      success: true,
      transaction_id: req.transaction_id,
      refund_amount_cents: req.amount_cents,
    }
  },

  async preauth(req: ValorAuthRequest): Promise<ValorAuthResponse> {
    // Pre-auth is same as auth but holds the amount
    return this.authorize(req)
  },
}
