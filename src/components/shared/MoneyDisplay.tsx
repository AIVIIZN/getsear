interface MoneyDisplayProps {
  cents: number
  className?: string
  showSign?: boolean
}

/**
 * Displays money amounts with tabular numbers for proper alignment.
 * Always renders integer cents as "$X.XX"
 */
export function MoneyDisplay({ cents, className = '', showSign = false }: MoneyDisplayProps) {
  const isNegative = cents < 0
  const absCents = Math.abs(cents)
  const dollars = Math.floor(absCents / 100)
  const remainderCents = absCents % 100
  const formatted = `$${dollars.toLocaleString()}.${String(remainderCents).padStart(2, '0')}`

  return (
    <span className={`tabular-nums font-mono ${className}`}>
      {showSign && !isNegative && '+'}
      {isNegative && '-'}
      {formatted}
    </span>
  )
}
