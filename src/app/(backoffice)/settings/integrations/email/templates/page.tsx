'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmailTemplatePreview } from '@/components/integrations/EmailTemplatePreview'
import { ReceiptEmail } from '@/components/integrations/ReceiptEmail'
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
  color: string
}

const TEMPLATE_LIST: TemplatePreview[] = [
  { type: 'receipt', name: 'Receipt', description: 'Itemized order receipt sent after payment', color: 'bg-[var(--success-bg)]' },
  { type: 'daily_report', name: 'Daily Summary Report', description: 'Revenue, orders, and metrics summary', color: 'bg-[var(--info-bg)]' },
  { type: 'marketing', name: 'Marketing Campaign', description: 'Promotional email with CAN-SPAM compliance', color: 'bg-[var(--warning-bg)]' },
  { type: 'password_reset', name: 'Password Reset', description: 'Secure password reset link', color: 'bg-[var(--error-bg)]' },
  { type: 'welcome', name: 'Welcome Email', description: 'Sent to new online ordering customers', color: 'bg-[var(--accent)]' },
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
        bodyHtml: '<h2>Weekend Special!</h2><p>Join us this Saturday for our famous wagyu tasting menu. Reserve your table now and enjoy 20% off your first bottle of wine.</p>',
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/settings/integrations/email"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white hover:bg-[var(--secondary)] transition-colors touch-target"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Email Templates</h2>
          <p className="text-sm text-muted-foreground">Preview and customize email templates</p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Template list */}
        <div className="w-56 shrink-0 space-y-1">
          {TEMPLATE_LIST.map((t) => (
            <button
              key={t.type}
              onClick={() => setActiveTemplate(t.type)}
              className={cn(
                'flex w-full flex-col items-start rounded-lg px-3 py-2.5 text-left transition-colors touch-target',
                activeTemplate === t.type
                  ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                  : 'text-muted-foreground hover:bg-[var(--secondary)] hover:text-foreground'
              )}
            >
              <span className="text-sm font-medium">{t.name}</span>
              <span className="text-xs opacity-70 mt-0.5">{t.description}</span>
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className="flex-1 min-w-0">
          <EmailTemplatePreview
            html={preview.html}
            subject={preview.subject}
          />
        </div>
      </div>
    </div>
  )
}
