'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { USER_ROLES } from '@/lib/constants'

interface StaffDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  /** If provided, we are editing; otherwise creating */
  editData?: {
    id: string
    first_name: string
    last_name: string
    email: string | null
    phone: string | null
    role: string
    hourly_rate: string | null
    hire_date: string | null
  } | null
}

export function StaffDetailSheet({
  open,
  onOpenChange,
  onSaved,
  editData,
}: StaffDetailSheetProps) {
  const isEdit = !!editData
  const [saving, setSaving] = useState(false)
  const [firstName, setFirstName] = useState(editData?.first_name ?? '')
  const [lastName, setLastName] = useState(editData?.last_name ?? '')
  const [email, setEmail] = useState(editData?.email ?? '')
  const [phone, setPhone] = useState(editData?.phone ?? '')
  const [role, setRole] = useState(editData?.role ?? 'server')
  const [hourlyRate, setHourlyRate] = useState(editData?.hourly_rate ?? '')
  const [pin, setPin] = useState('')
  const [hireDate, setHireDate] = useState(
    editData?.hire_date ?? new Date().toISOString().split('T')[0]
  )

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('First and last name are required')
      return
    }

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        role,
        hourly_rate: hourlyRate || null,
        hire_date: hireDate || null,
      }

      if (!isEdit && pin) {
        payload.pin = pin
      }

      const url = isEdit ? `/api/staff/${editData.id}` : '/api/staff'
      const method = isEdit ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Failed to save')
        return
      }

      toast.success(isEdit ? 'Employee updated' : 'Employee added')
      onSaved()
      onOpenChange(false)
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit Employee' : 'Add Employee'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Update employee information'
              : 'Fill in details to add a new team member'}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First Name *</Label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
              />
            </div>
            <div className="space-y-2">
              <Label>Last Name *</Label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 555-5555"
            />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => v !== null && setRole(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {USER_ROLES.filter((r) => r.value !== 'platform_admin').map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Hourly Rate ($)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder="15.00"
            />
          </div>

          {!isEdit && (
            <div className="space-y-2">
              <Label>PIN (4-6 digits)</Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter PIN"
              />
              <p className="text-xs text-muted-foreground">
                Used for POS clock-in. Will be securely hashed.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Hire Date</Label>
            <Input
              type="date"
              value={hireDate}
              onChange={(e) => setHireDate(e.target.value)}
            />
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Add Employee'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
