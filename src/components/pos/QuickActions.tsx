'use client'

import { PauseCircle, Flame, Zap, Percent, Printer, XCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface QuickActionsProps {
  onHold: () => void
  onFireCourse: () => void
  onRush: () => void
  onDiscount: () => void
  onPrint: () => void
  onVoid: () => void
  disabled?: boolean
}

const ACTIONS = [
  { id: 'hold', icon: PauseCircle, label: 'Hold', color: 'text-[var(--warning)]' },
  { id: 'fire', icon: Flame, label: 'Fire Course', color: 'text-[var(--primary)]' },
  { id: 'rush', icon: Zap, label: 'Rush', color: 'text-[var(--error)]' },
  { id: 'discount', icon: Percent, label: 'Discount', color: 'text-[var(--info)]' },
  { id: 'print', icon: Printer, label: 'Print', color: 'text-[var(--muted-foreground)]' },
  { id: 'void', icon: XCircle, label: 'Void', color: 'text-[var(--destructive)]' },
] as const

export function QuickActions({
  onHold,
  onFireCourse,
  onRush,
  onDiscount,
  onPrint,
  onVoid,
  disabled = false,
}: QuickActionsProps) {
  const handlers: Record<string, () => void> = {
    hold: onHold,
    fire: onFireCourse,
    rush: onRush,
    discount: onDiscount,
    print: onPrint,
    void: onVoid,
  }

  return (
    <TooltipProvider delay={300}>
      <div className="flex w-16 flex-col items-center gap-1 border-l border-border bg-white py-3">
        {ACTIONS.map(({ id, icon: Icon, label, color }) => (
          <Tooltip key={id}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={handlers[id]}
                  disabled={disabled}
                  className={cn(
                    'btn-press flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-150',
                    'hover:bg-[var(--muted)] active:bg-[var(--secondary)]',
                    'disabled:opacity-30 disabled:cursor-not-allowed',
                    color
                  )}
                />
              }
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} />
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs">
              {label}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  )
}
