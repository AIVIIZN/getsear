'use client'

import { create } from 'zustand'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ModalConfig {
  title: string
  content: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  onConfirm?: () => void
  onCancel?: () => void
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

interface UIState {
  sidebarCollapsed: boolean
  isOnline: boolean
  isSyncing: boolean
  activeModal: ModalConfig | null
  toasts: Toast[]
  actions: {
    toggleSidebar: () => void
    setSidebarCollapsed: (collapsed: boolean) => void
    setOnline: (online: boolean) => void
    setSyncing: (syncing: boolean) => void
    showModal: (config: ModalConfig) => void
    closeModal: () => void
    addToast: (type: ToastType, message: string, duration?: number) => void
    removeToast: (id: string) => void
  }
}

let toastCounter = 0

export const useUIStore = create<UIState>()((set, get) => ({
  sidebarCollapsed: true,
  isOnline: true,
  isSyncing: false,
  activeModal: null,
  toasts: [],
  actions: {
    toggleSidebar: () =>
      set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    setSidebarCollapsed: (collapsed) =>
      set({ sidebarCollapsed: collapsed }),
    setOnline: (online) =>
      set({ isOnline: online }),
    setSyncing: (syncing) =>
      set({ isSyncing: syncing }),
    showModal: (config) =>
      set({ activeModal: config }),
    closeModal: () =>
      set({ activeModal: null }),
    addToast: (type, message, duration = 5000) => {
      const id = `toast-${++toastCounter}`
      set((state) => ({
        toasts: [...state.toasts.slice(-4), { id, type, message, duration }],
      }))
      if (duration > 0) {
        setTimeout(() => {
          get().actions.removeToast(id)
        }, duration)
      }
    },
    removeToast: (id) =>
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      })),
  },
}))
