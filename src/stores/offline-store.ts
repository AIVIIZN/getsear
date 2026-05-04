'use client'

import { create } from 'zustand'
import type { SyncEntityType, CachedConflict, QueuedMutation } from '@/lib/offline/db'
import {
  enqueue as enqueueMutation,
  getPending as getPendingMutations,
  getPendingCount as getMutationPendingCount,
  retry as retryMutation,
  discard as discardMutation,
  onChange as onMutationQueueChange,
  type EnqueueInput,
} from '@/lib/offline/queue'
import { replayQueue, installOnlineReplayHook } from '@/lib/offline/sync'

export type ConnectionState = 'online' | 'offline' | 'syncing' | 'reconnecting'
export type BannerState = 'hidden' | 'offline' | 'syncing' | 'synced' | 'conflict' | 'stale'

interface PendingOps {
  orders: number
  payments: number
  time_entries: number
  tables: number
  total: number
}

interface OfflineState {
  connectionState: ConnectionState
  bannerState: BannerState
  bannerDismissed: boolean
  isOnline: boolean
  isSyncing: boolean
  syncProgress: number // 0-100
  syncTotal: number
  syncCompleted: number
  pendingOps: PendingOps
  /** V5.3.1 — count of HTTP mutations queued in IndexedDB awaiting replay. */
  pendingCount: number
  /** V5.3.1 — most-recently-loaded snapshot of pending mutations (for the offline drawer). */
  pendingMutations: QueuedMutation[]
  conflicts: CachedConflict[]
  lastSyncAt: string | null
  offlineSince: string | null
  offlineDurationMs: number
  cacheWarmed: boolean
  cacheWarmProgress: number // 0-100
  cacheWarmStage: string
  storeForwardCount: number
  storeForwardTotal: number // total amount in cents
  quotaPercent: number
  quotaWarning: boolean
  actions: {
    setConnectionState: (state: ConnectionState) => void
    setBannerState: (state: BannerState) => void
    dismissBanner: () => void
    setOnline: (online: boolean) => void
    setSyncing: (syncing: boolean) => void
    setSyncProgress: (completed: number, total: number) => void
    setPendingOps: (ops: Partial<PendingOps>) => void
    updatePendingCount: (entityType: SyncEntityType, delta: number) => void
    setConflicts: (conflicts: CachedConflict[]) => void
    addConflict: (conflict: CachedConflict) => void
    removeConflict: (conflictId: string) => void
    setLastSyncAt: (timestamp: string) => void
    setOfflineSince: (timestamp: string | null) => void
    setCacheWarmed: (warmed: boolean) => void
    setCacheWarmProgress: (progress: number, stage: string) => void
    setStoreForwardCount: (count: number, totalCents: number) => void
    setQuota: (percent: number, warning: boolean) => void
    /** V5.3.1 — refresh `pendingCount` + `pendingMutations` from IndexedDB. */
    refreshMutationQueue: () => Promise<void>
    /** V5.3.1 — buffer a mutation. Returns the UUIDv4 idempotency key. */
    enqueueMutation: (input: EnqueueInput) => Promise<string>
    /** V5.3.1 — manually trigger a replay (called by online listener too). */
    replayQueue: () => Promise<void>
    /** V5.3.1 — manual retry of one failed mutation (offline UI button). */
    retryMutation: (id: string) => Promise<void>
    /** V5.3.1 — discard a pending/failed mutation (offline UI abandon). */
    discardMutation: (id: string) => Promise<void>
    reset: () => void
  }
}

const INITIAL_PENDING: PendingOps = { orders: 0, payments: 0, time_entries: 0, tables: 0, total: 0 }

function calcTotal(ops: PendingOps): number {
  return ops.orders + ops.payments + ops.time_entries + ops.tables
}

