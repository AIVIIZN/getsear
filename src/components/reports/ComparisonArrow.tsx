'use client'

import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'

interface ComparisonArrowProps {
  value: number // percentage change
  invertColors?: boolean // true = down is good (like labor %)
  showValue?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function ComparisonArrow({ value, invertColors = false, showValue = true, size = 'md' }: ComparisonArrowProps) {
  const isPositive = value > 0
  const isNeutral = Math.abs(value) < 0.1
  const isGood = invertColors ? !isPositive : isPositive

  const sizeClasses = {
    sm: { icon: 'h-3 w-3', text: 'text-xs' },
    md: { icon: 'h-4 w-4', text: 'text-sm' },
    lg: { icon: 'h-5 w-5', text: 'text-base' },
  }

  if (isNeutral) {
    return (
      <span className={`inline-flex items-center gap-0.5 ${sizeClasses[size].text} text-[var(--muted-foreground)]`}>
        <Minus className={sizeClasses[size].icon} />
        {showValue && <span>0.0%</span>}
      </span>
    )
  }

  const colorClass = isGood ? 'text-[var(--success)]' : 'text-[var(--error)]'
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight

  return (
    <span className={`inline-flex items-center gap-0.5 font-medium ${sizeClasses[size].text} ${colorClass}`}>
      <Icon className={sizeClasses[size].icon} />
      {showValue && <span>{isPositive ? '+' : ''}{value.toFixed(1)}%</span>}
    </span>
  )
}
