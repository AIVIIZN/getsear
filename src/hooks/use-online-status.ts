'use client'

import { useState, useEffect } from 'react'
import { useUIStore } from '@/stores/ui-store'

/**
 * Tracks online/offline status and syncs with UI store.
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const setOnline = useUIStore((s) => s.actions.setOnline)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setOnline(true)
    }
    const handleOffline = () => {
      setIsOnline(false)
      setOnline(false)
    }

    // Set initial state
    setIsOnline(navigator.onLine)
    setOnline(navigator.onLine)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [setOnline])

  return isOnline
}
