'use client'

import { useState } from 'react'
import { Eye, EyeOff, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ApiKeyInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  helpText?: string
  disabled?: boolean
  className?: string
  id?: string
}

export function ApiKeyInput({
  value,
  onChange,
  placeholder = 'Enter API key...',
  label,
  helpText,
  disabled = false,
  className,
  id,
}: ApiKeyInputProps) {
  const [showFull, setShowFull] = useState(false)
  const [copied, setCopied] = useState(false)

  const isMasked = value.startsWith('*')

  const displayValue = (() => {
    if (showFull || !value) return value
    if (isMasked) return value
    if (value.length <= 8) return value
    return '*'.repeat(value.length - 4) + value.slice(-4)
  })()

  const handleCopy = async () => {
    if (!value || isMasked) return
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <input
          id={id}
          type={showFull ? 'text' : 'password'}
          value={showFull ? value : displayValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'flex h-11 w-full rounded-lg border border-[var(--border)] bg-white px-3 pr-20',
            'text-sm font-mono text-foreground placeholder:text-muted-foreground',
            'transition-colors focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'touch-target'
          )}
        />
        <div className="absolute right-2 flex items-center gap-1">
          {value && !isMasked && (
            <button
              type="button"
              onClick={handleCopy}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--muted)] hover:text-foreground transition-colors"
              title="Copy"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-[var(--success)]" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowFull(!showFull)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--muted)] hover:text-foreground transition-colors"
            title={showFull ? 'Hide' : 'Show'}
          >
            {showFull ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      {helpText && (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}
    </div>
  )
}
