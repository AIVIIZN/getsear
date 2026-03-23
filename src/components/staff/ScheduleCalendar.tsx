'use client'

import { Plus, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/EmptyState'
import { ShiftBlock } from './ShiftBlock'
import type { ScheduleShift } from '@/stores/schedule-store'
import type { StaffMember } from '@/stores/staff-store'

interface ScheduleCalendarProps {
  weekStart: string
  shifts: ScheduleShift[]
  staff: StaffMember[]
  onShiftClick: (shift: ScheduleShift) => void
  onAddShift: (date: string) => void
}

function getDatesForWeek(weekStart: string): string[] {
  const dates: string[] = []
  const d = new Date(weekStart + 'T12:00:00')
  for (let i = 0; i < 7; i++) {
    dates.push(d.toISOString().split('T')[0])
    d.setDate(d.getDate() + 1)
  }
  return dates
}

function formatDayHeader(dateStr: string): { day: string; date: string } {
  const d = new Date(dateStr + 'T12:00:00')
  return {
    day: d.toLocaleDateString('en-US', { weekday: 'short' }),
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }
}

// Group shifts by role for display
function groupByRole(shifts: ScheduleShift[]): Map<string, ScheduleShift[]> {
  const grouped = new Map<string, ScheduleShift[]>()
  for (const shift of shifts) {
    const existing = grouped.get(shift.role) ?? []
    existing.push(shift)
    grouped.set(shift.role, existing)
  }
  return grouped
}

export function ScheduleCalendar({
  weekStart,
  shifts,
  staff,
  onShiftClick,
  onAddShift,
}: ScheduleCalendarProps) {
  const dates = getDatesForWeek(weekStart)

  if (shifts.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title="No shifts scheduled"
        description="No shifts scheduled for this week. Create your first shift or apply a template."
        actionLabel="Add Shift"
        onAction={() => onAddShift(dates[0])}
      />
    )
  }

  // Get all unique roles from shifts
  const roles = [...new Set(shifts.map((s) => s.role))].sort()

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-8 bg-muted/50 border-b border-border">
        <div className="p-2 text-xs font-semibold text-muted-foreground border-r border-border">
          Role
        </div>
        {dates.map((dateStr) => {
          const { day, date } = formatDayHeader(dateStr)
          const isToday = dateStr === new Date().toISOString().split('T')[0]
          return (
            <div
              key={dateStr}
              className={`p-2 text-center border-r border-border last:border-r-0 ${isToday ? 'bg-primary/5' : ''}`}
            >
              <p className="text-xs font-semibold text-foreground">{day}</p>
              <p className={`text-[10px] ${isToday ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                {date}
              </p>
            </div>
          )
        })}
      </div>

      {/* Body: one row per role */}
      {roles.map((role) => (
        <div key={role} className="grid grid-cols-8 border-b border-border last:border-b-0">
          <div className="p-2 text-xs font-medium text-foreground capitalize border-r border-border flex items-start">
            {role}
          </div>
          {dates.map((dateStr) => {
            const dayShifts = shifts.filter((s) => s.date === dateStr && s.role === role)
            const isToday = dateStr === new Date().toISOString().split('T')[0]
            return (
              <div
                key={dateStr}
                className={`p-1 border-r border-border last:border-r-0 min-h-[60px] ${isToday ? 'bg-primary/5' : ''}`}
              >
                <div className="space-y-1">
                  {dayShifts.map((shift) => (
                    <ShiftBlock
                      key={shift.id}
                      startTime={shift.startTime}
                      endTime={shift.endTime}
                      role={shift.role}
                      employeeName={shift.employeeName}
                      isOpen={!shift.userId}
                      onClick={() => onShiftClick(shift)}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => onAddShift(dateStr)}
                    className="w-full flex items-center justify-center h-5 rounded border border-dashed border-border opacity-0 hover:opacity-100 transition-opacity"
                  >
                    <Plus className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
