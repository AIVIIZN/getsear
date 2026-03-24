'use client'

import { useState, useCallback } from 'react'
import { DollarSign, Info, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  type CashDrawerPin,
  type CashDrawerConfig as CashDrawerConfigType,
  DEFAULT_CASH_DRAWER_CONFIG,
  validateCashDrawerConfig,
  generateCashDrawerKick,
} from '@/lib/printing/cash-drawer'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CashDrawerConfigProps {
  /** Current cash drawer config */
  config: CashDrawerConfigType
  /** Called when config changes */
  onChange: (config: CashDrawerConfigType) => void
  /** Whether a receipt printer is assigned (required for cash drawer) */
  hasReceiptPrinter: boolean
  /** Printer ID for test kick */
  printerId?: string
}

// ---------------------------------------------------------------------------
// Pulse duration presets
// ---------------------------------------------------------------------------

const PULSE_PRESETS = [
  { label: '100ms', value: 100, description: 'Quick' },
  { label: '200ms', value: 200, description: 'Standard' },
  { label: '400ms', value: 400, description: 'Extended' },
  { label: '600ms', value: 600, description: 'Long' },
  { label: '800ms', value: 800, description: 'Maximum' },
] as const

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CashDrawerConfig({
  config,
  onChange,
  hasReceiptPrinter,
  printerId,
}: CashDrawerConfigProps) {
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')

  const updateConfig = useCallback(
    (partial: Partial<CashDrawerConfigType>) => {
      onChange({ ...config, ...partial })
    },
    [config, onChange]
  )

  const handleTestKick = useCallback(async () => {
    if (!printerId || !config.enabled) return

    setTestStatus('testing')

    try {
      const response = await fetch('/api/printing/cash-drawer/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printerId,
          staffId: 'test',
          terminalId: null,
          reason: 'Test kick from configuration',
          eventType: 'no_sale',
        }),
      })

      if (response.ok) {
        setTestStatus('success')
      } else {
        setTestStatus('error')
      }
    } catch {
      setTestStatus('error')
    }

    // Reset after 2 seconds
    setTimeout(() => setTestStatus('idle'), 2000)
  }, [printerId, config.enabled])

  const errors = validateCashDrawerConfig(config)
  const canEnable = hasReceiptPrinter

  return (
    <div className="space-y-5">
      {/* Enable toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-lg',
              config.enabled
                ? 'bg-[#007AFF]/10 text-[#007AFF]'
                : 'bg-black/[0.04] text-[#8E8E93]'
            )}
          >
            <DollarSign className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </div>
          <div>
            <Label className="text-[15px] font-medium text-[#1C1C1E]">
              Cash Drawer
            </Label>
            <p className="text-xs text-[#8E8E93]">
              Opens on cash payments automatically
            </p>
          </div>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(checked) => {
            if (!canEnable && checked) return
            updateConfig({ enabled: checked as boolean })
          }}
          disabled={!canEnable}
        />
      </div>

      {/* Warning: no printer assigned */}
      {!hasReceiptPrinter && (
        <div className="flex items-start gap-2.5 rounded-lg bg-[#F5A60B]/[0.08] px-3.5 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#F5A60B]" strokeWidth={2} />
          <p className="text-sm text-[#8E6A00]">
            Cash drawer requires a receipt printer with RJ-12 connection.
            Assign a receipt printer first.
          </p>
        </div>
      )}

      {/* Config options (only shown when enabled) */}
      {config.enabled && (
        <div className="space-y-5 pl-12">
          {/* Pin selection */}
          <div>
            <Label className="mb-2 block text-sm font-medium text-[#3C3C43]">
              Trigger Pin
            </Label>
            <div className="flex gap-2">
              {([2, 5] as CashDrawerPin[]).map((pin) => (
                <button
                  key={pin}
                  onClick={() => updateConfig({ pin })}
                  className={cn(
                    'flex h-12 flex-1 items-center justify-center rounded-lg border text-sm font-medium transition-all',
                    config.pin === pin
                      ? 'border-[#007AFF] bg-[#007AFF]/[0.06] text-[#007AFF]'
                      : 'border-black/[0.08] bg-white text-[#3C3C43] hover:border-black/[0.15] hover:bg-black/[0.02]'
                  )}
                  style={{ minHeight: 48 }}
                >
                  Pin {pin}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-[#C7C7CC]">
              Most cash drawers use Pin 2. Check your drawer manual if unsure.
            </p>
          </div>

          {/* Pulse duration */}
          <div>
            <Label className="mb-2 block text-sm font-medium text-[#3C3C43]">
              Pulse Duration
            </Label>
            <div className="flex flex-wrap gap-2">
              {PULSE_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => updateConfig({ pulse_duration: preset.value })}
                  className={cn(
                    'flex h-12 flex-col items-center justify-center rounded-lg border px-4 transition-all',
                    config.pulse_duration === preset.value
                      ? 'border-[#007AFF] bg-[#007AFF]/[0.06] text-[#007AFF]'
                      : 'border-black/[0.08] bg-white text-[#3C3C43] hover:border-black/[0.15] hover:bg-black/[0.02]'
                  )}
                  style={{ minHeight: 48 }}
                >
                  <span className="text-sm font-medium">{preset.label}</span>
                  <span className="text-[10px] opacity-60">{preset.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom slider for fine-tuning */}
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-[#3C3C43]">
                Fine-tune: {config.pulse_duration}ms
              </Label>
            </div>
            <input
              type="range"
              min={100}
              max={800}
              step={50}
              value={config.pulse_duration}
              onChange={(e) =>
                updateConfig({ pulse_duration: parseInt(e.target.value, 10) })
              }
              className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-black/[0.08] accent-[#007AFF]"
              style={{ minHeight: 44 }}
            />
            <div className="mt-1 flex justify-between text-[10px] text-[#C7C7CC]">
              <span>100ms</span>
              <span>800ms</span>
            </div>
          </div>

          {/* Test kick button */}
          <div>
            <Button
              onClick={handleTestKick}
              disabled={testStatus === 'testing' || !printerId}
              className={cn(
                'h-12 gap-2 px-6',
                testStatus === 'success' && 'bg-[#34C759] hover:bg-[#34C759]/90',
                testStatus === 'error' && 'bg-[#FF3B30] hover:bg-[#FF3B30]/90'
              )}
              style={{ minHeight: 48 }}
            >
              <Zap className="h-4 w-4" strokeWidth={2} />
              {testStatus === 'idle' && 'Test Cash Drawer'}
              {testStatus === 'testing' && 'Opening...'}
              {testStatus === 'success' && 'Drawer Opened'}
              {testStatus === 'error' && 'Test Failed'}
            </Button>
          </div>

          {/* Validation errors */}
          {errors.length > 0 && (
            <div className="rounded-lg bg-[#FF3B30]/[0.06] px-3 py-2">
              {errors.map((err, i) => (
                <p key={i} className="text-xs text-[#FF3B30]">
                  {err}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
