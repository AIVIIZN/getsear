'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  email: string
  display_name: string
  role: string
  org_id: string
  location_ids: string[]
  avatar_color?: string
  pin_hash?: string
}

interface AuthState {
  user: User | null
  activeLocationId: string | null
  terminalId: string | null
  isAuthenticated: boolean
  actions: {
    setUser: (user: User) => void
    clearUser: () => void
    setActiveLocation: (locationId: string) => void
    setTerminal: (terminalId: string) => void
    hasRole: (role: string | string[]) => boolean
    hasPermission: (permission: string) => boolean
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      activeLocationId: null,
      terminalId: null,
      isAuthenticated: false,
      actions: {
        setUser: (user) => {
          set({
            user,
            isAuthenticated: true,
            activeLocationId: user.location_ids[0] ?? null,
          })
          // Cache user in IndexedDB for offline session persistence
          if (typeof window !== 'undefined') {
            import('@/lib/offline/db').then(({ offlineDB }) => {
              offlineDB.cache_meta.put({
                id: 'cached_user',
                key: 'cached_user',
                value: JSON.stringify(user),
                updated_at: new Date().toISOString(),
              }).catch(() => {})
            }).catch(() => {})
          }
        },
        clearUser: () => {
          set({
            user: null,
            isAuthenticated: false,
            activeLocationId: null,
            terminalId: null,
          })
          // Clear cached user
          if (typeof window !== 'undefined') {
            import('@/lib/offline/db').then(({ offlineDB }) => {
              offlineDB.cache_meta.delete('cached_user').catch(() => {})
            }).catch(() => {})
          }
        },
        setActiveLocation: (locationId) =>
          set({ activeLocationId: locationId }),
        setTerminal: (terminalId) =>
          set({ terminalId }),
        hasRole: (role) => {
          const { user } = get()
          if (!user) return false
          if (Array.isArray(role)) return role.includes(user.role)
          return user.role === role
        },
        hasPermission: (_permission) => {
          const { user } = get()
          if (!user) return false
          if (['owner', 'admin'].includes(user.role)) return true
          // TODO: Check against user's permission list when loaded
          return false
        },
      },
    }),
    {
      name: 'sear-auth',
      partialize: (state) => ({
        user: state.user,
        activeLocationId: state.activeLocationId,
        terminalId: state.terminalId,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
