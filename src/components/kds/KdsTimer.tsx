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

function getTimerColor(seconds: number): string {
  if (seconds >= 900) return 'text-red-400'
  if (seconds >= 600) return 'text-orange-400'
  if (seconds >= 300) return 'text-yellow-400'
  return 'text-white'
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
    <span className={`tabular-nums font-mono text-lg font-bold ${getTimerColor(elapsed)} ${className}`}>
      {formatElapsed(elapsed)}
    </span>
  )
}
