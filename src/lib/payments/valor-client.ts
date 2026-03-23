/**
 * Valor PayTech REST API Client
 *
 * Production client for card payment processing via Valor PayTech.
 * Supports sandbox mode with realistic mock responses for development.
 *
 * Environment variables:
 *   VALOR_API_KEY       — API key for authentication
 *   VALOR_MERCHANT_ID   — Merchant identifier
 *   VALOR_API_URL       — Base URL for Valor REST API
 *   VALOR_ENVIRONMENT   — 'sandbox' | 'production'
 *
 * Card data NEVER touches Sear servers — all PAN handling
 * happens on the Valor terminal via P2PE. We only receive
 * tokens, last-4, and brand from Valor.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown'

export type ValorTransactionStatus =
  | 'approved'
  | 'declined'
  | 'voided'
  | 'captured'
  | 'refunded'
  | 'partially_refunded'
  | 'error'

export type ValorDeclineCode =
  | 'insufficient_funds'
  | 'do_not_honor'
  | 'expired_card'
  | 'invalid_card'
  | 'restricted_card'
  | 'lost_stolen'
  | 'pickup_card'
  | 'transaction_not_allowed'
  | 'processing_error'
  | 'unknown'

export interface ValorAuthRequest {
  amount_cents: number
  order_id: string
  terminal_id?: string
  /** If true, Valor captures immediately (sale = auth + capture). */
  capture?: boolean
  /** External reference for reconciliation */
  reference?: string
}

export interface ValorAuthResponse {
  success: boolean
  transaction_id: string
  auth_code: string
  card_last_four: string
  card_brand: CardBrand
  status: ValorTransactionStatus
  decline_code?: ValorDeclineCode
  decline_reason?: string
  /** Valor's internal reference number */
  rrn?: string
  /** Entry mode: 'emv' | 'contactless' | 'swipe' | 'keyed' */
  entry_mode?: string
  response_code?: string
  captured_amount_cents?: number
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
  response_code?: string
}

export interface ValorVoidRequest {
  transaction_id: string
  reason?: string
}

export interface ValorVoidResponse {
  success: boolean
  transaction_id: string
  response_code?: string
}

export interface ValorRefundRequest {
  transaction_id: string
  amount_cents: number
  reason?: string
}

export interface ValorRefundResponse {
  success: boolean
  transaction_id: string
  refund_amount_cents: number
  response_code?: string
}

export interface ValorBatchSettleRequest {
  /** Optional: settle only transactions from this terminal */
  terminal_id?: string
}

export interface ValorBatchSettleResponse {
  success: boolean
  batch_id: string
  transaction_count: number
  gross_amount_cents: number
  net_amount_cents: number
  settled_at: string
}

export interface ValorQueryRequest {
  transaction_id: string
}

export interface ValorQueryResponse {
  success: boolean
  transaction_id: string
  status: ValorTransactionStatus
  amount_cents: number
  captured_amount_cents: number
  tip_cents: number
  card_last_four: string
  card_brand: CardBrand
  auth_code: string
  entry_mode?: string
  created_at: string
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

interface ValorConfig {
  apiKey: string
  merchantId: string
  apiUrl: string
  environment: 'sandbox' | 'production'
  timeoutMs: number
  maxRetries: number
}

function getConfig(): ValorConfig {
  return {
    apiKey: process.env.VALOR_API_KEY ?? '',
    merchantId: process.env.VALOR_MERCHANT_ID ?? '',
    apiUrl: process.env.VALOR_API_URL ?? 'https://api.valorpaytech.com',
    environment: (process.env.VALOR_ENVIRONMENT as 'sandbox' | 'production') ?? 'sandbox',
    timeoutMs: 30_000,
    maxRetries: 2,
  }
}

function isSandbox(): boolean {
  return getConfig().environment === 'sandbox'
}

// ---------------------------------------------------------------------------
// Sandbox mock helpers
// ---------------------------------------------------------------------------

const MOCK_CARD_BRANDS: CardBrand[] = ['visa', 'mastercard', 'amex', 'discover']
const MOCK_LAST_FOURS = ['4242', '1234', '5678', '9012', '3456', '7890']
const MOCK_ENTRY_MODES = ['emv', 'contactless', 'swipe']

const MOCK_DECLINE_REASONS: Array<{ code: ValorDeclineCode; reason: string }> = [
  { code: 'insufficient_funds', reason: 'Insufficient funds' },
  { code: 'do_not_honor', reason: 'Do not honor' },
  { code: 'expired_card', reason: 'Card expired' },
  { code: 'restricted_card', reason: 'Restricted card' },
  { code: 'lost_stolen', reason: 'Card reported lost or stolen' },
]

function randomFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateMockTransactionId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `VLR-${timestamp}-${random}`
}

function generateMockAuthCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