export const useOfflineStore = create<OfflineState>()((set) => ({
  connectionState: 'online',
  bannerState: 'hidden',
  bannerDismissed: false,
  isOnline: true,
  isSyncing: false,
  syncProgress: 0,
  syncTotal: 0,
  syncCompleted: 0,
  pendingOps: { ...INITIAL_PENDING },
  pendingCount: 0,
  pendingMutations: [],
  conflicts: [],
  lastSyncAt: null,
  offlineSince: null,
  offlineDurationMs: 0,
  cacheWarmed: false,
  cacheWarmProgress: 0,
  cacheWarmStage: '',
  storeForwardCount: 0,
  storeForwardTotal: 0,
  quotaPercent: 0,
  quotaWarning: false,
  actions: {
    setConnectionState: (connectionState) =>
      set((state) => {
        const isOnline = connectionState === 'online' || connectionState === 'syncing'
        const offlineSince = !isOnline && !state.offlineSince
          ? new Date().toISOString()
          : isOnline ? null : state.offlineSince
        return { connectionState, isOnline, offlineSince }
      }),

    setBannerState: (bannerState) =>
      set({ bannerState, bannerDismissed: false }),

    dismissBanner: () =>
      set({ bannerDismissed: true }),

    setOnline: (online) =>
      set((state) => ({
        isOnline: online,
        connectionState: online ? 'online' : 'offline',
        offlineSince: !online && !state.offlineSince
          ? new Date().toISOString()
          : online ? null : state.offlineSince,
        bannerState: online ? (state.bannerState === 'offline' ? 'hidden' : state.bannerState) : 'offline',
        bannerDismissed: online ? false : state.bannerDismissed,
      })),

    setSyncing: (syncing) =>
      set({
        isSyncing: syncing,
        connectionState: syncing ? 'syncing' : 'online',
        bannerState: syncing ? 'syncing' : 'hidden',
      }),

    setSyncProgress: (completed, total) =>
      set({
        syncCompleted: completed,
        syncTotal: total,
        syncProgress: total > 0 ? Math.round((completed / total) * 100) : 0,
      }),

    setPendingOps: (ops) =>
      set((state) => {
        const updated = { ...state.pendingOps, ...ops }
        updated.total = calcTotal(updated)
        return { pendingOps: updated }
      }),

    updatePendingCount: (entityType, delta) =>
      set((state) => {
        const key = entityType === 'kds_ticket' ? 'orders' : `${entityType}s` as keyof PendingOps
        if (key === 'total') return state
        const updated = { ...state.pendingOps }
        const current = updated[key] as number
        updated[key] = Math.max(0, current + delta) as never
        updated.total = calcTotal(updated)
        return { pendingOps: updated }
      }),

    setConflicts: (conflicts) =>
      set({ conflicts, bannerState: conflicts.length > 0 ? 'conflict' : 'hidden' }),

    addConflict: (conflict) =>
      set((state) => ({
        conflicts: [...state.conflicts, conflict],
        bannerState: 'conflict',
      })),

    removeConflict: (conflictId) =>
      set((state) => {
        const conflicts = state.conflicts.filter((c) => c.id !== conflictId)
        return {
          conflicts,
          bannerState: conflicts.length > 0 ? 'conflict' : 'hidden',
        }
      }),

    setLastSyncAt: (timestamp) =>
      set({ lastSyncAt: timestamp }),

    setOfflineSince: (timestamp) =>
      set({ offlineSince: timestamp }),

    setCacheWarmed: (warmed) =>
      set({ cacheWarmed: warmed }),

    setCacheWarmProgress: (progress, stage) =>
      set({ cacheWarmProgress: progress, cacheWarmStage: stage }),

    setStoreForwardCount: (count, totalCents) =>
      set({ storeForwardCount: count, storeForwardTotal: totalCents }),

    setQuota: (percent, warning) =>
      set({ quotaPercent: percent, quotaWarning: warning }),

    refreshMutationQueue: async () => {
      const [pending, count] = await Promise.all([
        getPendingMutations(),
        getMutationPendingCount(),
      ])
      set({ pendingMutations: pending, pendingCount: count })
    },

    enqueueMutation: async (input) => {
      // CRITICAL: this MUST resolve before the caller applies its optimistic
      // UI update. The IndexedDB write completes before the returned promise
      // resolves (Dexie's put() awaits the transaction commit).
      const id = await enqueueMutation(input)
      const [pending, count] = await Promise.all([
        getPendingMutations(),
        getMutationPendingCount(),
      ])
      set({ pendingMutations: pending, pendingCount: count })
      return id
    },

    replayQueue: async () => {
      await replayQueue()
      const [pending, count] = await Promise.all([
        getPendingMutations(),
        getMutationPendingCount(),
      ])
      set({ pendingMutations: pending, pendingCount: count })
    },

    retryMutation: async (id) => {
      await retryMutation(id)
      const [pending, count] = await Promise.all([
        getPendingMutations(),
        getMutationPendingCount(),
      ])
      set({ pendingMutations: pending, pendingCount: count })
    },

    discardMutation: async (id) => {
      await discardMutation(id)
      const [pending, count] = await Promise.all([
        getPendingMutations(),
        getMutationPendingCount(),
      ])
      set({ pendingMutations: pending, pendingCount: count })
    },

    reset: () =>
      set({
        connectionState: 'online',
        bannerState: 'hidden',
        bannerDismissed: false,
        isOnline: true,
        isSyncing: false,
        syncProgress: 0,
        syncTotal: 0,
        syncCompleted: 0,
        pendingOps: { ...INITIAL_PENDING },
        pendingCount: 0,
        pendingMutations: [],
        conflicts: [],
        lastSyncAt: null,
        offlineSince: null,
        offlineDurationMs: 0,
        cacheWarmed: false,
        cacheWarmProgress: 0,
        cacheWarmStage: '',
        storeForwardCount: 0,
        storeForwardTotal: 0,
        quotaPercent: 0,
        quotaWarning: false,
      }),
  },
}))

// ─── Browser-side wiring (V5.3.1) ───────────────────────────────────
//
// Module-level side effects so consumers don't have to remember to install
// the listeners. Guarded by `typeof window !== 'undefined'` to keep SSR safe.

if (typeof window !== 'undefined') {
  // Mirror navigator.onLine into the store on online/offline events.
  const updateOnline = () => {
    useOfflineStore.getState().actions.setOnline(navigator.onLine)
  }
  window.addEventListener('online', updateOnline)
  window.addEventListener('offline', updateOnline)
  // Initial sync in case we mount while offline.
  if (typeof navigator !== 'undefined' && navigator.onLine !== undefined) {
    useOfflineStore.setState({ isOnline: navigator.onLine })
  }

  // Replay on reconnect — pulls + reconciles store state after each replay.
  installOnlineReplayHook({
    onResult: () => {
      void useOfflineStore.getState().actions.refreshMutationQueue()
    },
  })

  // Cross-tab queue change subscription — if another tab enqueues, refresh.
  onMutationQueueChange(() => {
    void useOfflineStore.getState().actions.refreshMutationQueue()
  })

  // Initial population of pendingCount on first load.
  void useOfflineStore.getState().actions.refreshMutationQueue()

  // Test-harness exposure (non-production only). The V5.3.1 Playwright spec
  // drives the queue directly via these globals because the offline UI
  // surfaces are owned by sister task 5.3.2. Stripped from prod builds.
  if (process.env.NODE_ENV !== 'production') {
    const w = window as unknown as Record<string, unknown>
    w.useOfflineStore = useOfflineStore
    // Lazy-import to avoid circular evaluation cost.
    void import('@/lib/offline/db').then((mod) => {
      w.offlineDB = mod.offlineDB
    })
  }
}
