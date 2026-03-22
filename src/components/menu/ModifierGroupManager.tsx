'use client'

import { useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, GripVertical, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import type { ModifierGroup } from './ItemDetailSheet'

interface ModifierGroupManagerProps {
  groups: ModifierGroup[]
  onCreateGroup: (data: CreateModifierGroupData) => Promise<void>
  onUpdateGroup: (id: string, data: UpdateModifierGroupData) => Promise<void>
  onDeleteGroup: (id: string) => Promise<void>
}

interface CreateModifierGroupData {
  name: string
  is_required: boolean
  min_selections: number
  max_selections: number
  modifiers: { name: string; price: string; is_active: boolean }[]
}

interface UpdateModifierGroupData {
  name?: string
  is_required?: boolean
  min_selections?: number
  max_selections?: number
  modifiers?: { id?: string; name: string; price: string; is_active: boolean; sort_order?: number }[]
}

interface ModifierRow {
  id?: string
  name: string
  price: string
  is_active: boolean
}

export function ModifierGroupManager({
  groups,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
}: ModifierGroupManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<ModifierGroup | null>(null)
  const [groupName, setGroupName] = useState('')
  const [isRequired, setIsRequired] = useState(false)
  const [minSelections, setMinSelections] = useState('0')
  const [maxSelections, setMaxSelections] = useState('0')
  const [modifiers, setModifiers] = useState<ModifierRow[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const resetForm = useCallback(() => {
    setGroupName('')
    setIsRequired(false)
    setMinSelections('0')
    setMaxSelections('0')
    setModifiers([])
    setEditingGroup(null)
  }, [])

  const openCreate = useCallback(() => {
    resetForm()
    setIsDialogOpen(true)
  }, [resetForm])

  const openEdit = useCallback((group: ModifierGroup) => {
    setEditingGroup(group)
    setGroupName(group.name)
    setIsRequired(group.is_required)
    setMinSelections(group.min_selections.toString())
    setMaxSelections(group.max_selections.toString())
    setModifiers(
      group.modifiers
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((m) => ({
          id: m.id,
          name: m.name,
          price: m.price,
          is_active: m.is_active,
        }))
    )
    setIsDialogOpen(true)
  }, [])

  const addModifierRow = useCallback(() => {
    setModifiers((prev) => [...prev, { name: '', price: '0.00', is_active: true }])
  }, [])

  const updateModifierRow = useCallback((index: number, field: keyof ModifierRow, value: string | boolean) => {
    setModifiers((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    )
  }, [])

  const removeModifierRow = useCallback((index: number) => {
    setModifiers((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleSave = useCallback(async () => {
    if (!groupName.trim()) return
    setIsSaving(true)
    try {
      const validModifiers = modifiers.filter((m) => m.name.trim())
      if (editingGroup) {
        await onUpdateGroup(editingGroup.id, {
          name: groupName.trim(),
          is_required: isRequired,
          min_selections: parseInt(minSelections, 10) || 0,
          max_selections: parseInt(maxSelections, 10) || 0,
          modifiers: validModifiers.map((m, i) => ({
            id: m.id,
            name: m.name.trim(),
            price: m.price || '0.00',
            is_active: m.is_active,
            sort_order: i,
          })),
        })
      } else {
        await onCreateGroup({
          name: groupName.trim(),
          is_required: isRequired,
          min_selections: parseInt(minSelections, 10) || 0,
          max_selections: parseInt(maxSelections, 10) || 0,
          modifiers: validModifiers.map((m) => ({
            name: m.name.trim(),
            price: m.price || '0.00',
            is_active: m.is_active,
          })),
        })
      }
      setIsDialogOpen(false)
      resetForm()
    } finally {
      setIsSaving(false)
    }
  }, [
    groupName, isRequired, minSelections, maxSelections, modifiers,
    editingGroup, onCreateGroup, onUpdateGroup, resetForm,
  ])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Modifier Groups</h3>
          <p className="text-xs text-muted-foreground">
            Manage modifier groups and their options.
          </p>
        </div>
        <Button size="sm" onClick={openCreate} className="btn-press">
          <Plus className="size-4 mr-1" />
          Add Group
        </Button>
      </div>

      {/* Groups list */}
      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-8 text-center">
          <p className="text-sm text-muted-foreground">No modifier groups yet.</p>
          <Button variant="link" size="sm" onClick={openCreate} className="mt-1">
            Create your first group
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((group) => (
            <div
              key={group.id}
              className="flex items-center justify-between rounded-lg border border-border p-3 bg-card shadow-warm-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{group.name}</span>
                  {group.is_required && (
                    <span className="text-[10px] font-semibold uppercase text-primary bg-accent px-1.5 py-0.5 rounded-full">
                      Required
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {group.modifiers.length} modifier{group.modifiers.length !== 1 ? 's' : ''}
                  {group.min_selections > 0 && ` / min ${group.min_selections}`}
                  {group.max_selections > 0 && ` / max ${group.max_selections}`}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => openEdit(group)}
                  aria-label={`Edit ${group.name}`}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onDeleteGroup(group.id)}
                  aria-label={`Delete ${group.name}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsDialogOpen(false)
          resetForm()
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingGroup ? 'Edit Modifier Group' : 'New Modifier Group'}
            </DialogTitle>
            <DialogDescription>
              {editingGroup
                ? 'Update the modifier group and its options.'
                : 'Create a new modifier group with options.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Group name */}
            <div className="space-y-1.5">
              <Label htmlFor="group-name">Group Name *</Label>
              <Input
                id="group-name"
                placeholder="e.g. Temperature, Sides, Add-ons"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>

            {/* Required toggle */}
            <div className="flex items-center justify-between">
              <Label>Required</Label>
              <button
                type="button"
                onClick={() => setIsRequired(!isRequired)}
                className="touch-target flex items-center"
              >
                <Switch checked={isRequired} />
              </button>
            </div>

            {/* Min/Max selections */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="min-sel">Min Selections</Label>
                <Input
                  id="min-sel"
                  type="number"
                  min={0}
                  value={minSelections}
                  onChange={(e) => setMinSelections(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max-sel">Max Selections</Label>
                <Input
                  id="max-sel"
                  type="number"
                  min={0}
                  value={maxSelections}
                  onChange={(e) => setMaxSelections(e.target.value)}
                />
              </div>
            </div>

            {/* Modifiers */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Modifiers</Label>
                <Button variant="ghost" size="xs" onClick={addModifierRow}>
                  <Plus className="size-3 mr-1" />
                  Add
                </Button>
              </div>
              {modifiers.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">
                  No modifiers added. Click &quot;Add&quot; to create options.
                </p>
              ) : (
                <div className="space-y-2">
                  {modifiers.map((mod, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <GripVertical className="size-3.5 text-muted-foreground flex-shrink-0 cursor-grab" />
                      <Input
                        placeholder="Name"
                        value={mod.name}
                        onChange={(e) => updateModifierRow(idx, 'name', e.target.value)}
                        className="flex-1"
                      />
                      <div className="relative w-20">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                        <Input
                          placeholder="0.00"
                          value={mod.price}
                          onChange={(e) => updateModifierRow(idx, 'price', e.target.value)}
                          className="pl-6 tabular-nums"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeModifierRow(idx)}
                        className="p-1 text-muted-foreground hover:text-destructive touch-target"
                        aria-label="Remove modifier"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false)
                resetForm()
              }}
              className="btn-press"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!groupName.trim() || isSaving}
              className="btn-press"
            >
              {isSaving ? 'Saving...' : editingGroup ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
