'use client'

import { Users } from 'lucide-react'
import { OnDutyCard } from './OnDutyCard'
import { EmptyState } from '@/components/shared/EmptyState'
import type { OnDutyEmployee } from '@/stores/staff-store'

interface OnDutyBoardProps {
  employees: OnDutyEmployee[]
  onStartBreak: (userId: string) => void
  onEndBreak: (userId: string) => void
  onClockOut: (userId: string) => void
}

export function OnDutyBoard({
  employees,
  onStartBreak,
  onEndBreak,
  onClockOut,
}: OnDutyBoardProps) {
  if (employees.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No one is clocked in"
        description="Employees clock in from the POS terminal or the clock-in button above."
      />
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <h3 className="text-sm font-semibold text-foreground">
          On Duty Now ({employees.length})
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {employees.map((emp) => (
          <OnDutyCard
            key={emp.userId}
            userId={emp.userId}
            firstName={emp.firstName}
            lastName={emp.lastName}
            role={emp.role}
            clockIn={emp.clockIn}
            isOnBreak={emp.isOnBreak}
            breakStartedAt={emp.breakStartedAt}
            isInOvertime={emp.isInOvertime}
            isApproachingOt={emp.isApproachingOt}
            hoursUntilOt={emp.hoursUntilOt}
            onStartBreak={onStartBreak}
            onEndBreak={onEndBreak}
            onClockOut={onClockOut}
          />
        ))}
      </div>
    </div>
  )
}
