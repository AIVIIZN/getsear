'use client'

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

interface ScannedItem {
  barcode: string
  menuItemId: string | null
  menuItemName: string | null
  timestamp: string
  success: boolean
}

interface BarcodeScannerState {
  isEnabled: boolean
  lastScannedValue: string | null
  lastScannedItem: {
    id: string
    name: string
    price_cents: number
  } | null
  scanHistory: ScannedItem[]
  errorMessage: string | null
  actions: {
    enable: () => void
    disable: () => void
    recordScan: (scan: ScannedItem) => void
    setLastScannedItem: (item: { id: string; name: string; price_cents: number } | null) => void
    setError: (message: string | null) => void
    clearHistory: () => void
  }
}

const MAX_HISTORY = 20

export const useBarcodeScannerStore = create<BarcodeScannerState>()(
  immer((set) => ({
    isEnabled: true,
    lastScannedValue: null,
    lastScannedItem: null,
    scanHistory: [],
    errorMessage: null,
    actions: {
      enable: () =>
        set((state) => {
          state.isEnabled = true
          state.errorMessage = null
        }),

      disable: () =>
        set((state) => {
          state.isEnabled = false
        }),

      recordScan: (scan: ScannedItem) =>
        set((state) => {
          state.lastScannedValue = scan.barcode
          state.scanHistory.unshift(scan)
          if (state.scanHistory.length > MAX_HISTORY) {
            state.scanHistory = state.scanHistory.slice(0, MAX_HISTORY)
          }
          if (scan.success) {
            state.errorMessage = null
          }
        }),

      setLastScannedItem: (item) =>
        set((state) => {
          state.lastScannedItem = item
        }),

      setError: (message) =>
        set((state) => {
          state.errorMessage = message
        }),

      clearHistory: () =>
        set((state) => {
          state.scanHistory = []
          state.lastScannedValue = null
          state.lastScannedItem = null
          state.errorMessage = null
        }),
    },
  }))
)
