'use client'

import { useEffect } from 'react'
import { initWebVitals } from '@/lib/observability/web-vitals'

export function WebVitalsInit() {
  useEffect(() => {
    initWebVitals()
  }, [])
  return null
}
