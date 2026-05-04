'use client'

import { Card } from '@/components/ui-v2/Card'
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

  const borderColor = health ? HEALTH_COLORS[health] : isGood ? 'var(--color-success)' : 'var(--color-danger)'

  return (
    <Card padding="default" className="overflow-hidden p-0">
      <div className="h-1" style={{ backgroundColor: borderColor }} />
      <div className="p-[var(--space-5)]">
        <div className="flex items-center justify-between mb-[var(--space-2)]">
          <span className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">{label}</span>
          <div className="flex items-center justify-center w-8 h-8 rounded-[var(--radius-sm)] bg-[color:var(--color-bg-muted)]">
            <Icon className="h-4 w-4 text-[color:var(--color-text-muted)]" />
          </div>
        </div>
        <div className="text-[28px] font-[var(--weight-bold)] tabular-nums leading-tight">
          {prefix}{value}{suffix}
        </div>
        <div className={`flex items-center gap-[var(--space-1)] text-[length:var(--type-caption-1-size)] mt-[var(--space-2)] ${isGood ? 'text-[color:var(--color-success)]' : 'text-[color:var(--color-danger)]'}`}>
          {isPositive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          <span className="font-[var(--weight-medium)]">{Math.abs(change).toFixed(1)}%</span>
          <span className="text-[color:var(--color-text-muted)]">{comparisonLabel}</span>
        </div>
      </div>
    </Card>
  )
}
