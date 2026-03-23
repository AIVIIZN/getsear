'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { USER_ROLES } from '@/lib/constants'
import type { StaffMember } from '@/stores/staff-store'

interface ShiftEditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  staff: StaffMember[]
  date: string
  editData?: {
    id: string
    userId: string | null
    role: string
    startTime: string
    endTime: string
    notes: string | null
  } | null
}

export function ShiftEditModal({
  open,
  onOpenChange,
  onSaved,
  staff,
  date,
  editData,
}: ShiftEditModalProps) {
  const isEdit = !!editData
  const [userId, setUserId] = useState(editData?.userId ?? '')
  const [role, setRole] = useState(editData?.role ?? 'server')
  const [startTime, setStartTime] = useState(editData?.startTime?.slice(11, 16) ?? '09:00')
  const [endTime, setEndTime] = useState(editData?.endTime?.slice(11, 16) ?? '17:00')
  const [notes, setNotes] = useState(editData?.notes ?? '')
  const [saving, setSaving] = useState(false)

  const activeStaff = staff.filter((s) => s.is_active)

  const handleSave = async () => {
    setSaving(true)
    try {
      const startIso = `${date}T${startTime}:00Z`
      const endIso = `${date}T${endTime}:00Z`

      const payload = {
        user_id: userId || null,
        role,
        start_time: startIso,
        end_time: endIso,
        notes: notes || null,
      }

      const url = isEdit
        ? `/api/scheduling/shifts/${editData.id}`
        : '/api/scheduling/shifts'
      const method = isEdit ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        toast.success(isEdit ? 'Shift updated' : 'Shift created')
        onSaved()
        onOpenChange(false)
      } else {
        const json = await res.json()
        toast.error(json.error ?? 'Failed to save shift')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Shift' : 'Add Shift'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Employee (leave empty for open shift)</Label>
            <Select value={userId} onValueChange={(v) => v !== null && setUserId(v)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Open shift (unassigned)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Open Shift</SelectItem>
                {activeStaff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.first_name} {s.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => v !== null && setRole(v)}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {USER_ROLES.filter((r) => !['platform_admin', 'kiosk', 'readonly'].includes(r.value)).map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-2">
              <Label>End Time</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-10" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
