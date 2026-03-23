'use client'

import { Card, CardContent } from '@/components/ui/card'
import { ArrowUpRight, ArrowDownRight, type LucideIcon } from 'lucide-react'
import { type HealthLevel, HEALTH_COLORS } from '@/lib/reports/constants'

interface KPICardProps {
  label: string
  value: string
  change: number
  icon: LucideIcon
  prefix?: string
  suffix?: string
  health?: HealthLevel
  comparisonLabel?: string
}

export function KPICard({ label, value, change, icon: Icon, prefix = '', suffix = '', health, comparisonLabel = 'vs last period' }: KPICardProps) {
  const isPositive = change >= 0
  const isLaborMetric = label.toLowerCase().includes('labor')
  const isGood = isLaborMetric ? !isPositive : isPositive

  const borderColor = health ? HEALTH_COLORS[health] : isGood ? 'var(--success)' : 'var(--error)'

  return (
    <Card className="shadow-warm-sm overflow-hidden">
      <div className="h-1" style={{ backgroundColor: borderColor }} />
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-[var(--muted-foreground)]">{label}</span>
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--secondary)]">
            <Icon className="h-4 w-4 text-[var(--muted-foreground)]" />
          </div>
        </div>
        <div className="text-[28px] font-extrabold tabular-nums leading-tight">
          {prefix}{value}{suffix}
        </div>
        <div className={`flex items-center gap-1 text-xs mt-2 ${isGood ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
          {isPositive ? (
            <ArrowUpRight className="h-3.5 w-3.5" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5" />
          )}
          <span className="font-medium">{Math.abs(change).toFixed(1)}%</span>
          <span className="text-[var(--muted-foreground)]">{comparisonLabel}</span>
        </div>
      </CardContent>
    </Card>
  )
}
