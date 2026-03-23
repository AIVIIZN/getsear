'use client'

import { useEffect, useRef, useCallback } from 'react'
import { BarcodeScannerEngine } from '@/lib/printing/barcode-scanner'
import { useBarcodeScannerStore } from '@/stores/barcode-scanner-store'

interface BarcodeScannerOptions {
  /** Called when a barcode is scanned and an item is found. */
  onItemFound?: (item: {
    id: string
    name: string
    price_cents: number
    barcode: string
    plu_code: string | null
    allergens: string[] | null
    modifiers: Array<{
      group_id: string
      group_name: string
      min: number
      max: number
      modifiers: Array<{ id: string; name: string; price_cents: number }>
    }>
  }) => void
  /** Called when barcode is not found in the menu. */
  onItemNotFound?: (barcode: string) => void
  /** Whether to auto-add found items to the order. Default: false (caller handles it). */
  enabled?: boolean
}

interface BarcodeLookupResponse {
  data: {
    id: string
    name: string
    price: string
    barcode: string | null
    plu_code: string | null
    allergens: string[] | null
    is_86d: boolean
    is_active: boolean
    modifier_groups: Array<{
      group_id: string
      group_name: string
      min_selections: number
      max_selections: number
      modifiers: Array<{ id: string; name: string; price_adjustment: string }>
    }>
  }
}

/**
 * React hook that wraps BarcodeScannerEngine.
 * Listens for barcode scans, looks up the PLU/barcode in menu_items,
 * and fires callbacks with the found item or error.
 */
export function useBarcodeScanner(options: BarcodeScannerOptions = {}) {
  const { onItemFound, onItemNotFound, enabled = true } = options
  const engineRef = useRef<BarcodeScannerEngine | null>(null)
  const onItemFoundRef = useRef(onItemFound)
  const onItemNotFoundRef = useRef(onItemNotFound)

  onItemFoundRef.current = onItemFound
  onItemNotFoundRef.current = onItemNotFound

  const store = useBarcodeScannerStore()
  const { isEnabled, lastScannedValue, errorMessage, actions } = store

  const lookupBarcode = useCallback(async (barcode: string) => {
    try {
      const params = new URLSearchParams({ barcode })
      const res = await fetch(`/api/menu/items/barcode-lookup?${params.toString()}`)

      if (res.status === 404) {
        actions.recordScan({
          barcode,
          menuItemId: null,
          menuItemName: null,
          timestamp: new Date().toISOString(),
          success: false,
        })
        actions.setError(`Item not found for barcode ${barcode}`)
        onItemNotFoundRef.current?.(barcode)
        return
      }

      if (!res.ok) {
        actions.setError('Failed to look up barcode')
        return
      }

      const json: BarcodeLookupResponse = await res.json()
      const item = json.data

      if (item.is_86d) {
        actions.recordScan({
          barcode,
          menuItemId: item.id,
          menuItemName: item.name,
          timestamp: new Date().toISOString(),
          success: false,
        })
        actions.setError(`${item.name} is currently 86'd`)
        return
      }

      if (!item.is_active) {
        actions.recordScan({
          barcode,
          menuItemId: item.id,
          menuItemName: item.name,
          timestamp: new Date().toISOString(),
          success: false,
        })
        actions.setError(`${item.name} is not currently available`)
        return
      }

      // Convert price from dollars string to cents
      const priceCents = Math.round(parseFloat(item.price) * 100)

      actions.recordScan({
        barcode,
        menuItemId: item.id,
        menuItemName: item.name,
        timestamp: new Date().toISOString(),
        success: true,
      })

      actions.setLastScannedItem({
        id: item.id,
        name: item.name,
        price_cents: priceCents,
      })

      onItemFoundRef.current?.({
        id: item.id,
        name: item.name,
        price_cents: priceCents,
        barcode: item.barcode ?? barcode,
        plu_code: item.plu_code,
        allergens: item.allergens,
        modifiers: item.modifier_groups.map((g) => ({
          group_id: g.group_id,
          group_name: g.group_name,
          min: g.min_selections,
          max: g.max_selections,
          modifiers: g.modifiers.map((m) => ({
            id: m.id,
            name: m.name,
            price_cents: Math.round(parseFloat(m.price_adjustment) * 100),
          })),
        })),
      })
    } catch (err) {
      console.error('[useBarcodeScanner] Lookup error:', err)
      actions.setError('Network error looking up barcode')
    }
  }, [actions])

  // Initialize engine
  useEffect(() => {
    if (typeof window === 'undefined') return

    const engine = new BarcodeScannerEngine({
      minLength: 5,
      maxScanDurationMs: 100,
      preventDefault: true,
    })

    engine.onScan((barcode) => {
      if (!useBarcodeScannerStore.getState().isEnabled) return
      lookupBarcode(barcode)
    })

    engineRef.current = engine

    if (enabled && isEnabled) {
      engine.start()
    }

    return () => {
      engine.stop()
      engineRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync engine state with store enable/disable
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return

    if (enabled && isEnabled) {
      engine.start()
    } else {
      engine.stop()
    }
  }, [enabled, isEnabled])

  return {
    lastScannedBarcode: lastScannedValue,
    isListening: enabled && isEnabled,
    error: errorMessage,
    scanHistory: store.scanHistory,
    enable: actions.enable,
    disable: actions.disable,
    clearHistory: actions.clearHistory,
  }
}
