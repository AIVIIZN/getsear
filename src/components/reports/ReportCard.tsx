'use client'

import Link from 'next/link'
import { Card } from '@/components/ui-v2/Card'
import {
  DollarSign, CreditCard, Banknote, Receipt, Timer, ChefHat,
  TrendingUp, AlertTriangle, Users, UserCheck, LineChart, Salad, Sparkles,
} from 'lucide-react'

const ICON_MAP: Record<string, React.ElementType> = {
  DollarSign, CreditCard, Banknote, Receipt, Timer, ChefHat,
  TrendingUp, AlertTriangle, Users, UserCheck, LineChart, Salad, Sparkles,
}

interface ReportCardProps {
  name: string
  description: string
  href: string
  icon: string
  sparklineData?: number[]
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const width = 80
  const height = 28
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="text-[color:var(--color-primary)]">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ReportCard({ name, description, href, icon, sparklineData }: ReportCardProps) {
  const Icon = ICON_MAP[icon] ?? DollarSign

  return (
    <Link href={href} className="h-full block group">
      <Card variant="elevated" padding="default" className="h-full hover:shadow-[var(--shadow-mid)] transition-shadow">
        <div className="flex items-start justify-between gap-[var(--space-3)]">
          <div className="flex items-center gap-[var(--space-3)]">
            <div className="flex items-center justify-center w-10 h-10 rounded-[var(--radius-md)] bg-[color:var(--color-bg-muted)] group-hover:bg-[color:var(--color-primary)] transition-colors">
              <Icon className="h-5 w-5 text-[color:var(--color-primary)] group-hover:text-[color:var(--color-primary-fg)] transition-colors" />
            </div>
            <div>
              <h3 className="text-[length:var(--type-subhead-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)] group-hover:text-[color:var(--color-primary)] transition-colors">
                {name}
              </h3>
              <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mt-[var(--space-1)] line-clamp-1">
                {description}
              </p>
            </div>
          </div>
        </div>
        {sparklineData && sparklineData.length > 1 && (
          <div className="mt-[var(--space-3)] pt-[var(--space-3)] border-t border-[color:var(--color-border)]">
            <Sparkline data={sparklineData} />
          </div>
        )}
      </Card>
    </Link>
  )
}
