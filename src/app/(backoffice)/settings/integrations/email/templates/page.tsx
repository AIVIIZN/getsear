'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmailTemplatePreview } from '@/components/integrations/EmailTemplatePreview'
import {
  renderReceiptEmail,
  renderDailyReportEmail,
  renderPasswordResetEmail,
  renderWelcomeEmail,
  renderMarketingEmail,
  type EmailTemplateType,
} from '@/lib/integrations/email-templates'

interface TemplatePreview {
  type: EmailTemplateType
  name: string
  description: string
}

const TEMPLATE_LIST: TemplatePreview[] = [
  { type: 'receipt', name: 'Receipt', description: 'Itemized order receipt sent after payment' },
  { type: 'daily_report', name: 'Daily Summary Report', description: 'Revenue, orders, and metrics summary' },
  { type: 'marketing', name: 'Marketing Campaign', description: 'Promotional email with CAN-SPAM compliance' },
  { type: 'password_reset', name: 'Password Reset', description: 'Secure password reset link' },
  { type: 'welcome', name: 'Welcome Email', description: 'Sent to new online ordering customers' },
]

function getSampleHtml(type: EmailTemplateType): { subject: string; html: string } {
  switch (type) {
    case 'receipt':
      return renderReceiptEmail({
        locationName: 'Sear Grill Downtown',
        locationAddress: '123 Main St, Austin, TX 78701',
        orderNumber: '1047',
        orderDate: 'March 22, 2026 7:45 PM',
        items: [
          { name: 'Wagyu Burger', quantity: 2, modifiers: ['Medium Rare', 'Extra Bacon'], price: 1800 },
          { name: 'Caesar Salad', quantity: 1, price: 550 },
          { name: 'IPA Draft', quantity: 2, price: 700 },
        ],
        subtotal: 4150,
        tax: 332,
        tip: 300,
        total: 4782,
        paymentMethod: 'Visa',
        lastFour: '4242',
        customerName: 'John Smith',
        serverName: 'Maria R.',
        feedbackUrl: '#',
      })
    case 'daily_report':
      return renderDailyReportEmail({
        locationName: 'Sear Grill Downtown',
        businessDate: 'March 22, 2026',
        totalRevenue: 4250,
        orderCount: 87,
        averageCheck: 48.85,
        laborPct: 28.3,
        foodCostPct: 31.2,
        prevWeekRevenue: 3980,
        revenueChangePct: 6.8,
        appUrl: '#',
      })
    case 'password_reset':
      return renderPasswordResetEmail({
        resetUrl: '#',
        expiresIn: '1 hour',
      })
    case 'welcome':
      return renderWelcomeEmail({
        customerName: 'Sarah Johnson',
        locationName: 'Sear Grill Downtown',
        locationAddress: '123 Main St, Austin, TX 78701',
        loyaltyEnabled: true,
        orderUrl: '#',
      })
    case 'marketing': {
      const { html } = renderMarketingEmail({
        locationName: 'Sear Grill Downtown',
        locationAddress: '123 Main St, Austin, TX 78701',
        bodyHtml:
          '<h2>Weekend Special!</h2><p>Join us this Saturday for our famous wagyu tasting menu. Reserve your table now and enjoy 20% off your first bottle of wine.</p>',
        ctaText: 'Reserve Now',
        ctaUrl: '#',
        unsubscribeUrl: '#',
      })
      return { subject: 'Weekend Special at Sear Grill!', html }
    }
    default:
      return { subject: '', html: '' }
  }
}

export default function EmailTemplatesPage() {
  const [activeTemplate, setActiveTemplate] = useState<EmailTemplateType>('receipt')
  const preview = getSampleHtml(activeTemplate)

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      {/* Header */}
      <div className="flex items-center gap-[var(--space-3)]">
        <Link
          href="/settings/integrations/email"
          className="btn-press touch-target flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:bg-[color:var(--color-surface-hover)]"
          aria-label="Back to email integration"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h2 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
            Email Templates
          </h2>
          <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
            Preview and customize email templates
          </p>
        </div>
      </div>

      <div className="flex gap-[var(--space-6)]">
        {/* Template list */}
        <div className="flex w-[224px] shrink-0 flex-col gap-[var(--space-1)]">
          {TEMPLATE_LIST.map((t) => (
            <button
              key={t.type}
              onClick={() => setActiveTemplate(t.type)}
              className={cn(
                'btn-press touch-target flex w-full flex-col items-start',
                'rounded-[var(--radius-sm)] px-[var(--space-3)] py-[var(--space-2)] text-left',
                'transition-colors duration-[var(--duration-quick)] ease-[var(--ease-out)]',
                'focus-visible:outline-2 focus-visible:outline-[color:var(--color-border-focus)] focus-visible:outline-offset-2',
                activeTemplate === t.type
                  ? 'bg-[color:var(--color-sidebar-active)] text-[color:var(--color-primary)]'
                  : 'text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-sidebar)] hover:text-[color:var(--color-text)]',
              )}
            >
              <span className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)]">
                {t.name}
              </span>
              <span className="mt-[2px] text-[length:var(--type-footnote-size)] opacity-70">
                {t.description}
              </span>
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className="min-w-0 flex-1">
          <EmailTemplatePreview html={preview.html} subject={preview.subject} />
        </div>
      </div>
    </div>
  )
}
