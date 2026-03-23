'use client'

import Link from 'next/link'
import {
  Building2,
  MapPin,
  Receipt,
  Monitor,
  Shield,
  ToggleLeft,
  Calculator,
  ChefHat,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const settingsLinks = [
  {
    href: '/settings/organization',
    icon: Building2,
    label: 'Organization',
    description: 'Business name, contact info, timezone',
  },
  {
    href: '/settings/locations',
    icon: MapPin,
    label: 'Locations',
    description: 'Manage restaurant locations',
  },
  {
    href: '/settings/tax-rates',
    icon: Receipt,
    label: 'Tax Rates',
    description: 'Configure tax rates by location',
  },
  {
    href: '/settings/terminals',
    icon: Monitor,
    label: 'Terminals',
    description: 'Register and manage POS terminals',
  },
  {
    href: '/settings/roles',
    icon: Shield,
    label: 'Roles & Permissions',
    description: 'Staff roles and access control',
  },
  {
    href: '/settings/modules',
    icon: ToggleLeft,
    label: 'Modules',
    description: 'Enable or disable system modules',
  },
  {
    href: '/settings/accounting',
    icon: Calculator,
    label: 'Accounting',
    description: 'QuickBooks integration',
  },
  {
    href: '/settings/kds',
    icon: ChefHat,
    label: 'KDS Stations',
    description: 'Kitchen display, aging thresholds, printer failover',
  },
]

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your restaurant configuration</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {settingsLinks.map(({ href, icon: Icon, label, description }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'btn-press flex items-start gap-4 rounded-2xl border bg-white p-5 transition-all',
              'border-[var(--border)] shadow-warm-sm hover:shadow-warm-md'
            )}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]">
              <Icon className="h-5 w-5 text-[var(--primary)]" />
            </div>
            <div>
              <p className="text-headline text-foreground">{label}</p>
              <p className="text-footnote text-muted-foreground mt-0.5">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
