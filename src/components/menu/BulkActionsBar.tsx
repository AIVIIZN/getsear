'use client'

import { useState, useCallback } from 'react'
import {
  FolderInput,
  Ban,
  RotateCcw,
  Trash2,
  DollarSign,
  CheckSquare,
  XSquare,
  X,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Category {
  id: string
  name: string
}

export type BulkAction = 'move' | '86' | 'restore' | 'delete' | 'price_change'

interface BulkActionsBarProps {
  selectedCount: number
  selectedItemIds: string[]
  categories: Category[]
  onAction: (action: BulkAction, params?: Record<string, unknown>) => Promise<void>
  onSelectAll: () => void
  onDeselectAll: () => void
  className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BulkActionsBar({
  selectedCount,
  selectedItemIds,
  categories,
  onAction,
  onSelectAll,
  onDeselectAll,
  className,
}: BulkActionsBarProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeAction, setActiveAction] = useState<BulkAction | null>(null)

  // Move to category
  const [showMoveDialog, setShowMoveDialog] = useState(false)
  const [targetCategoryId, setTargetCategoryId] = useState('')

  // Delete confirmation
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Price change
  const [showPriceDialog, setShowPriceDialog] = useState(false)
  const [priceChangeType, setPriceChangeType] = useState<'percentage' | 'fixed'>('percentage')
  const [priceChangeValue, setPriceChangeValue] = useState('')

  const executeAction = useCallback(
    async (action: BulkAction, params?: Record<string, unknown>) => {
      setIsProcessing(true)
      setActiveAction(action)
      try {
        await onAction(action, params)
      } finally {
        setIsProcessing(false)
        setActiveAction(null)
        setShowMoveDialog(false)
        setShowDeleteDialog(false)
        setShowPriceDialog(false)
      }
    },
    [onAction]
  )

  if (selectedCount === 0) return null

  return (
    <>
      {/* Floating bar */}
      <div
        className={cn(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
          'flex items-center gap-2 rounded-2xl bg-foreground/95 backdrop-blur-sm px-4 py-2.5 shadow-2xl',
          'animate-in slide-in-from-bottom-5 duration-200',
          className
        )}
      >
        <Badge
          variant="secondary"
          className="bg-white/15 text-white border-0 text-xs font-bold tabular-nums"
        >
          {selectedCount} selected
        </Badge>

        <div className="h-5 w-px bg-white/20 mx-1" />

        {/* Select All / Deselect All */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-white/80 hover:text-white hover:bg-white/10 text-xs"
          onClick={onSelectAll}
        >
          <CheckSquare className="size-3.5 mr-1" />
          All
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-white/80 hover:text-white hover:bg-white/10 text-xs"
          onClick={onDeselectAll}
        >
          <XSquare className="size-3.5 mr-1" />
          None
        </Button>

        <div className="h-5 w-px bg-white/20 mx-1" />

        {/* Action buttons */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-white/80 hover:text-white hover:bg-white/10 text-xs"
          onClick={() => setShowMoveDialog(true)}
          disabled={isProcessing}
        >
          <FolderInput className="size-3.5 mr-1" />
          Move
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-white/80 hover:text-white hover:bg-white/10 text-xs"
          onClick={() => executeAction('86')}
          disabled={isProcessing}
        >
          {activeAction === '86' ? (
            <Loader2 className="size-3.5 mr-1 animate-spin" />
          ) : (
            <Ban className="size-3.5 mr-1" />
          )}
          86
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-white/80 hover:text-white hover:bg-white/10 text-xs"
          onClick={() => executeAction('restore')}
          disabled={isProcessing}
        >
          {activeAction === 'restore' ? (
            <Loader2 className="size-3.5 mr-1 animate-spin" />
          ) : (
            <RotateCcw className="size-3.5 mr-1" />
          )}
          Restore
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-white/80 hover:text-white hover:bg-white/10 text-xs"
          onClick={() => setShowPriceDialog(true)}
          disabled={isProcessing}
        >
          <DollarSign className="size-3.5 mr-1" />
          Price
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs"
          onClick={() => setShowDeleteDialog(true)}
          disabled={isProcessing}
        >
          <Trash2 className="size-3.5 mr-1" />
          Delete
        </Button>

        <div className="h-5 w-px bg-white/20 mx-1" />

        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-white/60 hover:text-white hover:bg-white/10"
          onClick={onDeselectAll}
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Move to Category Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Move to Category</DialogTitle>
            <DialogDescription>
              Move {selectedCount} item{selectedCount !== 1 ? 's' : ''} to a different category.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setTargetCategoryId(cat.id)}
                className={cn(
                  'flex w-full items-center rounded-lg border px-3 py-2.5 text-left text-sm transition-colors touch-target',
                  targetCategoryId === cat.id
                    ? 'border-primary bg-accent font-medium'
                    : 'border-border hover:border-foreground/20'
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => executeAction('move', { category_id: targetCategoryId })}
              disabled={!targetCategoryId || isProcessing}
            >
              {isProcessing ? <Loader2 className="size-4 mr-1 animate-spin" /> : <FolderInput className="size-4 mr-1" />}
              Move Items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Items</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedCount} item{selectedCount !== 1 ? 's' : ''}?
              This action is permanent and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => executeAction('delete')}
              disabled={isProcessing}
            >
              {isProcessing ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Trash2 className="size-4 mr-1" />}
              Delete {selectedCount} Item{selectedCount !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Price Change Dialog */}
      <Dialog open={showPriceDialog} onOpenChange={setShowPriceDialog}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Bulk Price Change</DialogTitle>
            <DialogDescription>
              Adjust prices for {selectedCount} item{selectedCount !== 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Button
                variant={priceChangeType === 'percentage' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPriceChangeType('percentage')}
                className="flex-1"
              >
                Percentage
              </Button>
              <Button
                variant={priceChangeType === 'fixed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPriceChangeType('fixed')}
                className="flex-1"
              >
                Fixed Amount
              </Button>
            </div>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {priceChangeType === 'percentage' ? '%' : '$'}
              </span>
              <Input
                placeholder={priceChangeType === 'percentage' ? 'e.g., 10 or -5' : 'e.g., 1.50 or -0.50'}
                value={priceChangeValue}
                onChange={(e) => setPriceChangeValue(e.target.value)}
                className="pl-7 tabular-nums"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {priceChangeType === 'percentage'
                ? 'Use positive for increase, negative for decrease. E.g., 10 = +10%, -5 = -5%'
                : 'Use positive to add, negative to subtract. E.g., 1.50 = +$1.50, -0.50 = -$0.50'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPriceDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                executeAction('price_change', {
                  type: priceChangeType,
                  value: parseFloat(priceChangeValue),
                })
              }
              disabled={!priceChangeValue || isNaN(parseFloat(priceChangeValue)) || isProcessing}
            >
              {isProcessing ? <Loader2 className="size-4 mr-1 animate-spin" /> : <DollarSign className="size-4 mr-1" />}
              Apply Price Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
