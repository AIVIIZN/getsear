'use client'

import Link from 'next/link'
import { MessageSquare, Mail, BookOpen, Webhook, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const integrations = [
  {
    href: '/settings/integrations/sms',
    icon: MessageSquare,
    label: 'SMS (Twilio)',
    description: 'Order-ready notifications, reservation reminders, waitlist alerts, and marketing messages.',
    color: 'bg-[#F22F46]/10',
    iconColor: 'text-[#F22F46]',
  },
  {
    href: '/settings/integrations/email',
    icon: Mail,
    label: 'Email (SendGrid)',
    description: 'Email receipts, daily reports, marketing campaigns, password resets, and welcome emails.',
    color: 'bg-[#1A82E2]/10',
    iconColor: 'text-[#1A82E2]',
  },
  {
    href: '/settings/integrations/quickbooks',
    icon: BookOpen,
    label: 'QuickBooks Online',
    description: 'Automatic daily sales sync with journal entries, chart of accounts mapping, and reconciliation.',
    color: 'bg-[#2CA01C]/10',
    iconColor: 'text-[#2CA01C]',
  },
  {
    href: '/settings/integrations/webhooks',
    icon: Webhook,
    label: 'Webhooks',
    description: 'Send real-time event notifications to third-party systems with HMAC-SHA256 signatures.',
    color: 'bg-[var(--primary)]/10',
    iconColor: 'text-[var(--primary)]',
  },
]

export default function IntegrationsHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Integrations</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect third-party services to extend your POS capabilities.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {integrations.map(({ href, icon: Icon, label, description, color, iconColor }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'group flex items-start gap-4 rounded-2xl border bg-white p-5 transition-all',
              'border-[var(--border)] shadow-sm hover:shadow-md hover:border-[var(--border-hover)]'
            )}
          >
            <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', color)}>
              <Icon className={cn('h-6 w-6', iconColor)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
