import { describe, expect, it } from 'vitest'
import { getOfflineConfidence } from '@/lib/offline/offline-confidence'
import type { CachedConflict, SyncQueueEntry } from '@/lib/offline/db'

function entry(overrides: Partial<SyncQueueEntry>): SyncQueueEntry {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    operation: overrides.operation ?? 'create_order',
    entity_type: overrides.entity_type ?? 'order',
    entity_id: overrides.entity_id ?? 'order-1',
    payload: overrides.payload ?? {},
    status: overrides.status ?? 'pending',
    priority: overrides.priority ?? 5,
    attempts: overrides.attempts ?? 0,
    max_attempts: overrides.max_attempts ?? 3,
    created_at: overrides.created_at ?? new Date().toISOString(),
    last_attempt_at: overrides.last_attempt_at ?? null,
    error: overrides.error ?? null,
    location_id: overrides.location_id ?? 'loc-1',
    idempotency_key: overrides.idempotency_key,
  }
}

function conflict(overrides: Partial<CachedConflict> = {}): CachedConflict {
  return {
    id: overrides.id ?? 'conflict-1',
    entity_type: overrides.entity_type ?? 'order',
    entity_id: overrides.entity_id ?? 'order-1',
    local_data: overrides.local_data ?? { notes: 'offline edit' },
    server_data: overrides.server_data ?? { notes: 'server edit' },
    description: overrides.description ?? 'Order changed on another terminal',
    resolved: overrides.resolved ?? false,
    resolution: overrides.resolution ?? null,
    created_at: overrides.created_at ?? new Date().toISOString(),
    location_id: overrides.location_id ?? 'loc-1',
  }
}

describe('offline confidence snapshot', () => {
  it('summarizes queued orders, dollars, payment risk, and watch-level sync risk', () => {
    const snapshot = getOfflineConfidence({
      connectionState: 'offline',
      isSyncing: false,
      lastSyncAt: null,
      pendingEntries: [
        entry({ operation: 'create_order', payload: { total_cents: 4200 } }),
        entry({ id: 'payment-1', operation: 'create_payment', entity_type: 'payment', payload: { amount_cents: 1800 } }),
      ],
      failedEntries: [],
      conflicts: [],
      storeForwardCount: 1,
      storeForwardTotal: 2500,
      quotaPercent: 20,
    })

    expect(snapshot.safeToSell).toBe(true)
    expect(snapshot.queuedOrders).toBe(1)
    expect(snapshot.queuedOperations).toBe(2)
    expect(snapshot.queuedDollarsCents).toBe(6000)
    expect(snapshot.paymentRiskCents).toBe(4300)
    expect(snapshot.paymentRiskLevel).toBe('watch')
    expect(snapshot.syncRiskLevel).toBe('watch')
  })

  it('blocks selling confidence when conflicts are unresolved', () => {
    const snapshot = getOfflineConfidence({
      connectionState: 'online',
      isSyncing: false,
      lastSyncAt: new Date().toISOString(),
      pendingEntries: [],
      failedEntries: [],
      conflicts: [conflict()],
      storeForwardCount: 0,
      storeForwardTotal: 0,
      quotaPercent: 10,
    })

    expect(snapshot.safeToSell).toBe(false)
    expect(snapshot.headline).toBe('Manager review needed')
    expect(snapshot.syncRiskLevel).toBe('blocked')
    expect(snapshot.unresolvedConflicts).toEqual(['Order changed on another terminal'])
  })
})
