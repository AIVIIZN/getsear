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
  CreditCard,
  ChefHat,
  Plug2,
  Sparkles,
  Lock,
  Printer,
  ShieldCheck,
} from 'lucide-react'
import { Card } from '@/components/ui-v2/Card'

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
    href: '/settings/printers',
    icon: Printer,
    label: 'Printers',
    description: 'Configure receipt and kitchen printers',
  },
  {
    href: '/settings/hardware-readiness',
    icon: ShieldCheck,
    label: 'Hardware Readiness',
    description: 'Verify printers, cash drawer, and payment terminal checks',
  },
  {
    href: '/settings/kds',
    icon: ChefHat,
    label: 'KDS Stations',
    description: 'Kitchen display, aging thresholds, printer failover',
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
    href: '/settings/billing',
    icon: CreditCard,
    label: 'Billing',
    description: 'Trial, subscription tier, and feature access',
  },
  {
    href: '/settings/ai',
    icon: Sparkles,
    label: 'AI Intelligence',
    description: 'Sear Ask, Insights, and Predictions',
  },
  {
    href: '/settings/security',
    icon: Lock,
    label: 'Security',
    description: 'Two-factor auth and account security',
  },
  {
    href: '/settings/integrations',
    icon: Plug2,
    label: 'Integrations',
    description: 'SMS, email, QuickBooks, and webhook integrations',
  },
]

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      <div>
        <h1 className="text-[length:var(--type-title-1-size)] font-[var(--weight-semibold)] leading-[var(--type-line-height-snug)] text-[color:var(--color-text)]">
          Settings
        </h1>
        <p className="mt-[var(--space-1)] text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
          Manage your restaurant configuration
        </p>
      </div>

      <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2 lg:grid-cols-3">
        {settingsLinks.map(({ href, icon: Icon, label, description }) => (
          <Link key={href} href={href} className="block">
            <Card
              variant="interactive"
              padding="default"
              className="flex-row items-start gap-[var(--space-4)]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[color:var(--color-sidebar-active)]">
                <Icon className="h-5 w-5 text-[color:var(--color-primary)]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[length:var(--type-headline-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
                  {label}
                </p>
                <p className="mt-[2px] text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
                  {description}
                </p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
