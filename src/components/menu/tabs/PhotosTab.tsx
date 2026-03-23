'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Star, Trash2, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PhotoUploader } from '../PhotoUploader'

export interface MenuItemPhoto {
  id: string
  url: string
  sort_order: number
  is_primary: boolean
}

interface PhotosTabProps {
  itemId: string | null
  photos: MenuItemPhoto[]
  onUpload: (file: File) => Promise<void>
  onDelete: (photoId: string) => Promise<void>
  onReorder: (photoIds: string[]) => Promise<void>
  isUploading: boolean
}

function SortablePhoto({
  photo,
  onDelete,
}: {
  photo: MenuItemPhoto
  onDelete: (id: string) => void
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: photo.id,
    data: { type: 'photo', photo },
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
        'group relative rounded-lg overflow-hidden bg-muted aspect-video',
        isDragging && 'opacity-50 shadow-lg z-50'
      )}
    >
      <img
        src={photo.url}
        alt="Menu item photo"
        className="size-full object-cover"
      />

      {/* Primary badge */}
      {photo.is_primary && (
        <div className="absolute top-1.5 left-1.5 flex items-center gap-0.5 rounded-full bg-[#F06B18] px-1.5 py-0.5 text-[10px] font-bold text-white">
          <Star className="size-2.5" />
          Primary
        </div>
      )}

      {/* Overlay controls */}
      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab rounded-full bg-white/90 p-1.5 shadow-sm"
        >
          <GripVertical className="size-4 text-foreground" />
        </div>
        {showDeleteConfirm ? (
          <div className="flex gap-1">
            <Button
              size="xs"
              variant="destructive"
              onClick={() => onDelete(photo.id)}
            >
              Confirm
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              className="bg-white/90"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-full bg-white/90 p-1.5 shadow-sm hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="size-4 text-destructive" />
          </button>
        )}
      </div>
    </div>
  )
}

export function PhotosTab({
  itemId,
  photos,
  onUpload,
  onDelete,
  onReorder,
  isUploading,
}: PhotosTabProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = photos.findIndex((p) => p.id === active.id)
      const newIndex = photos.findIndex((p) => p.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(photos, oldIndex, newIndex)
      await onReorder(reordered.map((p) => p.id))
    },
    [photos, onReorder]
  )

  if (!itemId) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <ImageIcon className="size-8 text-muted-foreground/40 mb-2" strokeWidth={1.5} />
        <p className="text-sm text-muted-foreground">
          Save the item first, then add photos.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <PhotoUploader onUpload={onUpload} isUploading={isUploading} />

      {/* Photo grid */}
      {photos.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">
            {photos.length} photo{photos.length !== 1 ? 's' : ''} — first photo is primary (shown on POS tile). Drag to reorder.
          </p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={photos.map((p) => p.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-2 gap-2">
                {photos.map((photo) => (
                  <SortablePhoto
                    key={photo.id}
                    photo={photo}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {photos.length === 0 && (
        <p className="text-xs text-muted-foreground text-center">
          No photos yet. Upload the first photo above.
        </p>
      )}
    </div>
  )
}
