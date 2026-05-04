'use client'

import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OwnerDashboardCardProps {
  label: string
  value: string
  icon: LucideIcon
  sublabel?: string
  color?: string
  onClick?: () => void
}

export function OwnerDashboardCard({ label, value, icon: Icon, sublabel, color, onClick }: OwnerDashboardCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'btn-press w-full rounded-[var(--radius-lg)] bg-[color:var(--color-surface)]',
        'p-[var(--space-5)] shadow-[var(--shadow-low)] hover:shadow-[var(--shadow-mid)]',
        'transition-shadow text-left',
      )}
      style={{ minHeight: 96, borderLeft: color ? `4px solid ${color}` : undefined }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[length:var(--type-caption-1-size)] font-[var(--weight-medium)] text-[color:var(--color-text-muted)] uppercase tracking-wide">{label}</p>
          <p className="text-[length:var(--type-title-1-size)] font-[var(--weight-bold)] mt-[var(--space-1)] tabular-nums" style={{ color: color ?? 'var(--color-text)' }}>
            {value}
          </p>
          {sublabel && (
            <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mt-[var(--space-1)]">{sublabel}</p>
          )}
        </div>
        <Icon className="h-6 w-6 text-[color:var(--color-text-muted)]" />
      </div>
    </button>
  )
}
