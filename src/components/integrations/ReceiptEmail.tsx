'use client'

import { renderReceiptEmail, type ReceiptData } from '@/lib/integrations/email-templates'
import { EmailTemplatePreview } from './EmailTemplatePreview'

interface ReceiptEmailProps {
  data?: ReceiptData
  className?: string
}

const SAMPLE_RECEIPT: ReceiptData = {
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
  feedbackUrl: 'https://getsear.com/feedback/1047',
}

export function ReceiptEmail({ data, className }: ReceiptEmailProps) {
  const receiptData = data ?? SAMPLE_RECEIPT
  const { subject, html } = renderReceiptEmail(receiptData)

  return (
    <EmailTemplatePreview
      html={html}
      subject={subject}
      className={className}
    />
  )
}