function generateMockBatchId(): string {
  const date = new Date()
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  const seq = Math.floor(Math.random() * 999).toString().padStart(3, '0')
  return `BATCH-${dateStr}-${seq}`
}

function generateMockRrn(): string {
  return Math.floor(Math.random() * 999999999999).toString().padStart(12, '0')
}

async function mockDelay(): Promise<void> {
  const ms = 1500 + Math.random() * 1000
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Determines if a mock transaction should decline.
 * 95% approval rate. Amounts ending in 66 cents always decline.
 */
function shouldMockDecline(amount_cents: number): boolean {
  if (amount_cents % 100 === 66) return true
  return Math.random() < 0.05
}

// ---------------------------------------------------------------------------
// HTTP helpers for production mode
// ---------------------------------------------------------------------------

class ValorApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody: unknown,
    public readonly valorErrorCode?: string
  ) {
    super(message)
    this.name = 'ValorApiError'
  }
}

async function valorFetch<T>(
  path: string,
  body: Record<string, unknown>,
  config: ValorConfig
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs)

      const response = await fetch(`${config.apiUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
          'X-Merchant-ID': config.merchantId,
          'X-Idempotency-Key': `${body.order_id ?? body.transaction_id ?? ''}-${Date.now()}-${attempt}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const responseBody = await response.json()

      if (!response.ok) {
        // Only retry on 5xx
        if (response.status >= 500 && attempt < config.maxRetries) {
          lastError = new ValorApiError(
            `Valor API error: ${response.status}`,
            response.status,
            responseBody
          )
          // Exponential backoff: 1s, 2s
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
          continue
        }

        throw new ValorApiError(
          responseBody.message ?? `Valor API error: ${response.status}`,
          response.status,
          responseBody,
          responseBody.error_code
        )
      }

      return responseBody as T
    } catch (err) {
      if (err instanceof ValorApiError) {
        throw err
      }

      const error = err as Error
      if (error.name === 'AbortError') {
        throw new ValorApiError('Valor API request timed out', 408, null)
      }

      lastError = error

      if (attempt < config.maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
        continue
      }
    }
  }

  throw lastError ?? new Error('Valor API request failed after retries')
}

// ---------------------------------------------------------------------------
// Valor Client
// ---------------------------------------------------------------------------

