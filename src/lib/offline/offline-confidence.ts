import type { CachedConflict, SyncQueueEntry } from './db'
import type { ConnectionState } from '@/stores/offline-store'

export type SyncRiskLevel = 'clear' | 'watch' | 'high' | 'blocked'
export type PaymentRiskLevel = 'clear' | 'watch' | 'high'

export interface OfflineConfidenceInput {
  connectionState: ConnectionState
  isSyncing: boolean
  lastSyncAt: string | null
  pendingEntries: SyncQueueEntry[]
  failedEntries: SyncQueueEntry[]
  conflicts: CachedConflict[]
  storeForwardCount: number
  storeForwardTotal: number
  quotaPercent: number
}

export interface OfflineConfidenceSnapshot {
  safeToSell: boolean
  headline: string
  guidance: string
  queuedOrders: number
  queuedOperations: number
  queuedDollarsCents: number
  paymentRiskCents: number
  paymentRiskLevel: PaymentRiskLevel
  syncRiskLevel: SyncRiskLevel
  unresolvedConflicts: string[]
}

const PAYMENT_OPERATIONS = new Set(['create_payment', 'settle_payment'])
const ORDER_OPERATIONS = new Set(['create_order', 'update_order', 'add_order_items', 'void_order', 'close_order'])

function centsFromPayload(payload: Record<string, unknown>): number {
  const candidates = [
    payload.amount_cents,
    payload.total_cents,
    payload.order_total_cents,
    payload.subtotal_cents,
  ]

  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return Math.round(value)
    }
  }

  return 0
}

function dedupeEntries(entries: SyncQueueEntry[]): SyncQueueEntry[] {
  const seen = new Set<string>()
  const unique: SyncQueueEntry[] = []
  for (const entry of entries) {
    if (seen.has(entry.id)) continue
    seen.add(entry.id)
    unique.push(entry)
  }
  return unique
}

function paymentRiskLevel(paymentRiskCents: number, storeForwardCount: number): PaymentRiskLevel {
  if (paymentRiskCents >= 50000 || storeForwardCount >= 5) return 'high'
  if (paymentRiskCents > 0 || storeForwardCount > 0) return 'watch'
  return 'clear'
}

function syncRiskLevel(input: OfflineConfidenceInput, queuedOperations: number): SyncRiskLevel {
  if (input.conflicts.length > 0 || input.failedEntries.length > 0) return 'blocked'
  if (input.quotaPercent >= 90) return 'high'
  if (queuedOperations >= 20 || input.quotaPercent >= 80) return 'high'
  if (input.connectionState === 'offline' || queuedOperations > 0 || input.isSyncing) return 'watch'
  return 'clear'
}

export function getOfflineConfidence(input: OfflineConfidenceInput): OfflineConfidenceSnapshot {
  const entries = dedupeEntries([...input.pendingEntries, ...input.failedEntries])
  const queuedOrders = entries.filter((entry) => ORDER_OPERATIONS.has(entry.operation)).length
  const queuedOperations = entries.length
  const queuedDollarsCents = entries.reduce((sum, entry) => sum + centsFromPayload(entry.payload), 0)
  const queuedPaymentCents = entries
    .filter((entry) => PAYMENT_OPERATIONS.has(entry.operation))
    .reduce((sum, entry) => sum + centsFromPayload(entry.payload), 0)
  const paymentRiskCents = input.storeForwardTotal + queuedPaymentCents
  const paymentRisk = paymentRiskLevel(paymentRiskCents, input.storeForwardCount)
  const syncRisk = syncRiskLevel(input, queuedOperations)

  const safeToSell = syncRisk !== 'blocked' && syncRisk !== 'high' && paymentRisk !== 'high'
  const headline = safeToSell ? 'Safe to keep selling' : 'Manager review needed'
  const guidance = safeToSell
    ? 'Offline writes are protected and will replay in priority order.'
    : 'Resolve conflicts or reduce payment exposure before taking more offline orders.'

  return {
    safeToSell,
    headline,
    guidance,
    queuedOrders,
    queuedOperations,
    queuedDollarsCents,
    paymentRiskCents,
    paymentRiskLevel: paymentRisk,
    syncRiskLevel: syncRisk,
    unresolvedConflicts: input.conflicts.map((conflict) => conflict.description),
  }
}
