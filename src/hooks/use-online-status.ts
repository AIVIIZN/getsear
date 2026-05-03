'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useUIStore } from '@/stores/ui-store'
import { useOfflineStore } from '@/stores/offline-store'
import { pingHealth } from '@/lib/offline/health-check'
import { handleReconnection, handleGoingOffline, stopOfflineMonitoring } from '@/lib/offline/reconnection-manager'
import { registerServiceWorker, onServiceWorkerUpdate } from '@/lib/offline/sw-register'

/** Debounce period to avoid thrashing on flaky connections (3 seconds) */
const DEBOUNCE_MS = 3000

/** Health check interval when offline (5 seconds) */
const OFFLINE_PING_INTERVAL_MS = 5000

/**
 * Enhanced online/offline status detection.
 * - Listens to navigator.onLine events
 * - Pings Supabase health endpoint to verify real connectivity
 * - Debounces state changes (3 seconds) to avoid flaky connection thrashing
 * - Triggers sync queue processing on reconnect
 * - Registers Service Worker on mount
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const setUIOnline = useUIStore((s) => s.actions.setOnline)
  const setOfflineOnline = useOfflineStore((s) => s.actions.setOnline)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevOnlineRef = useRef(true)

  const debouncedUpdateRef = useRef<((online: boolean) => void) | null>(null)

  const updateOnlineState = useCallback((online: boolean) => {
    if (online === prevOnlineRef.current) return
    prevOnlineRef.current = online
    setIsOnline(online)
    setUIOnline(online)
    setOfflineOnline(online)

    if (online) {
      // Stop offline pinging
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
        pingIntervalRef.current = null
      }
      stopOfflineMonitoring()
      // Trigger reconnection sequence
      handleReconnection()
    } else {
      // Start offline monitoring
      handleGoingOffline()
      // Start health check pinging every 5 seconds
      if (!pingIntervalRef.current) {
        pingIntervalRef.current = setInterval(async () => {
          const reachable = await pingHealth()
          if (reachable) {
            debouncedUpdateRef.current?.(true)
          }
        }, OFFLINE_PING_INTERVAL_MS)
      }
    }
  }, [setUIOnline, setOfflineOnline])

  const debouncedUpdate = useCallback((online: boolean) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateOnlineState(online)
    }, DEBOUNCE_MS)
  }, [updateOnlineState])

  useEffect(() => {
    debouncedUpdateRef.current = debouncedUpdate
  }, [debouncedUpdate])

  useEffect(() => {
    // Set initial state with a health check
    const initCheck = async () => {
      const navigatorOnline = navigator.onLine
      if (navigatorOnline) {
        // Verify with actual ping
        const reachable = await pingHealth()
        updateOnlineState(reachable)
      } else {
        updateOnlineState(false)
      }
    }
    initCheck()

    // Listen for browser online/offline events
    const handleOnline = () => debouncedUpdate(true)
    const handleOffline = () => {
      // Going offline is immediate (no debounce delay)
      updateOnlineState(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Listen for SW messages (background sync trigger)
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PROCESS_SYNC_QUEUE') {
        handleReconnection()
      }
    }
    navigator.serviceWorker?.addEventListener('message', handleSWMessage)

    // Register Service Worker
    registerServiceWorker()

    // Listen for SW updates
    onServiceWorkerUpdate(() => {
      // Could show an update notification here
      console.log('[useOnlineStatus] Service Worker update available')
    })

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current)
    }
  }, [debouncedUpdate, updateOnlineState])

  return isOnline
}