export const valorClient = {
  /**
   * Authorize a card payment. Does NOT capture — card hold only.
   * For auth+capture in one step, use sale().
   */
  async authorize(req: ValorAuthRequest): Promise<ValorAuthResponse> {
    if (isSandbox()) {
      await mockDelay()

      if (shouldMockDecline(req.amount_cents)) {
        const decline = randomFrom(MOCK_DECLINE_REASONS)
        return {
          success: false,
          transaction_id: generateMockTransactionId(),
          auth_code: '',
          card_last_four: randomFrom(MOCK_LAST_FOURS),
          card_brand: randomFrom(MOCK_CARD_BRANDS),
          status: 'declined',
          decline_code: decline.code,
          decline_reason: decline.reason,
          entry_mode: randomFrom(MOCK_ENTRY_MODES),
          rrn: generateMockRrn(),
          response_code: 'D',
        }
      }

      return {
        success: true,
        transaction_id: generateMockTransactionId(),
        auth_code: generateMockAuthCode(),
        card_last_four: randomFrom(MOCK_LAST_FOURS),
        card_brand: randomFrom(MOCK_CARD_BRANDS),
        status: 'approved',
        entry_mode: randomFrom(MOCK_ENTRY_MODES),
        rrn: generateMockRrn(),
        response_code: 'A',
      }
    }

    // Production: call Valor REST API
    const config = getConfig()
    const response = await valorFetch<{
      status: string
      transactionId: string
      authCode: string
      cardLast4: string
      cardBrand: string
      declineCode?: string
      declineMessage?: string
      rrn?: string
      entryMode?: string
      responseCode?: string
    }>('/v1/transactions/authorize', {
      merchant_id: config.merchantId,
      amount: req.amount_cents,
      order_id: req.order_id,
      terminal_id: req.terminal_id,
      reference: req.reference,
    }, config)

    const isApproved = response.status === 'approved' || response.responseCode === 'A'

    return {
      success: isApproved,
      transaction_id: response.transactionId,
      auth_code: response.authCode ?? '',
      card_last_four: response.cardLast4 ?? '',
      card_brand: mapCardBrand(response.cardBrand),
      status: isApproved ? 'approved' : 'declined',
      decline_code: mapDeclineCode(response.declineCode),
      decline_reason: response.declineMessage,
      rrn: response.rrn,
      entry_mode: response.entryMode,
      response_code: response.responseCode,
    }
  },

  /**
   * Sale: authorize + capture in one step.
   * Used for counter-service / tip-on-screen flows.
   */
  async sale(req: ValorAuthRequest): Promise<ValorAuthResponse> {
    if (isSandbox()) {
      await mockDelay()

      if (shouldMockDecline(req.amount_cents)) {
        const decline = randomFrom(MOCK_DECLINE_REASONS)
        return {
          success: false,
          transaction_id: generateMockTransactionId(),
          auth_code: '',
          card_last_four: randomFrom(MOCK_LAST_FOURS),
          card_brand: randomFrom(MOCK_CARD_BRANDS),
          status: 'declined',
          decline_code: decline.code,
          decline_reason: decline.reason,
          entry_mode: randomFrom(MOCK_ENTRY_MODES),
          rrn: generateMockRrn(),
          response_code: 'D',
        }
      }

      const txnId = generateMockTransactionId()
      return {
        success: true,
        transaction_id: txnId,
        auth_code: generateMockAuthCode(),
        card_last_four: randomFrom(MOCK_LAST_FOURS),
        card_brand: randomFrom(MOCK_CARD_BRANDS),
        status: 'captured',
        entry_mode: randomFrom(MOCK_ENTRY_MODES),
        rrn: generateMockRrn(),
        response_code: 'A',
        captured_amount_cents: req.amount_cents,
      }
    }

    const config = getConfig()
    const response = await valorFetch<{
      status: string
      transactionId: string
      authCode: string
      cardLast4: string
      cardBrand: string
      declineCode?: string
      declineMessage?: string
      rrn?: string
      entryMode?: string
      responseCode?: string
      capturedAmount?: number
    }>('/v1/transactions/sale', {
      merchant_id: config.merchantId,
      amount: req.amount_cents,
      order_id: req.order_id,
      terminal_id: req.terminal_id,
      reference: req.reference,
    }, config)

    const isApproved = response.status === 'approved' || response.responseCode === 'A'

    return {
      success: isApproved,
      transaction_id: response.transactionId,
      auth_code: response.authCode ?? '',
      card_last_four: response.cardLast4 ?? '',
      card_brand: mapCardBrand(response.cardBrand),
      status: isApproved ? 'captured' : 'declined',
      decline_code: mapDeclineCode(response.declineCode),
      decline_reason: response.declineMessage,
      rrn: response.rrn,
      entry_mode: response.entryMode,
      response_code: response.responseCode,
      captured_amount_cents: response.capturedAmount,
    }
  },

  /**
   * Capture a previous authorization. Final amount can include tip.
   */
  async capture(req: ValorCaptureRequest): Promise<ValorCaptureResponse> {
    if (isSandbox()) {
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 400))

      return {
        success: true,
        transaction_id: req.transaction_id,
        captured_amount_cents: req.amount_cents + req.tip_cents,
        response_code: 'A',
      }
    }

    const config = getConfig()
    const response = await valorFetch<{
      status: string
      transactionId: string
      capturedAmount: number
      responseCode?: string
    }>('/v1/transactions/capture', {
      merchant_id: config.merchantId,
      transaction_id: req.transaction_id,
      amount: req.amount_cents + req.tip_cents,
      tip_amount: req.tip_cents,
    }, config)

    return {
      success: response.status === 'captured' || response.responseCode === 'A',
      transaction_id: response.transactionId,
      captured_amount_cents: response.capturedAmount,
      response_code: response.responseCode,
    }
  },

  /**
   * Void a transaction before batch settlement.
   * Releases card hold immediately, no interchange cost.
   */
  async void(req: ValorVoidRequest): Promise<ValorVoidResponse> {
    if (isSandbox()) {
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 400))

      return {
        success: true,
        transaction_id: req.transaction_id,
        response_code: 'A',
      }
    }

    const config = getConfig()
    const response = await valorFetch<{
      status: string
      transactionId: string
      responseCode?: string
    }>('/v1/transactions/void', {
      merchant_id: config.merchantId,
      transaction_id: req.transaction_id,
      reason: req.reason,
    }, config)

    return {
      success: response.status === 'voided' || response.responseCode === 'A',
      transaction_id: response.transactionId,
      response_code: response.responseCode,
    }
  },

  /**
   * Refund a transaction after batch settlement.
   * Generates interchange cost (restaurant pays fees both ways).
   */
  async refund(req: ValorRefundRequest): Promise<ValorRefundResponse> {
    if (isSandbox()) {
      await new Promise((r) => setTimeout(r, 1000 + Math.random() * 500))

      return {
        success: true,
        transaction_id: req.transaction_id,
        refund_amount_cents: req.amount_cents,
        response_code: 'A',
      }
    }

    const config = getConfig()
    const response = await valorFetch<{
      status: string
      transactionId: string
      refundAmount: number
      responseCode?: string
    }>('/v1/transactions/refund', {
      merchant_id: config.merchantId,
      transaction_id: req.transaction_id,
      amount: req.amount_cents,
      reason: req.reason,
    }, config)

    return {
      success: response.status === 'refunded' || response.responseCode === 'A',
      transaction_id: response.transactionId,
      refund_amount_cents: response.refundAmount,
      response_code: response.responseCode,
    }
  },

  /**
   * Settle all transactions in the current batch.
   */
  async batchSettle(req?: ValorBatchSettleRequest): Promise<ValorBatchSettleResponse> {
    if (isSandbox()) {
      await new Promise((r) => setTimeout(r, 2000 + Math.random() * 1000))

      const txnCount = 15 + Math.floor(Math.random() * 50)
      const grossCents = txnCount * (1500 + Math.floor(Math.random() * 3500))
      const netCents = Math.round(grossCents * 0.972) // ~2.8% processing fee

      return {
        success: true,
        batch_id: generateMockBatchId(),
        transaction_count: txnCount,
        gross_amount_cents: grossCents,
        net_amount_cents: netCents,
        settled_at: new Date().toISOString(),
      }
    }

    const config = getConfig()
    const response = await valorFetch<{
      status: string
      batchId: string
      transactionCount: number
      grossAmount: number
      netAmount: number
      settledAt: string
    }>('/v1/batch/settle', {
      merchant_id: config.merchantId,
      terminal_id: req?.terminal_id,
    }, config)

    return {
      success: response.status === 'settled',
      batch_id: response.batchId,
      transaction_count: response.transactionCount,
      gross_amount_cents: response.grossAmount,
      net_amount_cents: response.netAmount,
      settled_at: response.settledAt,
    }
  },

  /**
   * Query a transaction's current status from Valor.
   */
  async queryTransaction(req: ValorQueryRequest): Promise<ValorQueryResponse> {
    if (isSandbox()) {
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 300))

      return {
        success: true,
        transaction_id: req.transaction_id,
        status: 'captured',
        amount_cents: 2500,
        captured_amount_cents: 2500,
        tip_cents: 500,
        card_last_four: randomFrom(MOCK_LAST_FOURS),
        card_brand: randomFrom(MOCK_CARD_BRANDS),
        auth_code: generateMockAuthCode(),
        entry_mode: randomFrom(MOCK_ENTRY_MODES),
        created_at: new Date().toISOString(),
      }
    }

    const config = getConfig()
    const response = await valorFetch<{
      status: string
      transactionId: string
      transactionStatus: string
      amount: number
      capturedAmount: number
      tipAmount: number
      cardLast4: string
      cardBrand: string
      authCode: string
      entryMode?: string
      createdAt: string
    }>('/v1/transactions/query', {
      merchant_id: config.merchantId,
      transaction_id: req.transaction_id,
    }, config)

    return {
      success: true,
      transaction_id: response.transactionId,
      status: mapTransactionStatus(response.transactionStatus),
      amount_cents: response.amount,
      captured_amount_cents: response.capturedAmount,
      tip_cents: response.tipAmount,
      card_last_four: response.cardLast4,
      card_brand: mapCardBrand(response.cardBrand),
      auth_code: response.authCode,
      entry_mode: response.entryMode,
      created_at: response.createdAt,
    }
  },
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function mapCardBrand(brand?: string): CardBrand {
  if (!brand) return 'unknown'
  const lower = brand.toLowerCase()
  if (lower.includes('visa')) return 'visa'
  if (lower.includes('master')) return 'mastercard'
  if (lower.includes('amex') || lower.includes('american')) return 'amex'
  if (lower.includes('discover')) return 'discover'
  return 'unknown'
}

function mapDeclineCode(code?: string): ValorDeclineCode | undefined {
  if (!code) return undefined
  const lower = code.toLowerCase()
  if (lower.includes('insufficient') || lower.includes('nsf')) return 'insufficient_funds'
  if (lower.includes('honor')) return 'do_not_honor'
  if (lower.includes('expire')) return 'expired_card'
  if (lower.includes('invalid')) return 'invalid_card'
  if (lower.includes('restrict')) return 'restricted_card'
  if (lower.includes('lost') || lower.includes('stolen')) return 'lost_stolen'
  if (lower.includes('pickup')) return 'pickup_card'
  if (lower.includes('not_allowed')) return 'transaction_not_allowed'
  if (lower.includes('error')) return 'processing_error'
  return 'unknown'
}

function mapTransactionStatus(status: string): ValorTransactionStatus {
  const lower = status.toLowerCase()
  if (lower === 'approved' || lower === 'authorized') return 'approved'
  if (lower === 'declined') return 'declined'
  if (lower === 'voided' || lower === 'void') return 'voided'
  if (lower === 'captured') return 'captured'
  if (lower === 'refunded') return 'refunded'
  if (lower === 'partially_refunded') return 'partially_refunded'
  return 'error'
}
