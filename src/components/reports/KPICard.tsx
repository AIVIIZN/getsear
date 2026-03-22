'use client'

import { Card, CardContent } from '@/components/ui/card'
import { ArrowUpRight, ArrowDownRight, type LucideIcon } from 'lucide-react'

interface KPICardProps {
  label: string
  value: string
  change: number // percentage change vs previous period
  icon: LucideIcon
  prefix?: string
  suffix?: string
}

export function KPICard({ label, value, change, icon: Icon, prefix = '', suffix = '' }: KPICardProps) {
  const isPositive = change >= 0
  // For labor %, down is good
  const isLaborMetric = label.toLowerCase().includes('labor')
  const isGood = isLaborMetric ? !isPositive : isPositive

  return (
    <Card className="shadow-warm-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-[var(--muted-foreground)]">{label}</span>
          <Icon className="h-4 w-4 text-[var(--muted-foreground)]" />
        </div>
        <div className="text-2xl font-bold tabular-nums">
          {prefix}{value}{suffix}
        </div>
        <div className={`flex items-center gap-1 text-xs mt-1 ${isGood ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
          {isPositive ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownRight className="h-3 w-3" />
          )}
          {Math.abs(change).toFixed(1)}% vs yesterday
        </div>
      </CardContent>
    </Card>
  )
}
