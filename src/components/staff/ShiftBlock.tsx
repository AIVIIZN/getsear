'use client'

import { GripVertical } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const ROLE_COLORS: Record<string, string> = {
  server: 'bg-blue-100 border-blue-300 text-blue-800',
  bartender: 'bg-purple-100 border-purple-300 text-purple-800',
  host: 'bg-teal-100 border-teal-300 text-teal-800',
  kitchen: 'bg-orange-100 border-orange-300 text-orange-800',
  cashier: 'bg-emerald-100 border-emerald-300 text-emerald-800',
  driver: 'bg-indigo-100 border-indigo-300 text-indigo-800',
  manager: 'bg-amber-100 border-amber-300 text-amber-800',
}

interface ShiftBlockProps {
  startTime: string
  endTime: string
  role: string
  employeeName: string | null
  isOpen: boolean
  onClick: () => void
  isDragging?: boolean
}

function formatShiftTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function ShiftBlock({
  startTime,
  endTime,
  role,
  employeeName,
  isOpen,
  onClick,
  isDragging,
}: ShiftBlockProps) {
  const colors = ROLE_COLORS[role] ?? 'bg-gray-100 border-gray-300 text-gray-800'

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative rounded-md border px-2 py-1.5 cursor-pointer transition-all',
        'hover:shadow-sm active:scale-[0.98]',
        colors,
        isDragging && 'opacity-50 shadow-lg',
        isOpen && 'border-dashed opacity-70'
      )}
    >
      {/* Drag handle */}
      <div className="absolute left-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="h-3 w-3" />
      </div>

      <div className="pl-3">
        <p className="text-xs font-semibold truncate leading-tight">
          {isOpen ? 'Open Shift' : employeeName ?? 'Unassigned'}
        </p>
        <p className="text-[10px] opacity-80 font-mono">
          {formatShiftTime(startTime)} - {formatShiftTime(endTime)}
        </p>
      </div>
    </div>
  )
}
