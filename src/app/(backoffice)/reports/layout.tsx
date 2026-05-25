'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  BarChart3, DollarSign, Users, ChefHat, UserCheck,
  CreditCard, Banknote, Receipt, Timer, AlertTriangle,
  TrendingUp, LineChart, Salad, LayoutDashboard,
} from 'lucide-react'

const REPORT_TABS = [
  { label: 'Hub', href: '/reports', icon: BarChart3 },
  { label: 'Sales', href: '/reports/sales', icon: DollarSign },
  { label: 'Payments', href: '/reports/payments', icon: CreditCard },
  { label: 'Cash', href: '/reports/cash', icon: Banknote },
  { label: 'Tax', href: '/reports/tax', icon: Receipt },
  { label: 'Speed', href: '/reports/speed-of-service', icon: Timer },
  { label: 'PMIX', href: '/reports/product-mix', icon: ChefHat },
  { label: 'Food Cost', href: '/reports/food-cost', icon: Salad },
  { label: 'P&L', href: '/reports/pnl', icon: TrendingUp },
  { label: 'Voids', href: '/reports/voids-comps', icon: AlertTriangle },
  { label: 'Labor', href: '/reports/labor', icon: Users },
  { label: 'Servers', href: '/reports/server-performance', icon: UserCheck },
  { label: 'Trends', href: '/reports/trends', icon: LineChart },
  { label: 'Dashboard', href: '/reports/dashboard', icon: LayoutDashboard },
]

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
        <div className="max-w-7xl mx-auto px-[var(--space-6)]">
          <nav className="flex gap-0 -mb-px overflow-x-auto scrollbar-hide" aria-label="Report sections">
            {REPORT_TABS.map((tab) => {
              const isActive = tab.href === '/reports'
                ? pathname === '/reports'
                : pathname.startsWith(tab.href)
              const Icon = tab.icon
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    'flex items-center gap-[var(--space-1)] px-[var(--space-3)] py-[var(--space-3)]',
                    'text-[length:var(--type-caption-1-size)] font-[var(--weight-medium)]',
                    'border-b-2 transition-colors whitespace-nowrap shrink-0',
                    isActive
                      ? 'border-[color:var(--color-primary)] text-[color:var(--color-primary)]'
                      : 'border-transparent text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] hover:border-[color:var(--color-border)]'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
