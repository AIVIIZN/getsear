'use client'

import { type LucideIcon } from 'lucide-react'

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
      className="w-full rounded-2xl bg-white p-5 shadow-warm-sm active:scale-[0.98] transition-transform text-left"
      style={{ minHeight: 96, borderLeft: color ? `4px solid ${color}` : undefined }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">{label}</p>
          <p className="text-3xl font-extrabold mt-1 tabular-nums" style={{ color: color ?? 'var(--foreground)' }}>
            {value}
          </p>
          {sublabel && (
            <p className="text-xs text-[var(--muted-foreground)] mt-1">{sublabel}</p>
          )}
        </div>
        <Icon className="h-6 w-6 text-[var(--muted-foreground)]" />
      </div>
    </button>
  )
}
