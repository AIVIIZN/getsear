'use client'

import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/auth-store'

const HEARTBEAT_INTERVAL_MS = 60_000 // 60 seconds

/**
 * Sends a heartbeat POST to /api/terminals/heartbeat every 60 seconds.
 * Reads terminal_id from localStorage (set during device registration).
 * Includes current user ID from auth store if someone is logged in.
 */
export function useTerminalHeartbeat() {
  const user = useAuthStore((s) => s.user)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    function sendHeartbeat() {
      const terminalId = localStorage.getItem('sear_terminal_id')
      if (!terminalId) return

      const payload: { terminal_id: string; current_user_id?: string | null } = {
        terminal_id: terminalId,
      }

      if (user?.id) {
        payload.current_user_id = user.id
      } else {
        payload.current_user_id = null
      }

      fetch('/api/terminals/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {
        // Silently ignore heartbeat failures — device may be offline
      })
    }

    // Send immediately on mount
    sendHeartbeat()

    // Then every 60 seconds
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [user?.id])
}
