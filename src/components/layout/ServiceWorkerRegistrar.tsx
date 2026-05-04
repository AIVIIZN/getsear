'use client'

import { useEffect } from 'react'
import { registerServiceWorker } from '@/lib/offline/sw-register'

/**
 * Mounts the service worker for the entire app.
 *
 * Renders nothing. Lives inside the root layout so the SW is registered on
 * every page (POS, backoffice, marketing) and the offline mutation queue
 * (V5.3.1) starts draining as soon as a tab is opened.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => { void registerServiceWorker() }, [])
  return null
}
