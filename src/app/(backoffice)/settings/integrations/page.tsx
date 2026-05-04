'use client'

import Link from 'next/link'
import { MessageSquare, Mail, BookOpen, Webhook, ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui-v2/Card'

const integrations = [
  {
    href: '/settings/integrations/sms',
    icon: MessageSquare,
    label: 'SMS (Twilio)',
    description:
      'Order-ready notifications, reservation reminders, waitlist alerts, and marketing messages.',
  },
  {
    href: '/settings/integrations/email',
    icon: Mail,
    label: 'Email (SendGrid)',
    description:
      'Email receipts, daily reports, marketing campaigns, password resets, and welcome emails.',
  },
  {
    href: '/settings/integrations/quickbooks',
    icon: BookOpen,
    label: 'QuickBooks Online',
    description:
      'Automatic daily sales sync with journal entries, chart of accounts mapping, and reconciliation.',
  },
  {
    href: '/settings/integrations/webhooks',
    icon: Webhook,
    label: 'Webhooks',
    description:
      'Send real-time event notifications to third-party systems with HMAC-SHA256 signatures.',
  },
]

export default function IntegrationsHubPage() {
  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      <div>
        <h2 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
          Integrations
        </h2>
        <p className="mt-[var(--space-1)] text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
          Connect third-party services to extend your POS capabilities.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-[var(--space-4)] lg:grid-cols-2">
        {integrations.map(({ href, icon: Icon, label, description }) => (
          <Link key={href} href={href} className="group block">
            <Card
              variant="interactive"
              padding="default"
              className="flex-row items-start gap-[var(--space-4)]"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[color:var(--color-sidebar-active)]">
                <Icon className="h-6 w-6 text-[color:var(--color-primary)]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-[length:var(--type-headline-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
                    {label}
                  </p>
                  <ArrowRight className="h-4 w-4 text-[color:var(--color-text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <p className="mt-[var(--space-1)] text-[length:var(--type-footnote-size)] leading-[var(--type-line-height-relaxed)] text-[color:var(--color-text-muted)]">
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
