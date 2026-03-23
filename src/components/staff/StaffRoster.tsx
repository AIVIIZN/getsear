'use client'

import { useState, useMemo, useCallback } from 'react'
import { Plus, Search, UserX, Download, Users, Pencil, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { StaffDetailSheet } from './StaffDetailSheet'
import { StaffDetailView } from './StaffDetailView'
import { USER_ROLES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { StaffMember } from '@/stores/staff-store'

const AVATAR_COLORS = [
  'bg-orange-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500',
  'bg-rose-500', 'bg-teal-500', 'bg-amber-500', 'bg-indigo-500',
]

function nameHash(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

interface StaffRosterProps {
  staff: StaffMember[]
  loading: boolean
  onRefresh: () => void
}

export function StaffRoster({ staff, loading, onRefresh }: StaffRosterProps) {
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<StaffMember | null>(null)
  const [detailEmployee, setDetailEmployee] = useState<StaffMember | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<StaffMember | null>(null)

  const filtered = useMemo(() => {
    return staff.filter((s) => {
      if (roleFilter !== 'all' && s.role !== roleFilter) return false
      if (statusFilter === 'active' && !s.is_active) return false
      if (statusFilter === 'inactive' && s.is_active) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const name = `${s.first_name} ${s.last_name}`.toLowerCase()
        return name.includes(q) || (s.email?.toLowerCase().includes(q) ?? false)
      }
      return true
    })
  }, [staff, roleFilter, statusFilter, searchQuery])

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filtered.map((s) => s.id)))
  }, [filtered])

  const handleDeactivate = async (employee: StaffMember) => {
    try {
      const res = await fetch(`/api/staff/${employee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: false }),
      })
      if (res.ok) {
        toast.success(`${employee.first_name} ${employee.last_name} deactivated`)
        setDeactivateTarget(null)
        onRefresh()
      } else {
        toast.error('Failed to deactivate')
      }
    } catch {
      toast.error('Network error')
    }
  }

  const handleEdit = (employee: StaffMember) => {
    setEditData(employee)
    setSheetOpen(true)
  }

  const handleCreate = () => {
    setEditData(null)
    setSheetOpen(true)
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => v !== null && setRoleFilter(v)}>
          <SelectTrigger className="w-[140px] h-10">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {USER_ROLES.filter((r) => r.value !== 'platform_admin').map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => v !== null && setStatusFilter(v)}>
          <SelectTrigger className="w-[120px] h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        {selectedIds.size > 0 && (
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} selected
          </span>
        )}
        <div className="ml-auto">
          <Button onClick={handleCreate} className="h-10 gap-2">
            <Plus className="h-4 w-4" />
            Add Employee
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="animate-pulse space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-muted rounded" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No team members yet"
          description="Add your first employee to get started"
          actionLabel="Add First Employee"
          onAction={handleCreate}
        />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={() =>
                      selectedIds.size === filtered.length
                        ? setSelectedIds(new Set())
                        : selectAll()
                    }
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead className="hidden lg:table-cell">Email</TableHead>
                <TableHead className="hidden lg:table-cell">Hire Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((emp) => {
                const initials = `${emp.first_name.charAt(0)}${emp.last_name.charAt(0)}`.toUpperCase()
                const color = AVATAR_COLORS[nameHash(emp.first_name + emp.last_name) % AVATAR_COLORS.length]
                return (
                  <TableRow
                    key={emp.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => setDetailEmployee(emp)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(emp.id)}
                        onChange={() => toggleSelected(emp.id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className={cn(color, 'text-white text-xs')}>
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">
                            {emp.first_name} {emp.last_name}
                          </p>
                          {emp.is_clocked_in && (
                            <span className="text-xs text-green-600 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                              On Duty
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-xs">
                        {emp.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {emp.phone ?? '--'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {emp.email ?? '--'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {emp.hire_date
                        ? new Date(emp.hire_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '--'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs',
                          emp.is_active
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-gray-100 text-gray-500 border-gray-200'
                        )}
                      >
                        {emp.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleEdit(emp)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {emp.is_active && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => setDeactivateTarget(emp)}
                          >
                            <UserX className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Sheets/Dialogs */}
      <StaffDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSaved={onRefresh}
        editData={editData ? {
          id: editData.id,
          first_name: editData.first_name,
          last_name: editData.last_name,
          email: editData.email,
          phone: editData.phone,
          role: editData.role,
          hourly_rate: editData.hourly_rate,
          hire_date: editData.hire_date,
        } : null}
      />

      {detailEmployee && (
        <StaffDetailView
          employee={detailEmployee}
          onClose={() => setDetailEmployee(null)}
        />
      )}

      {/* Deactivate confirmation */}
      <Dialog open={!!deactivateTarget} onOpenChange={() => setDeactivateTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Employee</DialogTitle>
            <DialogDescription>
              Deactivate {deactivateTarget?.first_name} {deactivateTarget?.last_name}?
              Their PIN will stop working immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deactivateTarget && handleDeactivate(deactivateTarget)}
            >
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
