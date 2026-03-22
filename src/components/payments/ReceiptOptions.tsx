'use client'

import { Printer, Mail, MessageSquare, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ReceiptChoice = 'print' | 'email' | 'text' | 'none'

interface ReceiptOptionsProps {
  onSelect: (choice: ReceiptChoice) => void
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

export function ReceiptOptions({ onSelect }: ReceiptOptionsProps) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-center text-xl font-bold text-foreground">Receipt?</h2>

      <div className="grid grid-cols-2 gap-4">
        {OPTIONS.map((option) => {
          const Icon = option.icon
          return (
            <button
              key={option.id}
              onClick={() => onSelect(option.id)}
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
