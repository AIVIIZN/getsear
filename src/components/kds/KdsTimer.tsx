'use client'

import { useEffect, useState } from 'react'

interface KdsTimerProps {
  createdAt: string
  className?: string
}

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

/**
 * Timer color tracks the same aging buckets as the ticket border so the eye
 * lands on a single hue at any given moment.
 *   < 5 min  : default text  (--color-text)
 *   5-7.5    : amber         (--kds-aging-aging)
 *   7.5-10   : orange        (--kds-aging-late)
 *   > 10 min : red           (--kds-aging-critical)
 */
function getTimerColor(seconds: number): string {
  if (seconds >= 600) return 'var(--kds-aging-critical)'
  if (seconds >= 450) return 'var(--kds-aging-late)'
  if (seconds >= 300) return 'var(--kds-aging-aging)'
  return 'var(--color-text)'
}

export function KdsTimer({ createdAt, className = '' }: KdsTimerProps) {
  const [elapsed, setElapsed] = useState<number>(() =>
    Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000))
  )

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)))
    }, 1000)

    return () => clearInterval(interval)
  }, [createdAt])

  return (
    <span
      className={`tabular-nums font-mono text-lg font-bold ${className}`}
      style={{ color: getTimerColor(elapsed) }}
    >
      {formatElapsed(elapsed)}
    </span>
  )
}
