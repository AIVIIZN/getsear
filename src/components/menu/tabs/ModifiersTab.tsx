'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Plus,
  GripVertical,
  ChevronDown,
  ChevronUp,
  X,
  Link2,
  Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  ModifierRow,
  createEmptyModifier,
  type ModifierRowData,
} from '../ModifierRow'
import { DEFAULT_MODIFIER_PRICING, type ModifierPricing } from '../PricingTypeSelector'
import type { ModifierGroup, Modifier } from '../ItemDetailSheet'

interface LinkedModifierGroup {
  groupId: string
  sort_order: number
}

interface ModifiersTabProps {
  allModifierGroups: ModifierGroup[]
  linkedGroupIds: string[]
  onLinkGroups: (groupIds: string[]) => void
  onCreateGroup: (data: {
    name: string
    is_required: boolean
    min_selections: number
    max_selections: number
    modifiers: { name: string; price: string; is_active: boolean }[]
  }) => Promise<void>
}

function SortableLinkedGroup({
  group,
  onUnlink,
  onExpand,
  isExpanded,
}: {
  group: ModifierGroup
  onUnlink: (id: string) => void
  onExpand: (id: string) => void
  isExpanded: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: group.id,
    data: { type: 'linked-group', group },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-lg border border-border bg-card overflow-hidden transition-all',
        isDragging && 'opacity-50 shadow-lg'
      )}
    >
      <div className="flex items-center gap-2 p-3">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground/40 hover:text-muted-foreground flex-shrink-0"
        >
          <GripVertical className="size-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{group.name}</span>
            <Badge
              variant={group.is_required ? 'default' : 'secondary'}
              className="text-[10px]"
            >
              {group.is_required ? 'Required' : 'Optional'}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {group.modifiers.length} modifier{group.modifiers.length !== 1 ? 's' : ''}
            {group.min_selections > 0 && ` / min ${group.min_selections}`}
            {group.max_selections > 0 && ` / max ${group.max_selections}`}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onExpand(group.id)}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>

        <button
          type="button"
          onClick={() => onUnlink(group.id)}
          className="p-1 text-muted-foreground hover:text-destructive transition-colors"
          aria-label={`Remove ${group.name}`}
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Expanded view showing modifiers */}
      {isExpanded && (
        <div className="border-t border-border bg-muted/30 px-3 py-2 space-y-1">
          {group.modifiers
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((mod) => (
              <div key={mod.id} className="flex items-center justify-between py-1 text-xs">
                <span className={cn(
                  'text-foreground',
                  !mod.is_active && 'text-muted-foreground line-through'
                )}>
                  {mod.name}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {parseFloat(mod.price) > 0 ? `+$${parseFloat(mod.price).toFixed(2)}` : 'Included'}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

export function ModifiersTab({
  allModifierGroups,
  linkedGroupIds,
  onLinkGroups,
  onCreateGroup,
}: ModifiersTabProps) {
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  // New group form state
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupRequired, setNewGroupRequired] = useState(false)
  const [newGroupMin, setNewGroupMin] = useState('0')
  const [newGroupMax, setNewGroupMax] = useState('0')
  const [newModifiers, setNewModifiers] = useState<ModifierRowData[]>([])
  const [isCreating, setIsCreating] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Get linked groups in order
  const linkedGroups = linkedGroupIds
    .map((id) => allModifierGroups.find((g) => g.id === id))
    .filter((g): g is ModifierGroup => g !== undefined)

  const unlinkedGroups = allModifierGroups.filter(
    (g) => !linkedGroupIds.includes(g.id)
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null)
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = linkedGroupIds.indexOf(active.id as string)
      const newIndex = linkedGroupIds.indexOf(over.id as string)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(linkedGroupIds, oldIndex, newIndex)
      onLinkGroups(reordered)
    },
    [linkedGroupIds, onLinkGroups]
  )

  const handleUnlink = useCallback(
    (groupId: string) => {
      onLinkGroups(linkedGroupIds.filter((id) => id !== groupId))
    },
    [linkedGroupIds, onLinkGroups]
  )

  const handleLink = useCallback(
    (groupId: string) => {
      onLinkGroups([...linkedGroupIds, groupId])
      if (unlinkedGroups.length <= 1) {
        setShowPicker(false)
      }
    },
    [linkedGroupIds, unlinkedGroups.length, onLinkGroups]
  )

  const handleToggleExpand = useCallback(
    (groupId: string) => {
      setExpandedGroupId((prev) => (prev === groupId ? null : groupId))
    },
    []
  )

  // New group creation
  const handleAddModifier = useCallback(() => {
    setNewModifiers((prev) => [...prev, createEmptyModifier()])
  }, [])

  const handleUpdateModifier = useCallback(
    (index: number, field: keyof ModifierRowData, value: string | boolean | ModifierPricing | null) => {
      setNewModifiers((prev) =>
        prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
      )
    },
    []
  )

  const handleRemoveModifier = useCallback((index: number) => {
    setNewModifiers((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleCreateGroup = useCallback(async () => {
    if (!newGroupName.trim()) return
    setIsCreating(true)
    try {
      const validMods = newModifiers.filter((m) => m.name.trim())
      await onCreateGroup({
        name: newGroupName.trim(),
        is_required: newGroupRequired,
        min_selections: parseInt(newGroupMin, 10) || 0,
        max_selections: parseInt(newGroupMax, 10) || 0,
        modifiers: validMods.map((m) => ({
          name: m.name.trim(),
          price: m.price || '0.00',
          is_active: m.is_active,
        })),
      })
      // Reset form
      setNewGroupName('')
      setNewGroupRequired(false)
      setNewGroupMin('0')
      setNewGroupMax('0')
      setNewModifiers([])
      setShowCreateForm(false)
    } finally {
      setIsCreating(false)
    }
  }, [newGroupName, newGroupRequired, newGroupMin, newGroupMax, newModifiers, onCreateGroup])

  const activeDragGroup = activeDragId
    ? linkedGroups.find((g) => g.id === activeDragId)
    : null

  return (
    <div className="space-y-4">
      {/* Linked groups header */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-semibold">Modifier Groups</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Drag to reorder. Click arrow to expand.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowPicker(!showPicker)}
        >
          <Link2 className="size-3.5 mr-1" />
          Add Group
        </Button>
      </div>

      {/* Linked groups list */}
      {linkedGroups.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-border py-8 text-center">
          <Link2 className="size-6 text-muted-foreground/40 mb-2" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">No modifier groups linked.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add existing groups or create a new one.
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="outline" onClick={() => setShowPicker(true)}>
              Link Existing
            </Button>
            <Button size="sm" onClick={() => setShowCreateForm(true)}>
              <Plus className="size-3.5 mr-1" />
              Create New
            </Button>
          </div>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={linkedGroups.map((g) => g.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {linkedGroups.map((group) => (
                <SortableLinkedGroup
                  key={group.id}
                  group={group}
                  onUnlink={handleUnlink}
                  onExpand={handleToggleExpand}
                  isExpanded={expandedGroupId === group.id}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeDragGroup ? (
              <div className="rounded-lg border border-border bg-background p-3 shadow-lg opacity-90">
                <span className="text-sm font-medium">{activeDragGroup.name}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Group picker */}
      {showPicker && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Available Groups</Label>
            <button
              type="button"
              onClick={() => setShowPicker(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
          {unlinkedGroups.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">
              All groups are already linked.
            </p>
          ) : (
            <div className="space-y-1">
              {unlinkedGroups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => handleLink(group.id)}
                  className="flex w-full items-center justify-between rounded-md border border-border bg-card p-2 text-left transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5"
                >
                  <div>
                    <span className="text-sm font-medium text-foreground">{group.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {group.modifiers.length} modifier{group.modifiers.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <Plus className="size-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setShowPicker(false)
              setShowCreateForm(true)
            }}
            className="w-full"
          >
            <Plus className="size-3.5 mr-1" />
            Create New Group
          </Button>
        </div>
      )}

      {/* Create new group form */}
      {showCreateForm && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">New Modifier Group</Label>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-group-name" className="text-xs">Group Name *</Label>
            <Input
              id="new-group-name"
              placeholder="e.g. Temperature, Sides, Add-ons"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="h-8"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs">Required</Label>
            <button
              type="button"
              onClick={() => setNewGroupRequired(!newGroupRequired)}
              className="flex items-center"
            >
              <Switch checked={newGroupRequired} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Min Selections</Label>
              <Input
                type="number"
                min={0}
                value={newGroupMin}
                onChange={(e) => setNewGroupMin(e.target.value)}
                className="h-8"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Max Selections</Label>
              <Input
                type="number"
                min={0}
                value={newGroupMax}
                onChange={(e) => setNewGroupMax(e.target.value)}
                className="h-8"
              />
            </div>
          </div>

          {/* Modifiers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Modifiers</Label>
              <Button variant="ghost" size="xs" onClick={handleAddModifier}>
                <Plus className="size-3 mr-1" />
                Add
              </Button>
            </div>
            {newModifiers.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">
                No modifiers added. Click &quot;Add&quot; above.
              </p>
            ) : (
              <div className="space-y-2">
                {newModifiers.map((mod, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      placeholder="Name"
                      value={mod.name}
                      onChange={(e) => handleUpdateModifier(idx, 'name', e.target.value)}
                      className="flex-1 h-8"
                    />
                    <div className="relative w-20">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                      <Input
                        placeholder="0.00"
                        value={mod.price}
                        onChange={(e) => handleUpdateModifier(idx, 'price', e.target.value)}
                        className="pl-6 tabular-nums h-8"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveModifier(idx)}
                      className="p-1 text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              onClick={handleCreateGroup}
              disabled={!newGroupName.trim() || isCreating}
              className="flex-1"
            >
              {isCreating ? 'Creating...' : 'Create & Link'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCreateForm(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
