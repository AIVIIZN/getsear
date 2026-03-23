'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Separator } from '@/components/ui/separator'
import { OnDutyBoard } from './OnDutyBoard'
import { OvertimeBanner } from './OvertimeBanner'
import { BreakComplianceBanner } from './BreakComplianceBanner'
import { TimeEntryTable } from './TimeEntryTable'
import type { OnDutyEmployee, TimeEntryRow } from '@/stores/staff-store'

export function TimeClock() {
  const [onDuty, setOnDuty] = useState<OnDutyEmployee[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [otAlerts, setOtAlerts] = useState<{ userId: string; name: string; weeklyTotalHours: number; hoursUntilOt: number; isInOvertime: boolean }[]>([])
  const [breakAlerts, setBreakAlerts] = useState<{ userId: string; userName: string; type: 'pre_alert' | 'violation'; breakType: 'meal' | 'rest'; message: string; minutesUntilDeadline: number }[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Load active (clocked-in) entries
      const activeRes = await fetch('/api/staff/active')
      const activeJson = await activeRes.json()

      if (activeJson.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const employees: OnDutyEmployee[] = activeJson.data.map((e: any) => ({
          userId: e.user_id,
          firstName: e.first_name ?? 'Unknown',
          lastName: e.last_name ?? '',
          role: e.role_during_shift ?? e.role ?? 'staff',
          clockIn: e.clock_in,
          timeEntryId: e.id,
          isOnBreak: e.is_on_break ?? false,
          breakStartedAt: e.break_started_at ?? null,
          breakType: e.break_type ?? null,
          hoursWorked: 0,
          isInOvertime: false,
          isApproachingOt: false,
          hoursUntilOt: 40,
        }))
        setOnDuty(employees)
      }

      // Load time entries
      const entriesRes = await fetch('/api/staff/time-entries?limit=100')
      if (entriesRes.ok) {
        const entriesJson = await entriesRes.json()
        if (entriesJson.data) setTimeEntries(entriesJson.data)
      }

      // Load OT status
      const otRes = await fetch('/api/staff/overtime')
      if (otRes.ok) {
        const otJson = await otRes.json()
        if (otJson.data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const alerts = otJson.data.filter((o: any) => o.isInOvertime || o.isApproachingWeeklyOt)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((o: any) => ({
              userId: o.userId,
              name: activeJson.data?.find(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (e: any) => e.user_id === o.userId
              )?.first_name ?? 'Employee',
              weeklyTotalHours: o.weeklyTotalHours,
              hoursUntilOt: o.hoursUntilWeeklyOt,
              isInOvertime: o.isInOvertime,
            }))
          setOtAlerts(alerts)
        }
      }

      // Load break compliance
      const breakRes = await fetch('/api/staff/break-compliance')
      if (breakRes.ok) {
        const breakJson = await breakRes.json()
        if (breakJson.data?.alerts) setBreakAlerts(breakJson.data.alerts)
      }
    } catch {
      // silent — data may not be available yet
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    // Refresh every 30 seconds for live updates
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [loadData])

  const handleStartBreak = async (userId: string) => {
    try {
      const res = await fetch(`/api/staff/${userId}/break-start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ break_type: 'meal' }),
      })
      if (res.ok) {
        toast.success('Break started')
        loadData()
      } else {
        const json = await res.json()
        toast.error(json.error ?? 'Failed to start break')
      }
    } catch {
      toast.error('Network error')
    }
  }

  const handleEndBreak = async (userId: string) => {
    try {
      const res = await fetch(`/api/staff/${userId}/break-end`, { method: 'POST' })
      if (res.ok) {
        toast.success('Break ended')
        loadData()
      } else {
        const json = await res.json()
        toast.error(json.error ?? 'Failed to end break')
      }
    } catch {
      toast.error('Network error')
    }
  }

  const handleClockOut = async (userId: string) => {
    try {
      const res = await fetch(`/api/staff/${userId}/clock-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        toast.success('Clocked out')
        loadData()
      } else {
        const json = await res.json()
        toast.error(json.error ?? 'Failed to clock out')
      }
    } catch {
      toast.error('Network error')
    }
  }

  return (
    <div className="space-y-6">
      {/* Alert banners */}
      <div className="space-y-3">
        <OvertimeBanner alerts={otAlerts} />
        <BreakComplianceBanner alerts={breakAlerts} />
      </div>

      {/* On Duty Board */}
      <OnDutyBoard
        employees={onDuty}
        onStartBreak={handleStartBreak}
        onEndBreak={handleEndBreak}
        onClockOut={handleClockOut}
      />

      <Separator />

      {/* Time Entry History */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4">Time Entry History</h3>
        <TimeEntryTable
          entries={timeEntries}
          loading={loading}
          onRefresh={loadData}
        />
      </div>
    </div>
  )
}
