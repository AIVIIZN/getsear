'use client'

import {
  CreditCard,
  Banknote,
  Gift,
  Building2,
  SplitSquareHorizontal,
  Smartphone,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type PaymentMethodChoice =
  | 'credit_card'
  | 'cash'
  | 'gift_card'
  | 'house_account'
  | 'split'
  | 'digital_wallet'

interface PaymentMethodGridProps {
  onSelect: (method: PaymentMethodChoice) => void
}

const METHODS: Array<{
  id: PaymentMethodChoice
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}> = [
  {
    id: 'credit_card',
    label: 'Credit Card',
    icon: CreditCard,
    color: 'bg-blue-50 text-blue-700 ring-blue-200',
  },
  {
    id: 'cash',
    label: 'Cash',
    icon: Banknote,
    color: 'bg-green-50 text-green-700 ring-green-200',
  },
  {
    id: 'gift_card',
    label: 'Gift Card',
    icon: Gift,
    color: 'bg-purple-50 text-purple-700 ring-purple-200',
  },
  {
    id: 'house_account',
    label: 'House Account',
    icon: Building2,
    color: 'bg-amber-50 text-amber-700 ring-amber-200',
  },
  {
    id: 'split',
    label: 'Split Payment',
    icon: SplitSquareHorizontal,
    color: 'bg-orange-50 text-orange-700 ring-orange-200',
  },
  {
    id: 'digital_wallet',
    label: 'Apple / Google Pay',
    icon: Smartphone,
    color: 'bg-slate-50 text-slate-700 ring-slate-200',
  },
]

export function PaymentMethodGrid({ onSelect }: PaymentMethodGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {METHODS.map((method) => {
        const Icon = method.icon
        return (
          <button
            key={method.id}
            onClick={() => onSelect(method.id)}
            className={cn(
              'btn-press touch-target-lg flex flex-col items-center justify-center gap-3',
              'rounded-xl p-6 ring-1 transition-all',
              'min-h-[120px] cursor-pointer',
              'hover:shadow-warm-md hover:scale-[1.02]',
              'active:scale-[0.97]',
              method.color
            )}
          >
            <Icon className="size-8" />
            <span className="text-sm font-semibold">{method.label}</span>
          </button>
        )
      })}
    </div>
  )
}
