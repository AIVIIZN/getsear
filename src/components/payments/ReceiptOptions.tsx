'use client'

import { useState } from 'react'
import { Printer, Mail, MessageSquare, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ReceiptChoice = 'print' | 'email' | 'text' | 'none'
export interface ReceiptCapturePayload {
  email?: string
  phone?: string
  consent: {
    email_receipts: boolean
    sms_receipts: boolean
    marketing_email: boolean
    marketing_sms: boolean
    loyalty_signup: boolean
  }
}

interface ReceiptOptionsProps {
  defaultEmail?: string | null
  defaultPhone?: string | null
  onSelect: (choice: ReceiptChoice, payload: ReceiptCapturePayload) => void
}

const OPTIONS: Array<{
  id: ReceiptChoice
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}> = [
  {
    id: 'print',
    label: 'Print',
    icon: Printer,
    color: 'bg-blue-50 text-blue-700 ring-blue-200',
  },
  {
    id: 'email',
    label: 'Email',
    icon: Mail,
    color: 'bg-green-50 text-green-700 ring-green-200',
  },
  {
    id: 'text',
    label: 'Text',
    icon: MessageSquare,
    color: 'bg-purple-50 text-purple-700 ring-purple-200',
  },
  {
    id: 'none',
    label: 'No Receipt',
    icon: X,
    color: 'bg-secondary text-muted-foreground ring-border',
  },
]

export function ReceiptOptions({ defaultEmail, defaultPhone, onSelect }: ReceiptOptionsProps) {
  const [email, setEmail] = useState(defaultEmail ?? '')
  const [phone, setPhone] = useState(defaultPhone ?? '')
  const [marketingEmail, setMarketingEmail] = useState(false)
  const [marketingSms, setMarketingSms] = useState(false)
  const [loyaltySignup, setLoyaltySignup] = useState(false)

  function buildPayload(choice: ReceiptChoice): ReceiptCapturePayload {
    return {
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      consent: {
        email_receipts: choice === 'email' && Boolean(email.trim()),
        sms_receipts: choice === 'text' && Boolean(phone.trim()),
        marketing_email: marketingEmail && Boolean(email.trim()),
        marketing_sms: marketingSms && Boolean(phone.trim()),
        loyalty_signup: loyaltySignup,
      },
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-center text-xl font-bold text-foreground">Receipt?</h2>

      <div className="space-y-3 rounded-xl border border-border bg-secondary/50 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
              placeholder="guest@example.com"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Phone</span>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
              placeholder="(555) 555-1212"
            />
          </label>
        </div>
        <div className="grid gap-2 text-sm text-foreground">
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={loyaltySignup} onChange={(event) => setLoyaltySignup(event.target.checked)} />
            Add rewards signup to receipt
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={marketingEmail} onChange={(event) => setMarketingEmail(event.target.checked)} disabled={!email.trim()} />
            Email offers and updates
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={marketingSms} onChange={(event) => setMarketingSms(event.target.checked)} disabled={!phone.trim()} />
            Text offers and updates
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {OPTIONS.map((option) => {
          const Icon = option.icon
          return (
            <button
              key={option.id}
              onClick={() => onSelect(option.id, buildPayload(option.id))}
              className={cn(
                'btn-press touch-target-lg flex flex-col items-center justify-center gap-3',
                'rounded-xl p-6 ring-1 transition-all',
                'min-h-[100px] cursor-pointer',
                'hover:shadow-warm-md hover:scale-[1.02]',
                'active:scale-[0.97]',
                option.color
              )}
            >
              <Icon className="size-7" />
              <span className="text-sm font-semibold">{option.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
