'use client'

import { useState } from 'react'
import { Copy, Check, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface RecoveryCodesProps {
  codes: string[]
  onDone: () => void
}

export function RecoveryCodes({ codes, onDone }: RecoveryCodesProps) {
  const [copied, setCopied] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(codes.join('\n'))
      setCopied(true)
      toast.success('Recovery codes copied to clipboard')
      setTimeout(() => setCopied(false), 3000)
    } catch {
      toast.error('Failed to copy. Please select and copy manually.')
    }
  }

  function handleDownload() {
    const content = [
      'Sear POS - Recovery Codes',
      '========================',
      '',
      'Keep these codes safe. Each code can only be used once.',
      'If you lose access to your authenticator app, use one of',
      'these codes to regain access to your account.',
      '',
      ...codes.map((code, i) => `${String(i + 1).padStart(2, ' ')}. ${code}`),
      '',
      `Generated: ${new Date().toISOString()}`,
    ].join('\n')

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sear-pos-recovery-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Recovery codes downloaded')
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
          Save your recovery codes
        </h3>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          These codes let you access your account if you lose your authenticator device.
          Each code can only be used once. Store them somewhere safe.
        </p>
      </div>

      {/* Recovery codes grid */}
      <div
        className="rounded-lg border p-4"
        style={{
          backgroundColor: 'var(--card)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="grid grid-cols-2 gap-2">
          {codes.map((code, index) => (
            <div
              key={index}
              className="rounded-md px-3 py-2 text-center font-mono text-sm font-medium tracking-wider"
              style={{
                backgroundColor: 'var(--muted)',
                color: 'var(--foreground)',
              }}
            >
              {code}
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          onClick={handleCopy}
          className="h-12 flex-1 touch-target"
        >
          {copied ? (
            <>
              <Check className="mr-2 size-4" />
              Copied
            </>
          ) : (
            <>
              <Copy className="mr-2 size-4" />
              Copy codes
            </>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={handleDownload}
          className="h-12 flex-1 touch-target"
        >
          <Download className="mr-2 size-4" />
          Download
        </Button>
      </div>

      {/* Confirmation */}
      <div className="space-y-3">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-5 w-5 rounded accent-[var(--primary)]"
          />
          <span className="text-sm" style={{ color: 'var(--foreground)' }}>
            I have saved my recovery codes in a secure location. I understand that I
            will not be able to see these codes again.
          </span>
        </label>

        <Button
          onClick={onDone}
          disabled={!confirmed}
          className="h-12 w-full touch-target text-base font-semibold"
        >
          Done
        </Button>
      </div>
    </div>
  )
}
