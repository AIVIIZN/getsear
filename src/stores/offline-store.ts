'use client'

import { create } from 'zustand'
import type { SyncEntityType, CachedConflict } from '@/lib/offline/db'

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
