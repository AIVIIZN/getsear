'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, DollarSign, Users, ChefHat, UserCheck } from 'lucide-react'

const REPORT_TABS = [
  { label: 'Dashboard', href: '/reports', icon: BarChart3 },
  { label: 'Sales', href: '/reports/sales', icon: DollarSign },
  { label: 'Labor', href: '/reports/labor', icon: Users },
  { label: 'Product Mix', href: '/reports/product-mix', icon: ChefHat },
  { label: 'Server Performance', href: '/reports/server-performance', icon: UserCheck },
]

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-full">
      {/* Tab Navigation */}
      <div className="border-b border-[var(--border)] bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-1 -mb-px">
            {REPORT_TABS.map((tab) => {
              const isActive = tab.href === '/reports'
                ? pathname === '/reports'
                : pathname.startsWith(tab.href)
              const Icon = tab.icon
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-[var(--primary)] text-[var(--primary)]'
                      : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--border)]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Page Content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
