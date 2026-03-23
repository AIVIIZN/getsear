'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { PrinterFailoverManager } from '@/lib/printing/printer-failover'

interface StationStatus {
  id: string
  name: string
  stationType: string
  status: 'online' | 'offline' | 'degraded'
  lastHeartbeatAt: string | null
  primaryPrinterId: string | null
  fallbackPrinterId: string | null
  expoPrinterId: string | null
}

interface FailoverEvent {
  stationId: string
  stationName: string
  primaryPrinterId: string
  fallbackPrinterId: string
  reason: string
  startedAt: string
  resolvedAt: string | null
}

interface ToastNotification {
  id: string
  type: 'warning' | 'success' | 'error'
  title: string
  message: string
  timestamp: string
}

interface UsePrinterFailoverOptions {
  orgId: string | null
  locationId: string | null
  /** Callback to show toast notifications (e.g., from shadcn/ui toast) */
  showToast?: (notification: ToastNotification) => void
}

/**
 * React hook that wraps PrinterFailoverManager.
 * Monitors KDS station health and triggers failover to backup printers.
 */
export function usePrinterFailover(options: UsePrinterFailoverOptions) {
  const { orgId, locationId, showToast } = options
  const managerRef = useRef<PrinterFailoverManager | null>(null)
  const showToastRef = useRef(showToast)
  showToastRef.current = showToast

  const [activeFailovers, setActiveFailovers] = useState<FailoverEvent[]>([])
  const [stationStatuses, setStationStatuses] = useState<StationStatus[]>([])
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [notifications, setNotifications] = useState<ToastNotification[]>([])

  const addNotification = useCallback((notif: Omit<ToastNotification, 'id'>) => {
    const notification: ToastNotification = {
      ...notif,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    }
    setNotifications((prev) => [notification, ...prev].slice(0, 50))
    showToastRef.current?.(notification)
  }, [])

  useEffect(() => {
    if (!orgId || !locationId) return

    const manager = new PrinterFailoverManager(orgId, locationId, {
      onStationOffline: (station, fallbackPrinterId) => {
        setActiveFailovers(manager.getActiveFailovers())
        setStationStatuses(manager.getStationStatuses())

        addNotification({
          type: 'warning',
          title: `${station.name} printer offline`,
          message: fallbackPrinterId
            ? `Routing tickets to backup printer`
            : `No backup printer configured`,
          timestamp: new Date().toISOString(),
        })
      },
      onStationOnline: (station) => {
        setActiveFailovers(manager.getActiveFailovers())
        setStationStatuses(manager.getStationStatuses())

        addNotification({
          type: 'success',
          title: `${station.name} printer back online`,
          message: 'Tickets will resume printing to primary printer',
          timestamp: new Date().toISOString(),
        })
      },
      onFailoverError: (station, error) => {
        setStationStatuses(manager.getStationStatuses())

        addNotification({
          type: 'error',
          title: `${station.name} failover error`,
          message: error,
          timestamp: new Date().toISOString(),
        })
      },
    })

    managerRef.current = manager
    manager.startMonitoring().then(() => {
      setIsMonitoring(true)
      setStationStatuses(manager.getStationStatuses())
      setActiveFailovers(manager.getActiveFailovers())
    })

    // Periodically refresh UI state
    const refreshTimer = setInterval(() => {
      if (managerRef.current) {
        setStationStatuses(managerRef.current.getStationStatuses())
        setActiveFailovers(managerRef.current.getActiveFailovers())
      }
    }, 10000)

    return () => {
      clearInterval(refreshTimer)
      manager.stopMonitoring()
      managerRef.current = null
      setIsMonitoring(false)
    }
  }, [orgId, locationId, addNotification])

  return {
    activeFailovers,
    stationStatuses,
    isMonitoring,
    notifications,
  }
}
