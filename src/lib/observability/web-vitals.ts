'use client'

import { onCLS, onINP, onLCP, onFCP, onTTFB, type Metric } from 'web-vitals'

interface RumPayload {
  name: 'CLS' | 'INP' | 'LCP' | 'FCP' | 'TTFB'
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  route: string
  href: string
  ts: string
}

const ENDPOINT = '/api/observability/rum'

let initialized = false

function send(payload: RumPayload) {
  const body = JSON.stringify(payload)

  try {
    if (
      typeof navigator !== 'undefined' &&
      'sendBeacon' in navigator &&
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))
    ) {
      return
    }
    void fetch(ENDPOINT, {
      method: 'POST',
      body,
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {})
  } catch (err) {
    console.error('[rum]', err)
  }
}

function handle(metric: Metric, route: string) {
  send({
    name: metric.name as RumPayload['name'],
    value: Math.round(metric.value * 100) / 100,
    rating: metric.rating,
    route,
    href: typeof window !== 'undefined' ? window.location.href : '/',
    ts: new Date().toISOString(),
  })
}

export function initWebVitals() {
  if (typeof window === 'undefined') return
  if (initialized) return
  initialized = true

  const handler = (metric: Metric) => handle(metric, window.location.pathname)

  onCLS(handler)
  onINP(handler)
  onLCP(handler)
  onFCP(handler)
  onTTFB(handler)
}
