'use client'

import { useState, useEffect, useCallback } from 'react'
import { useOfflineStore } from '@/stores/offline-store'

/**
 * Generic hook that reads from IndexedDB if offline, Supabase if online.
 * Provides seamless switching between data sources.
 *
 * @param onlineFetcher - Function that fetches data from Supabase
 * @param offlineFetcher - Function that reads data from IndexedDB
 * @param deps - Dependency array for re-fetching
 */
export function useOfflineData<T>(
  onlineFetcher: () => Promise<T>,
  offlineFetcher: () => Promise<T>,
  deps: unknown[] = []
): {
  data: T | null
  isLoading: boolean
  error: string | null
  isOfflineData: boolean
  refetch: () => Promise<void>
} {
  const isOnline = useOfflineStore((s) => s.isOnline)
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOfflineData, setIsOfflineData] = useState(false)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (isOnline) {
        // Try online first
        try {
          const result = await onlineFetcher()
          setData(result)
          setIsOfflineData(false)
          return
        } catch {
          // Online fetch failed — fall back to offline cache
          console.warn('[useOfflineData] Online fetch failed, falling back to cache')
        }
      }

      // Use offline cache
      const result = await offlineFetcher()
      setData(result)
      setIsOfflineData(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, ...deps])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, isLoading, error, isOfflineData, refetch: fetchData }
}
