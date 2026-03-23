'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PermissionToggle } from './PermissionToggle'
import { PERMISSION_CATEGORIES, getRoleDefault, type PermissionDefault } from '@/lib/staff/permission-defaults'
import { cn } from '@/lib/utils'

type OverrideState = 'inherit' | 'grant' | 'deny'

interface PermissionMatrixProps {
  userId: string
  role: string
  overrides: Record<string, string>
  onOverrideChange: (permissionCode: string, state: OverrideState) => void
  onResetAll: () => void
}

export function PermissionMatrix({
  userId,
  role,
  overrides,
  onOverrideChange,
  onResetAll,
}: PermissionMatrixProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(PERMISSION_CATEGORIES.map((c) => c.key))
  )

  const toggleCategory = (key: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const getOverrideState = (code: string): OverrideState => {
    if (overrides[code] === 'grant') return 'grant'
    if (overrides[code] === 'deny') return 'deny'
    return 'inherit'
  }

  const overrideCount = Object.keys(overrides).length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Permission overrides
          </p>
          {overrideCount > 0 && (
            <p className="text-xs text-primary mt-0.5">
              {overrideCount} override{overrideCount > 1 ? 's' : ''} active
            </p>
          )}
        </div>
        {overrideCount > 0 && (
          <Button variant="outline" size="sm" onClick={onResetAll} className="gap-1 text-xs">
            <RotateCcw className="h-3 w-3" />
            Reset to Defaults
          </Button>
        )}
      </div>

      {/* Categories */}
      <div className="space-y-1">
        {PERMISSION_CATEGORIES.map((category) => {
          const isExpanded = expandedCategories.has(category.key)
          const categoryOverrides = category.permissions.filter((p) => overrides[p.code])

          return (
            <div key={category.key} className="border border-border rounded-lg overflow-hidden">
              {/* Category header */}
              <button
                type="button"
                onClick={() => toggleCategory(category.key)}
                className="flex items-center justify-between w-full px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-semibold text-foreground">{category.label}</span>
                  <span className="text-xs text-muted-foreground">
                    ({category.permissions.length})
                  </span>
                </div>
                {categoryOverrides.length > 0 && (
                  <span className="text-xs text-primary font-medium">
                    {categoryOverrides.length} override{categoryOverrides.length > 1 ? 's' : ''}
                  </span>
                )}
              </button>

              {/* Permission rows */}
              {isExpanded && (
                <div className="divide-y divide-border">
                  {category.permissions.map((perm, i) => {
                    const roleDefault = getRoleDefault(role, perm.code)
                    const state = getOverrideState(perm.code)

                    return (
                      <div
                        key={perm.code}
                        className={cn(
                          'flex items-center justify-between px-4 py-3',
                          i % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                        )}
                      >
                        <div className="flex-1 min-w-0 mr-4">
                          <p className="text-sm font-medium text-foreground">{perm.label}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {perm.description}
                          </p>
                        </div>
                        <PermissionToggle
                          state={state}
                          roleDefault={roleDefault}
                          onChange={(newState) => onOverrideChange(perm.code, newState)}
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
