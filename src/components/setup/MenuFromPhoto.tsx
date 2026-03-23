'use client'

import { useState, useCallback, useRef } from 'react'
import { Camera, Upload, Loader2, AlertTriangle, ChevronRight, Trash2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface ExtractedItem {
  name: string
  description: string
  price: string
  category: string
  confidence: 'high' | 'medium' | 'low'
}

interface MenuFromPhotoProps {
  onComplete: (items: Array<{ name: string; price: string; category: string }>) => void
  onBack: () => void
}

export function MenuFromPhoto({ onComplete, onBack }: MenuFromPhotoProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [items, setItems] = useState<ExtractedItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [hasLowConfidence, setHasLowConfidence] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be under 10MB')
      return
    }

    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string
      setImagePreview(base64)

      // Send to API for extraction
      setIsExtracting(true)
      try {
        const res = await fetch('/api/setup/menu-from-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64 }),
        })

        if (!res.ok) {
          const data = await res.json()
          setError(data.error ?? 'Failed to extract menu items')
          setIsExtracting(false)
          return
        }

        const data = await res.json()
        const extracted = (data.items ?? []) as ExtractedItem[]
        setItems(extracted)
        setHasLowConfidence(extracted.some((item) => item.confidence === 'low'))
      } catch {
        setError('Network error. Please try again.')
      } finally {
        setIsExtracting(false)
      }
    }
    reader.readAsDataURL(file)
  }, [])

  const updateItem = useCallback((index: number, field: keyof ExtractedItem, value: string) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    )
  }, [])

  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const addItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      { name: '', description: '', price: '0.00', category: 'General', confidence: 'high' as const },
    ])
  }, [])

  const handleConfirm = useCallback(() => {
    const validItems = items
      .filter((item) => item.name.trim())
      .map((item) => ({
        name: item.name.trim(),
        price: item.price,
        category: item.category,
      }))
    onComplete(validItems)
  }, [items, onComplete])

  // Upload state
  if (!imagePreview) {
    return (
      <div className="space-y-6">
        <button onClick={onBack} className="text-callout text-[var(--primary)] btn-press">
          &larr; Back to import options
        </button>

        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent)]">
            <Camera className="h-8 w-8 text-[var(--primary)]" />
          </div>
          <h1 className="text-title-2 font-semibold text-[var(--foreground)]">Upload a menu photo</h1>
          <p className="mt-2 text-body text-[var(--muted-foreground)]">
            Take a photo of your paper menu or upload an image. Our AI will extract all items and prices.
          </p>
        </div>

        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--secondary)] px-8 py-16 transition-colors hover:border-[var(--primary)]">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleImageUpload}
          />
          <Upload className="mb-3 h-12 w-12 text-[var(--muted-foreground)]" />
          <span className="text-headline text-[var(--foreground)]">Choose an image</span>
          <span className="mt-1 text-footnote text-[var(--muted-foreground)]">
            JPG, PNG, or HEIC up to 10MB
          </span>
        </label>

        {error && (
          <p className="text-center text-footnote text-[var(--destructive)]">{error}</p>
        )}

        <div className="rounded-xl bg-[var(--info-bg)] p-4">
          <p className="text-footnote text-[var(--info)]">
            Tips for best results: Take a clear, well-lit photo. Avoid shadows and glare.
            The AI works best with printed menus. Handwritten menus may need more manual corrections.
          </p>
        </div>
      </div>
    )
  }

  // Extracting state
  if (isExtracting) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-[var(--primary)]" />
          <h2 className="text-title-2 font-semibold text-[var(--foreground)]">
            Reading your menu...
          </h2>
          <p className="mt-2 text-body text-[var(--muted-foreground)]">
            Our AI is extracting items, prices, and categories. This usually takes 10-30 seconds.
          </p>
        </div>
        {imagePreview && (
          <div className="mx-auto max-w-sm overflow-hidden rounded-2xl border border-[var(--border)] shadow-warm-md">
            <img src={imagePreview} alt="Uploaded menu" className="w-full" />
          </div>
        )}
      </div>
    )
  }

  // Review & edit state
  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-callout text-[var(--primary)] btn-press">
        &larr; Back to import options
      </button>

      <div className="text-center">
        <h1 className="text-title-2 font-semibold text-[var(--foreground)]">
          Review extracted items
        </h1>
        <p className="mt-1 text-body text-[var(--muted-foreground)]">
          {items.length} items found. Review and correct any errors before importing.
        </p>
      </div>

      {hasLowConfidence && (
        <div className="flex items-start gap-3 rounded-xl bg-[var(--warning-bg)] p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--warning)]" />
          <p className="text-footnote text-[var(--warning)]">
            Some items were difficult to read clearly. Items marked with a yellow indicator may need correction.
          </p>
        </div>
      )}

      {error && (
        <p className="text-center text-footnote text-[var(--destructive)]">{error}</p>
      )}

      {/* Items table */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-warm-sm">
        <div className="max-h-[400px] overflow-y-auto scroll-container">
          <table className="w-full">
            <thead className="sticky top-0 bg-[var(--card)] z-10">
              <tr className="border-b border-[var(--border)] text-left text-footnote text-[var(--muted-foreground)]">
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5 w-24">Price</th>
                <th className="px-4 py-2.5 w-32">Category</th>
                <th className="px-4 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr
                  key={i}
                  className={cn(
                    'border-b border-[var(--border)] last:border-0',
                    item.confidence === 'low' && 'bg-[var(--warning-bg)]'
                  )}
                >
                  <td className="px-3 py-1.5">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(i, 'name', e.target.value)}
                      className="w-full rounded-lg border-0 bg-transparent px-1 py-1.5 text-callout text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center">
                      <span className="text-callout text-[var(--muted-foreground)]">$</span>
                      <input
                        type="text"
                        value={item.price}
                        onChange={(e) => updateItem(i, 'price', e.target.value)}
                        className="w-full rounded-lg border-0 bg-transparent px-1 py-1.5 text-callout tabular-nums text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                      />
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="text"
                      value={item.category}
                      onChange={(e) => updateItem(i, 'category', e.target.value)}
                      className="w-full rounded-lg border-0 bg-transparent px-1 py-1.5 text-callout text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <button
                      onClick={() => removeItem(i)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--error-bg)] hover:text-[var(--destructive)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button
          onClick={addItem}
          variant="outline"
          className="h-10 rounded-xl"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Add Item
        </Button>

        <div className="flex gap-3">
          <Button
            onClick={() => {
              setImagePreview(null)
              setItems([])
              setError(null)
            }}
            variant="outline"
            className="h-12 rounded-xl px-6"
          >
            Re-upload
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={items.filter((i) => i.name.trim()).length === 0}
            className="h-12 rounded-xl bg-[var(--primary)] px-8 text-callout font-semibold text-white shadow-warm-md"
          >
            Import {items.filter((i) => i.name.trim()).length} Items
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
