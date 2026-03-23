'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

interface TimeEntryEditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  entry: {
    id: string
    clock_in: string
    clock_out: string | null
    staff_name?: string
  } | null
}

export function TimeEntryEditModal({
  open,
  onOpenChange,
  onSaved,
  entry,
}: TimeEntryEditModalProps) {
  const [clockIn, setClockIn] = useState(entry?.clock_in?.slice(0, 16) ?? '')
  const [clockOut, setClockOut] = useState(entry?.clock_out?.slice(0, 16) ?? '')
  const [reason, setReason] = useState('')
  const [managerPin, setManagerPin] = useState('')
  const [saving, setSaving] = useState(false)

  if (!entry) return null

  const handleSave = async () => {
    if (!reason.trim()) {
      toast.error('A reason is required for time entry edits')
      return
    }
    if (!managerPin || managerPin.length < 4) {
      toast.error('Manager PIN is required')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/staff/time-entries/${entry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clock_in: new Date(clockIn).toISOString(),
          clock_out: clockOut ? new Date(clockOut).toISOString() : null,
          reason: reason.trim(),
          manager_pin: managerPin,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Failed to update time entry')
        return
      }

      toast.success('Time entry updated')
      onSaved()
      onOpenChange(false)
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
          <DialogTitle>Edit Time Entry</DialogTitle>
          <DialogDescription>
            {entry.staff_name ? `Editing entry for ${entry.staff_name}` : 'Edit clock-in/out times'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Original Clock In</Label>
              <p className="text-sm font-mono text-foreground">
                {new Date(entry.clock_in).toLocaleString('en-US', {
                  month: 'short', day: 'numeric',
                  hour: 'numeric', minute: '2-digit',
                })}
              </p>
            </div>
            {entry.clock_out && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Original Clock Out</Label>
                <p className="text-sm font-mono text-foreground">
                  {new Date(entry.clock_out).toLocaleString('en-US', {
                    month: 'short', day: 'numeric',
                    hour: 'numeric', minute: '2-digit',
                  })}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>New Clock In</Label>
            <Input
              type="datetime-local"
              value={clockIn}
              onChange={(e) => setClockIn(e.target.value)}
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <Label>New Clock Out</Label>
            <Input
              type="datetime-local"
              value={clockOut}
              onChange={(e) => setClockOut(e.target.value)}
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <Label>Reason for Edit *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this edit is needed..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Manager PIN *</Label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={managerPin}
              onChange={(e) => setManagerPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter manager PIN"
              className="h-10"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
