'use client'

import { useState, useCallback } from 'react'
import { Delete, CornerDownLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PinPadProps {
  onSubmit: (pin: string) => void
  title?: string
  subtitle?: string
  maxLength?: number
  isLoading?: boolean
  error?: string | null
}

export function PinPad({
  onSubmit,
  title = 'Enter PIN',
  subtitle,
  maxLength = 6,
  isLoading = false,
  error = null,
}: PinPadProps) {
  const [pin, setPin] = useState('')

  const handleDigit = useCallback(
    (digit: string) => {
      if (pin.length < maxLength) {
        const newPin = pin + digit
        setPin(newPin)
        if (newPin.length === maxLength) {
          onSubmit(newPin)
        }
      }
    },
    [pin, maxLength, onSubmit]
  )

  const handleDelete = useCallback(() => {
    setPin((prev) => prev.slice(0, -1))
  }, [])

  const handleClear = useCallback(() => {
    setPin('')
  }, [])

  const handleSubmit = useCallback(() => {
    if (pin.length >= 4) {
      onSubmit(pin)
    }
  }, [pin, onSubmit])

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Title */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>

      {/* PIN dots */}
      <div className="flex items-center gap-3 h-12">
        {Array.from({ length: maxLength }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'w-4 h-4 rounded-full border-2 transition-all duration-150',
              i < pin.length
                ? 'bg-primary border-primary scale-110'
                : 'border-muted-foreground/30 bg-transparent'
            )}
          />
        ))}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm font-medium text-destructive animate-in fade-in slide-in-from-top-1">
          {error}
        </p>
      )}

      {/* Number pad */}
      <div className="grid grid-cols-3 gap-3">
        {digits.map((digit) => (
          <Button
            key={digit}
            variant="outline"
            className="w-16 h-16 text-2xl font-semibold rounded-2xl border-2 hover:bg-accent active:scale-95 transition-transform"
            onClick={() => handleDigit(digit)}
            disabled={isLoading}
          >
            {digit}
          </Button>
        ))}

        {/* Bottom row */}
        <Button
          variant="outline"
          className="w-16 h-16 rounded-2xl border-2 hover:bg-accent"
          onClick={handleClear}
          disabled={isLoading || pin.length === 0}
        >
          <span className="text-xs font-medium text-muted-foreground">Clear</span>
        </Button>

        <Button
          variant="outline"
          className="w-16 h-16 text-2xl font-semibold rounded-2xl border-2 hover:bg-accent active:scale-95 transition-transform"
          onClick={() => handleDigit('0')}
          disabled={isLoading}
        >
          0
        </Button>

        {pin.length >= 4 ? (
          <Button
            className="w-16 h-16 rounded-2xl text-primary-foreground active:scale-95 transition-transform"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            <CornerDownLeft className="h-6 w-6" />
          </Button>
        ) : (
          <Button
            variant="outline"
            className="w-16 h-16 rounded-2xl border-2 hover:bg-accent"
            onClick={handleDelete}
            disabled={isLoading || pin.length === 0}
          >
            <Delete className="h-5 w-5 text-muted-foreground" />
          </Button>
        )}
      </div>
    </div>
  )
}
