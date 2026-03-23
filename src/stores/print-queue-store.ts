'use client'

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import {
  getPrintQueueManager,
  type PrintJob,
  type PrintJobStatus,
} from '@/lib/printing/print-queue'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PrintQueueState {
  pendingJobs: PrintJob[]
  failedJobs: PrintJob[]
  recentCompletedJobs: PrintJob[]
  isProcessing: boolean
  isDropdownOpen: boolean

  // Derived counts
  pendingCount: number
  failedCount: number
}

interface PrintQueueActions {
  /** Refresh all job lists from the queue manager */
  refresh: () => void
  /** Retry a specific failed job */
  retryJob: (jobId: string) => Promise<void>
  /** Cancel a specific pending or failed job */
  cancelJob: (jobId: string) => Promise<void>
  /** Clear all completed jobs */
  clearCompleted: () => Promise<void>
  /** Toggle the dropdown open/closed */
  toggleDropdown: () => void
  /** Set the dropdown state */
  setDropdownOpen: (open: boolean) => void
  /** Initialize the store and subscribe to queue events */
  init: () => () => void
}

type PrintQueueStore = PrintQueueState & PrintQueueActions

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const usePrintQueueStore = create<PrintQueueStore>()(
  immer((set) => {
    function refreshFromQueue(): void {
      const qm = getPrintQueueManager()
      set((state) => {
        state.pendingJobs = qm.getPendingJobs()
        state.failedJobs = qm.getFailedJobs()
        state.recentCompletedJobs = qm.getRecentCompletedJobs()
        state.isProcessing = qm.isProcessing
        state.pendingCount = state.pendingJobs.length
        state.failedCount = state.failedJobs.length
      })
    }

    return {
      // Initial state
      pendingJobs: [],
      failedJobs: [],
      recentCompletedJobs: [],
      isProcessing: false,
      isDropdownOpen: false,
      pendingCount: 0,
      failedCount: 0,

      refresh: () => {
        refreshFromQueue()
      },

      retryJob: async (jobId: string) => {
        const qm = getPrintQueueManager()
        await qm.retry(jobId)
        refreshFromQueue()
      },

      cancelJob: async (jobId: string) => {
        const qm = getPrintQueueManager()
        await qm.cancel(jobId)
        refreshFromQueue()
      },

      clearCompleted: async () => {
        const qm = getPrintQueueManager()
        await qm.clearCompleted()
        refreshFromQueue()
      },

      toggleDropdown: () => {
        set((state) => {
          state.isDropdownOpen = !state.isDropdownOpen
        })
      },

      setDropdownOpen: (open: boolean) => {
        set((state) => {
          state.isDropdownOpen = open
        })
      },

      init: () => {
        const qm = getPrintQueueManager()

        // Subscribe to all events and refresh state
        const handler = () => refreshFromQueue()

        qm.on('jobAdded', handler)
        qm.on('jobCompleted', handler)
        qm.on('jobFailed', handler)
        qm.on('jobRetrying', handler)
        qm.on('queueEmpty', handler)

        // Initial refresh
        refreshFromQueue()

        // Return cleanup function
        return () => {
          qm.off('jobAdded', handler)
          qm.off('jobCompleted', handler)
          qm.off('jobFailed', handler)
          qm.off('jobRetrying', handler)
          qm.off('queueEmpty', handler)
        }
      },
    }
  })
)
