'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { User } from 'lucide-react'

interface StaffMember {
  id: string
  display_name: string
  role: string
  avatar_color?: string
}

interface OrderTransferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentServerId: string
  currentServerName: string
  onTransfer: (newServerId: string, newServerName: string) => void
}

export function OrderTransferDialog({
  open,
  onOpenChange,
  currentServerId,
  currentServerName,
  onTransfer,
}: OrderTransferDialogProps) {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSelected(null)
    setLoading(true)
    fetch('/api/staff/active')
      .then((r) => r.json())
      .then((json) => setStaff(json.data ?? []))
      .catch(() => setStaff([]))
      .finally(() => setLoading(false))
  }, [open])

  const handleConfirm = useCallback(() => {
    if (!selected) return
    const member = staff.find((s) => s.id === selected)
    if (member) {
      onTransfer(member.id, member.display_name)
      onOpenChange(false)
    }
  }, [selected, staff, onTransfer, onOpenChange])

  const availableStaff = staff.filter((s) => s.id !== currentServerId)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-[400px]! flex flex-col" showCloseButton={false}>
        <SheetHeader className="border-b border-border pb-4">
          <SheetTitle className="text-lg">Transfer Order</SheetTitle>
          <SheetDescription>
            Current server: <span className="font-medium text-foreground">{currentServerName}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
            </div>
          ) : availableStaff.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No other active staff found
            </p>
          ) : (
            <div className="space-y-1.5">
              {availableStaff.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => setSelected(member.id)}
                  className={cn(
                    'btn-press touch-target-lg flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all duration-150',
                    selected === member.id
                      ? 'border-[var(--primary)] bg-[var(--accent)]'
                      : 'border-border bg-white hover:bg-[var(--secondary)]'
                  )}
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: member.avatar_color ?? 'var(--primary)' }}
                  >
                    {member.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {member.display_name}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <SheetFooter className="border-t border-border gap-3 pt-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="btn-press touch-target-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <Button
            onClick={handleConfirm}
            disabled={!selected}
            className="btn-press touch-target-lg flex-1 h-14 rounded-xl text-base font-semibold bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] disabled:opacity-40"
          >
            <User className="h-5 w-5 mr-2" />
            Transfer
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
