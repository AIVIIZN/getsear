'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import {
  DollarSign, CreditCard, Banknote, Receipt, Timer, ChefHat,
  TrendingUp, AlertTriangle, Users, UserCheck, LineChart, Salad,
} from 'lucide-react'

const ICON_MAP: Record<string, React.ElementType> = {
  DollarSign, CreditCard, Banknote, Receipt, Timer, ChefHat,
  TrendingUp, AlertTriangle, Users, UserCheck, LineChart, Salad,
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
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="text-[var(--primary)]">
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
    <Link href={href}>
      <Card className="shadow-warm-sm hover:shadow-warm-md transition-all duration-200 cursor-pointer group h-full">
        <CardContent className="p-5 flex flex-col justify-between h-full">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--accent)] group-hover:bg-[var(--primary)] transition-colors">
                <Icon className="h-5 w-5 text-[var(--primary)] group-hover:text-white transition-colors" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors">
                  {name}
                </h3>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5 line-clamp-1">
                  {description}
                </p>
              </div>
            </div>
          </div>
          {sparklineData && sparklineData.length > 1 && (
            <div className="mt-3 pt-3 border-t border-[var(--border)]">
              <Sparkline data={sparklineData} />
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
