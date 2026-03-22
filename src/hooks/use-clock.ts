'use client'

import { useState, useEffect } from 'react'

/**
 * Live clock that updates every minute.
 * Returns formatted time string like "2:30 PM"
 */
export function useClock() {
  const [time, setTime] = useState(() => formatTime(new Date()))

  useEffect(() => {
    const update = () => setTime(formatTime(new Date()))
    // Align to the next minute boundary
    const msUntilNextMinute = (60 - new Date().getSeconds()) * 1000
    const timeout = setTimeout(() => {
      update()
      const interval = setInterval(update, 60_000)
      return () => clearInterval(interval)
    }, msUntilNextMinute)

    return () => clearTimeout(timeout)
  }, [])

  return time
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}
