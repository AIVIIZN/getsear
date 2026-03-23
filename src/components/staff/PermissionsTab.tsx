'use client'

import { useEffect, useState, useCallback } from 'react'
import { Shield, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { PermissionMatrix } from './PermissionMatrix'
import { cn } from '@/lib/utils'
import type { StaffMember } from '@/stores/staff-store'

type OverrideState = 'inherit' | 'grant' | 'deny'

interface PermissionsTabProps {
  staff: StaffMember[]
}

export function PermissionsTab({ staff }: PermissionsTabProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const activeStaff = staff.filter((s) => s.is_active)
  const filtered = activeStaff.filter((s) => {
    if (!searchQuery) return true
    const name = `${s.first_name} ${s.last_name}`.toLowerCase()
    return name.includes(searchQuery.toLowerCase())
  })

  const selectedEmployee = staff.find((s) => s.id === selectedId) ?? null

  const loadOverrides = useCallback(async (userId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/staff/permissions/${userId}`)
      if (res.ok) {
        const json = await res.json()
        setOverrides(json.data?.overrides ?? {})
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId) {
      loadOverrides(selectedId)
    }
  }, [selectedId, loadOverrides])

  const handleOverrideChange = async (permissionCode: string, state: OverrideState) => {
    if (!selectedId) return

    // Optimistic update
    const prevOverrides = { ...overrides }
    if (state === 'inherit') {
      const next = { ...overrides }
      delete next[permissionCode]
      setOverrides(next)
    } else {
      setOverrides({ ...overrides, [permissionCode]: state })
    }

    try {
      const res = await fetch(`/api/staff/permissions/${selectedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permission_code: permissionCode,
          override_type: state === 'inherit' ? null : state,
        }),
      })

      if (!res.ok) {
        setOverrides(prevOverrides)
        toast.error('Failed to update permission')
      } else {
        toast.success('Permission updated', {
          action: {
            label: 'Undo',
            onClick: () => {
              handleOverrideChange(permissionCode, state === 'inherit' ? (prevOverrides[permissionCode] as OverrideState ?? 'inherit') : 'inherit')
            },
          },
        })
      }
    } catch {
      setOverrides(prevOverrides)
      toast.error('Network error')
    }
  }

  const handleResetAll = async () => {
    if (!selectedId) return

    try {
      const updates = Object.keys(overrides).map((code) => ({
        user_id: selectedId,
        permission_code: code,
        override_type: null,
      }))

      const res = await fetch('/api/staff/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })

      if (res.ok) {
        setOverrides({})
        toast.success('All overrides reset to role defaults')
      } else {
        toast.error('Failed to reset permissions')
      }
    } catch {
      toast.error('Network error')
    }
  }

  return (
    <div className="flex gap-6 min-h-[500px]">
      {/* Employee list (left) */}
      <div className="w-72 shrink-0 border border-border rounded-lg overflow-hidden">
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
        <ScrollArea className="h-[500px]">
          <div className="divide-y divide-border">
            {filtered.map((emp) => (
              <button
                key={emp.id}
                type="button"
                onClick={() => setSelectedId(emp.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                  selectedId === emp.id
                    ? 'bg-primary/5 border-l-2 border-primary'
                    : 'hover:bg-accent border-l-2 border-transparent'
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {emp.first_name} {emp.last_name}
                  </p>
                  <Badge variant="outline" className="text-xs capitalize mt-0.5">
                    {emp.role}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Permission matrix (right) */}
      <div className="flex-1 min-w-0">
        {!selectedId ? (
          <EmptyState
            icon={Shield}
            title="Select an employee"
            description="Select an employee from the list to configure their permissions."
          />
        ) : loading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-48" />
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : selectedEmployee ? (
          <div>
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                {selectedEmployee.first_name} {selectedEmployee.last_name}
              </h3>
              <p className="text-sm text-muted-foreground capitalize">
                Role: {selectedEmployee.role}
              </p>
            </div>
            <PermissionMatrix
              userId={selectedId}
              role={selectedEmployee.role}
              overrides={overrides}
              onOverrideChange={handleOverrideChange}
              onResetAll={handleResetAll}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
