'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  Search,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  X,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { CascadeItem, EightySixLogEntry } from '@/lib/menu/eighty-six-cascade'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Ingredient {
  id: string
  name: string
  category: string | null
}

interface EightySixManagerProps {
  isOpen: boolean
  onClose: () => void
  orgId: string
  locationId: string
  userId: string
}

type Step = 'search' | 'preview' | 'success'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EightySixManager({
  isOpen,
  onClose,
  orgId,
  locationId,
  userId,
}: EightySixManagerProps) {
  const [step, setStep] = useState<Step>('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [isLoadingIngredients, setIsLoadingIngredients] = useState(false)
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null)
  const [cascadeItems, setCascadeItems] = useState<(CascadeItem & { checked: boolean })[]>([])
  const [isLoadingCascade, setIsLoadingCascade] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [appliedCount, setAppliedCount] = useState(0)

  // Currently 86'd ingredients
  const [current86d, setCurrent86d] = useState<Ingredient[]>([])
  const [isRestoringId, setIsRestoringId] = useState<string | null>(null)

  // Tracking log
  const [logEntries, setLogEntries] = useState<EightySixLogEntry[]>([])
  const [isLogExpanded, setIsLogExpanded] = useState(false)

  // Load current 86'd ingredients and log on open
  useEffect(() => {
    if (!isOpen) return
    setStep('search')
    setSearchQuery('')
    setSelectedIngredient(null)
    setCascadeItems([])

    loadCurrent86d()
    loadLog()
  }, [isOpen, orgId, locationId]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadCurrent86d = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/menu/ingredients?org_id=${orgId}&location_id=${locationId}&depleted=true`
      )
      if (res.ok) {
        const { data } = await res.json()
        setCurrent86d(data ?? [])
      }
    } catch {
      // Silently fail
    }
  }, [orgId, locationId])

  const loadLog = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/menu/ingredients?org_id=${orgId}&location_id=${locationId}&log=true`
      )
      if (res.ok) {
        const { data } = await res.json()
        setLogEntries(data ?? [])
      }
    } catch {
      // Silently fail
    }
  }, [orgId, locationId])

  // Search ingredients
  useEffect(() => {
    if (!searchQuery.trim() || step !== 'search') {
      setIngredients([])
      return
    }

    const timer = setTimeout(async () => {
      setIsLoadingIngredients(true)
      try {
        const res = await fetch(
          `/api/menu/ingredients?org_id=${orgId}&location_id=${locationId}&search=${encodeURIComponent(searchQuery)}`
        )
        if (res.ok) {
          const { data } = await res.json()
          setIngredients(data ?? [])
        }
      } finally {
        setIsLoadingIngredients(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, step, orgId, locationId])

  // Load cascade preview when ingredient is selected
  const selectIngredient = useCallback(async (ingredient: Ingredient) => {
    setSelectedIngredient(ingredient)
    setIsLoadingCascade(true)
    setStep('preview')

    try {
      const res = await fetch(
        `/api/menu/ingredients/${ingredient.id}/86?preview=true&org_id=${orgId}`
      )
      if (res.ok) {
        const { data } = await res.json()
        setCascadeItems(
          (data ?? []).map((item: CascadeItem) => ({
            ...item,
            checked: true,
          }))
        )
      }
    } finally {
      setIsLoadingCascade(false)
    }
  }, [orgId])

  const toggleCascadeItem = useCallback((itemId: string) => {
    setCascadeItems((prev) =>
      prev.map((item) =>
        item.item_id === itemId ? { ...item, checked: !item.checked } : item
      )
    )
  }, [])

  const selectAllCascade = useCallback((checked: boolean) => {
    setCascadeItems((prev) => prev.map((item) => ({ ...item, checked })))
  }, [])

  // Apply 86 cascade
  const apply86 = useCallback(async () => {
    if (!selectedIngredient) return
    const checkedIds = cascadeItems.filter((i) => i.checked).map((i) => i.item_id)
    if (checkedIds.length === 0) return

    setIsApplying(true)
    try {
      const res = await fetch(`/api/menu/ingredients/${selectedIngredient.id}/86`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_ids: checkedIds,
          user_id: userId,
          org_id: orgId,
          location_id: locationId,
        }),
      })

      if (res.ok) {
        const { affectedCount } = await res.json()
        setAppliedCount(affectedCount ?? checkedIds.length)
        setStep('success')
        loadCurrent86d()
        loadLog()
      }
    } finally {
      setIsApplying(false)
    }
  }, [selectedIngredient, cascadeItems, userId, orgId, locationId, loadCurrent86d, loadLog])

  // Restore an ingredient
  const restoreIngredient = useCallback(async (ingredientId: string) => {
    setIsRestoringId(ingredientId)
    try {
      const res = await fetch(`/api/menu/ingredients/${ingredientId}/86`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          org_id: orgId,
          location_id: locationId,
        }),
      })

      if (res.ok) {
        loadCurrent86d()
        loadLog()
      }
    } finally {
      setIsRestoringId(null)
    }
  }, [userId, orgId, locationId, loadCurrent86d, loadLog])

  const checkedCount = cascadeItems.filter((i) => i.checked).length

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" />
            86 Manager
          </DialogTitle>
          <DialogDescription>
            86 an ingredient to cascade to all affected menu items. All terminals update in real time.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Currently 86'd section */}
          {current86d.length > 0 && step === 'search' && (
            <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              <p className="text-xs font-semibold text-destructive mb-2">
                Currently 86&apos;d Ingredients ({current86d.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {current86d.map((ing) => (
                  <div
                    key={ing.id}
                    className="flex items-center gap-1.5 rounded-full border border-destructive/20 bg-white px-2.5 py-1"
                  >
                    <span className="text-xs font-medium text-foreground">{ing.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-5 rounded-full hover:bg-success/10"
                      onClick={() => restoreIngredient(ing.id)}
                      disabled={isRestoringId === ing.id}
                    >
                      <RotateCcw className={cn(
                        'size-3 text-success',
                        isRestoringId === ing.id && 'animate-spin'
                      )} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Search */}
          {step === 'search' && (
            <div className="space-y-3 flex-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search ingredients to 86..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>

              {isLoadingIngredients && (
                <div className="flex items-center justify-center py-8">
                  <div className="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {!isLoadingIngredients && ingredients.length > 0 && (
                <ScrollArea className="max-h-[200px]">
                  <div className="space-y-1">
                    {ingredients.map((ing) => (
                      <button
                        key={ing.id}
                        type="button"
                        onClick={() => selectIngredient(ing)}
                        className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2.5 text-left transition-colors hover:bg-accent touch-target"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">{ing.name}</p>
                          {ing.category && (
                            <p className="text-xs text-muted-foreground">{ing.category}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          Select
                        </Badge>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {!isLoadingIngredients && searchQuery.trim() && ingredients.length === 0 && (
                <div className="flex flex-col items-center py-8 text-center">
                  <p className="text-sm text-muted-foreground">No ingredients found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Try a different search term
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Cascade Preview */}
          {step === 'preview' && selectedIngredient && (
            <div className="space-y-3 flex-1 flex flex-col">
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-2.5">
                <AlertTriangle className="size-4 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-800">
                  <span className="font-semibold">{selectedIngredient.name}</span> is used in
                  the following menu items. Uncheck any that should remain available.
                </p>
              </div>

              {isLoadingCascade ? (
                <div className="flex items-center justify-center py-8">
                  <div className="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : cascadeItems.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No menu items use this ingredient
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStep('search')}
                    className="mt-3"
                  >
                    Back to Search
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">
                      {checkedCount} of {cascadeItems.length} items selected
                    </Label>
                    <div className="flex gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] px-2"
                        onClick={() => selectAllCascade(true)}
                      >
                        Select All
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] px-2"
                        onClick={() => selectAllCascade(false)}
                      >
                        Deselect All
                      </Button>
                    </div>
                  </div>

                  <ScrollArea className="flex-1 max-h-[250px]">
                    <div className="space-y-1.5">
                      {cascadeItems.map((item) => (
                        <button
                          key={item.item_id}
                          type="button"
                          onClick={() => toggleCascadeItem(item.item_id)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors touch-target',
                            item.checked
                              ? 'border-destructive/30 bg-destructive/5'
                              : 'border-border bg-card'
                          )}
                        >
                          <div
                            className={cn(
                              'size-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors',
                              item.checked
                                ? 'border-destructive bg-destructive text-white'
                                : 'border-border'
                            )}
                          >
                            {item.checked && (
                              <svg className="size-3" viewBox="0 0 12 12" fill="none">
                                <path
                                  d="M2 6l3 3 5-5"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {item.item_name}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {item.category_name}
                              {item.is_minor_ingredient && (
                                <span className="ml-1.5 text-amber-600">(minor ingredient)</span>
                              )}
                            </p>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                            {item.quantity_used} {item.unit_of_measure}
                          </span>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>

                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStep('search')}
                      className="btn-press"
                    >
                      Back
                    </Button>
                    <div className="flex-1" />
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={apply86}
                      disabled={checkedCount === 0 || isApplying}
                      className="btn-press"
                    >
                      <AlertTriangle className="size-4 mr-1" />
                      {isApplying
                        ? 'Applying...'
                        : `Apply 86 (${checkedCount} item${checkedCount !== 1 ? 's' : ''})`}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 3: Success */}
          {step === 'success' && selectedIngredient && (
            <div className="flex flex-col items-center py-8 text-center space-y-4">
              <div className="rounded-full bg-success/10 p-4">
                <CheckCircle2 className="size-8 text-success" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  86 Applied Successfully
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  <span className="font-medium">{selectedIngredient.name}</span> has been 86&apos;d.
                  {appliedCount > 0 && (
                    <> {appliedCount} menu item{appliedCount !== 1 ? 's' : ''} marked as unavailable on all terminals.</>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep('search')
                    setSearchQuery('')
                    setSelectedIngredient(null)
                  }}
                  className="btn-press"
                >
                  86 Another
                </Button>
                <Button onClick={onClose} className="btn-press">
                  <X className="size-4 mr-1" />
                  Done
                </Button>
              </div>
            </div>
          )}

          {/* Tracking Log */}
          {logEntries.length > 0 && step === 'search' && (
            <div className="mt-4 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setIsLogExpanded(!isLogExpanded)}
                className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground touch-target"
              >
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3" />
                  86 Activity Log
                </span>
                {isLogExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              </button>

              {isLogExpanded && (
                <ScrollArea className="mt-2 max-h-[150px]">
                  <div className="space-y-1">
                    {logEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center gap-2 rounded px-2 py-1.5 text-[11px]"
                      >
                        <Badge
                          variant={entry.action === '86' ? 'destructive' : 'secondary'}
                          className="text-[9px] px-1 py-0 shrink-0"
                        >
                          {entry.action === '86' ? '86' : 'Restore'}
                        </Badge>
                        <span className="font-medium text-foreground truncate">
                          {entry.item_name}
                        </span>
                        {entry.ingredient_name && (
                          <span className="text-muted-foreground truncate">
                            via {entry.ingredient_name}
                          </span>
                        )}
                        <span className="ml-auto text-muted-foreground shrink-0 tabular-nums">
                          {formatRelativeTime(entry.created_at)}
                        </span>
                        <span className="text-muted-foreground shrink-0">
                          {entry.performed_by_name}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}
