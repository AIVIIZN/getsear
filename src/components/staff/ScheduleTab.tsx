'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Send, LayoutTemplate, PanelRightOpen } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ScheduleCalendar } from './ScheduleCalendar'
import { LaborForecastBar } from './LaborForecastBar'
import { ShiftEditModal } from './ShiftEditModal'
import { ShiftMarketplace } from './ShiftMarketplace'
import { ScheduleTemplateDialog } from './ScheduleTemplateDialog'
import type { ScheduleShift, SwapRequest } from '@/stores/schedule-store'
import type { StaffMember } from '@/stores/staff-store'

interface ScheduleTabProps {
  staff: StaffMember[]
}

function getMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

export function ScheduleTab({ staff }: ScheduleTabProps) {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date().toISOString().split('T')[0]))
  const [shifts, setShifts] = useState<ScheduleShift[]>([])
  const [openShifts, setOpenShifts] = useState<ScheduleShift[]>([])
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [marketplaceOpen, setMarketplaceOpen] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [editShift, setEditShift] = useState<ScheduleShift | null>(null)
  const [addDate, setAddDate] = useState<string | null>(null)

  const loadShifts = useCallback(async () => {
    setLoading(true)
    try {
      const weekEnd = new Date(weekStart + 'T12:00:00')
      weekEnd.setDate(weekEnd.getDate() + 6)
      const endStr = weekEnd.toISOString().split('T')[0]

      const res = await fetch(`/api/scheduling/shifts?start=${weekStart}&end=${endStr}`)
      if (res.ok) {
        const json = await res.json()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped: ScheduleShift[] = (json.data ?? []).map((s: any) => ({
          id: s.id,
          userId: s.user_id,
          employeeName: s.employee_name ?? null,
          role: s.role ?? 'server',
          date: (s.start_time ?? '').split('T')[0],
          startTime: s.start_time,
          endTime: s.end_time,
          isPublished: !!s.published_at,
          notes: s.notes,
          hourlyRateCents: 0,
        }))
        setShifts(mapped)
      }

      // Load open shifts
      const openRes = await fetch('/api/scheduling/shifts/open')
      if (openRes.ok) {
        const openJson = await openRes.json()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setOpenShifts((openJson.data ?? []).map((s: any) => ({
          id: s.id, userId: null, employeeName: null,
          role: s.role ?? 'server',
          date: (s.start_time ?? '').split('T')[0],
          startTime: s.start_time, endTime: s.end_time,
          isPublished: false, notes: null, hourlyRateCents: 0,
        })))
      }

      // Load swap requests
      const swapRes = await fetch('/api/scheduling/swap-requests')
      if (swapRes.ok) {
        const swapJson = await swapRes.json()
        setSwapRequests(swapJson.data ?? [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [weekStart])

  useEffect(() => { loadShifts() }, [loadShifts])

  const navigateWeek = (direction: number) => {
    const d = new Date(weekStart + 'T12:00:00')
    d.setDate(d.getDate() + direction * 7)
    setWeekStart(d.toISOString().split('T')[0])
  }

  const handlePublish = async () => {
    try {
      const res = await fetch('/api/scheduling/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: 'default', week_start: weekStart }),
      })
      if (res.ok) {
        const json = await res.json()
        toast.success(`Published ${json.data.publishedShifts} shifts to ${json.data.affectedEmployees} employees`)
        loadShifts()
      } else {
        toast.error('Failed to publish schedule')
      }
    } catch { toast.error('Network error') }
  }

  const weekLabel = (() => {
    const start = new Date(weekStart + 'T12:00:00')
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  })()

  const unpublishedCount = shifts.filter((s) => !s.isPublished).length

  return (
    <div className="flex h-full">
      <div className="flex-1 space-y-4">
        {/* Labor forecast */}
        <LaborForecastBar weekStart={weekStart} />

        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigateWeek(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold min-w-[200px] text-center">{weekLabel}</span>
            <Button variant="outline" size="sm" onClick={() => navigateWeek(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setWeekStart(getMonday(new Date().toISOString().split('T')[0]))}>
              Today
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setTemplateOpen(true)} className="gap-1">
              <LayoutTemplate className="h-3.5 w-3.5" />
              Templates
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMarketplaceOpen(true)} className="gap-1">
              <PanelRightOpen className="h-3.5 w-3.5" />
              Marketplace
            </Button>
            {unpublishedCount > 0 && (
              <Button size="sm" onClick={handlePublish} className="gap-1">
                <Send className="h-3.5 w-3.5" />
                Publish ({unpublishedCount})
              </Button>
            )}
          </div>
        </div>

        {/* Calendar */}
        {loading ? (
          <div className="animate-pulse space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-muted rounded" />)}</div>
        ) : (
          <ScheduleCalendar
            weekStart={weekStart}
            shifts={shifts}
            staff={staff}
            onShiftClick={(shift) => setEditShift(shift)}
            onAddShift={(date) => setAddDate(date)}
          />
        )}
      </div>

      {/* Marketplace sidebar */}
      {marketplaceOpen && (
        <ShiftMarketplace
          openShifts={openShifts}
          swapRequests={swapRequests}
          onClose={() => setMarketplaceOpen(false)}
          onPickupShift={() => {}}
          onApproveRequest={() => {}}
          onDenyRequest={() => {}}
        />
      )}

      {/* Shift edit modal */}
      <ShiftEditModal
        open={!!editShift || !!addDate}
        onOpenChange={(open) => { if (!open) { setEditShift(null); setAddDate(null) } }}
        onSaved={loadShifts}
        staff={staff}
        date={editShift?.date ?? addDate ?? weekStart}
        editData={editShift ? {
          id: editShift.id,
          userId: editShift.userId,
          role: editShift.role,
          startTime: editShift.startTime,
          endTime: editShift.endTime,
          notes: editShift.notes,
        } : null}
      />

      {/* Template dialog */}
      <ScheduleTemplateDialog
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        weekStart={weekStart}
        onApplyTemplate={() => loadShifts()}
      />
    </div>
  )
}
