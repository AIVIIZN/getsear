'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Star,
  Plus,
  Trash2,
  Clock,
  ShoppingBag,
  X,
  Save,
  ChevronDown,
} from 'lucide-react'

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

interface TemplateItem {
  menu_item_id: string
  name: string
  price_cents: number
  quantity: number
  modifiers: Array<{
    modifier_id: string
    name: string
    price_cents: number
    quantity: number
  }>
  special_instructions: string
  tax_class: string
  is_taxable: boolean
}

interface OrderTemplate {
  id: string
  name: string
  items: TemplateItem[]
  created_at: string
  last_used_at: string
}

interface OrderTemplatesProps {
  /** The org_id is used as the localStorage key namespace */
  orgId: string
  /** Called when user selects a template to populate the order */
  onSelectTemplate: (items: TemplateItem[]) => void
  /** Current order items to save as template */
  currentItems?: TemplateItem[]
  className?: string
}

// ---------------------------------------------------------------
// LocalStorage Helpers
// ---------------------------------------------------------------

const STORAGE_KEY_PREFIX = 'sear_order_templates_'

function getTemplates(orgId: string): OrderTemplate[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${orgId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as OrderTemplate[]
  } catch {
    return []
  }
}

function saveTemplates(orgId: string, templates: OrderTemplate[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${orgId}`, JSON.stringify(templates))
  } catch {
    // Storage full or unavailable
  }
}

// ---------------------------------------------------------------
// Save Template Dialog
// ---------------------------------------------------------------

function SaveTemplateDialog({
  items,
  onSave,
  onCancel,
}: {
  items: TemplateItem[]
  onSave: (name: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Save as Template</h3>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--secondary)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-[var(--text-secondary)] mb-4">
          {items.length} item{items.length !== 1 ? 's' : ''} will be saved
        </p>

        <div className="space-y-3 mb-4 max-h-32 overflow-y-auto">
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-primary)]">
                {item.quantity > 1 && <span className="font-bold mr-1">{item.quantity}x</span>}
                {item.name}
              </span>
            </div>
          ))}
        </div>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template name (e.g., Jim's regular)"
          maxLength={50}
          autoFocus
          className="h-11 w-full rounded-lg border border-border bg-[var(--secondary)] px-3 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] mb-4"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) onSave(name.trim())
          }}
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="btn-press flex-1 rounded-lg border border-border py-2.5 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--secondary)]"
            style={{ minHeight: 44 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => name.trim() && onSave(name.trim())}
            disabled={!name.trim()}
            className="btn-press flex-1 rounded-lg bg-[var(--primary)] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-40"
            style={{ minHeight: 44 }}
          >
            <span className="flex items-center justify-center gap-1.5">
              <Save className="h-4 w-4" />
              Save
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// Main OrderTemplates Component
// ---------------------------------------------------------------

export function OrderTemplates({
  orgId,
  onSelectTemplate,
  currentItems,
  className,
}: OrderTemplatesProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [templates, setTemplates] = useState<OrderTemplate[]>([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Load templates on mount
  useEffect(() => {
    setTemplates(getTemplates(orgId))
  }, [orgId])

  const handleSelectTemplate = useCallback(
    (template: OrderTemplate) => {
      onSelectTemplate(template.items)

      // Update last_used_at
      setTemplates((prev) => {
        const updated = prev.map((t) =>
          t.id === template.id
            ? { ...t, last_used_at: new Date().toISOString() }
            : t
        )
        saveTemplates(orgId, updated)
        return updated
      })

      setIsOpen(false)
      toast.success(`Applied template: ${template.name}`)
    },
    [orgId, onSelectTemplate]
  )

  const handleSaveTemplate = useCallback(
    (name: string) => {
      if (!currentItems || currentItems.length === 0) {
        toast.error('No items to save')
        return
      }

      const template: OrderTemplate = {
        id: crypto.randomUUID(),
        name,
        items: currentItems,
        created_at: new Date().toISOString(),
        last_used_at: new Date().toISOString(),
      }

      setTemplates((prev) => {
        const updated = [...prev, template]
        saveTemplates(orgId, updated)
        return updated
      })

      setShowSaveDialog(false)
      toast.success(`Template "${name}" saved`)
    },
    [orgId, currentItems]
  )

  const handleDeleteTemplate = useCallback(
    (templateId: string) => {
      setTemplates((prev) => {
        const updated = prev.filter((t) => t.id !== templateId)
        saveTemplates(orgId, updated)
        return updated
      })
      setConfirmDeleteId(null)
      toast.success('Template deleted')
    },
    [orgId]
  )

  const sortedTemplates = useMemo(
    () =>
      [...templates].sort(
        (a, b) => new Date(b.last_used_at).getTime() - new Date(a.last_used_at).getTime()
      ),
    [templates]
  )

  return (
    <div className={cn('relative', className)}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'btn-press flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all',
          isOpen
            ? 'bg-[var(--primary)] text-white'
            : 'border border-border text-[var(--text-secondary)] hover:bg-[var(--secondary)]'
        )}
        style={{ minHeight: 36 }}
      >
        <Star className="h-3.5 w-3.5" />
        The Usual
        <ChevronDown className={cn('h-3 w-3 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          <div
            className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl bg-white py-2 animate-fade-in"
            style={{ boxShadow: 'var(--shadow-xl)' }}
          >
            {/* Save current order */}
            {currentItems && currentItems.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  setShowSaveDialog(true)
                }}
                className="row-press flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[var(--primary)] font-semibold"
              >
                <Plus className="h-4 w-4" />
                Save Current Order as Template
              </button>
            )}

            {currentItems && currentItems.length > 0 && templates.length > 0 && (
              <div className="my-1 border-t border-border" />
            )}

            {/* Template list */}
            {sortedTemplates.length === 0 && (
              <div className="px-4 py-6 text-center">
                <ShoppingBag className="h-8 w-8 mx-auto text-[var(--text-muted)] mb-2" />
                <p className="text-xs text-[var(--text-muted)]">No saved templates</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Save an order to create a template
                </p>
              </div>
            )}

            {sortedTemplates.map((template) => {
              const itemCount = template.items.reduce((sum, i) => sum + i.quantity, 0)
              const lastUsed = new Date(template.last_used_at)
              const isConfirmingDelete = confirmDeleteId === template.id

              return (
                <div
                  key={template.id}
                  className="group flex items-center gap-2 px-3 py-2 hover:bg-[var(--secondary)] transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => handleSelectTemplate(template)}
                    className="flex-1 text-left min-w-0"
                  >
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {template.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                      <span>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
                      <span className="text-[var(--border)]">|</span>
                      <Clock className="h-3 w-3" />
                      <span>
                        {lastUsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </button>

                  {isConfirmingDelete ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="btn-press flex h-7 items-center gap-1 rounded-md bg-[var(--error)] px-2 text-[10px] font-bold text-white transition-colors"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="btn-press flex h-7 items-center rounded-md px-2 text-[10px] font-semibold text-[var(--text-muted)] hover:bg-[var(--secondary)]"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(template.id)}
                      className="hidden group-hover:flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--error-bg)] hover:text-[var(--error)] transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Save dialog */}
      {showSaveDialog && currentItems && currentItems.length > 0 && (
        <SaveTemplateDialog
          items={currentItems}
          onSave={handleSaveTemplate}
          onCancel={() => setShowSaveDialog(false)}
        />
      )}
    </div>
  )
}
