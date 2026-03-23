/**
 * Service Worker registration with update detection.
 * Registers /sw.js and handles lifecycle events.
 */

/** Whether a SW update is available */
let updateAvailable = false
let onUpdateCallback: (() => void) | null = null

/**
 * Register the Service Worker.
 * Call this from a client component on mount.
 */
export async function registerServiceWorker(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.log('[SW] Service Worker not supported')
    return
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    })

    // Check for updates on registration
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing
      if (!newWorker) return

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New version available — user is on an old version
          updateAvailable = true
          onUpdateCallback?.()
          console.log('[SW] New version available. Refresh to update.')
        }
      })
    })

    // Check for updates periodically (every 30 minutes)
    setInterval(() => {
      registration.update().catch(() => {
        // Silently fail — likely offline
      })
    }, 30 * 60 * 1000)

    // Handle messages from the SW
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SW_UPDATE_AVAILABLE') {
        updateAvailable = true
        onUpdateCallback?.()
      }
    })

    console.log('[SW] Service Worker registered successfully')
  } catch (error) {
    console.error('[SW] Service Worker registration failed:', error)
  }
}

/**
 * Check if a Service Worker update is available.
 */
export function isUpdateAvailable(): boolean {
  return updateAvailable
}

/**
 * Set a callback for when an update becomes available.
 */
export function onServiceWorkerUpdate(callback: () => void): void {
  onUpdateCallback = callback
}

/**
 * Apply the pending Service Worker update (reload the page).
 */
export async function applyUpdate(): Promise<void> {
  if (!('serviceWorker' in navigator)) return

  const registration = await navigator.serviceWorker.getRegistration()
  if (registration?.waiting) {
    // Tell the waiting SW to take over
    registration.waiting.postMessage({ type: 'SKIP_WAITING' })
  }

  // Reload after the new SW activates
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload()
  })
}

/**
 * Unregister the Service Worker (for debugging/testing).
 */
export async function unregisterServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.getRegistration()
  if (registration) {
    await registration.unregister()
    console.log('[SW] Service Worker unregistered')
  }
}
