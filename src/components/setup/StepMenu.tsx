'use client'

import { useState, useCallback } from 'react'
import { UtensilsCrossed, Camera, FileSpreadsheet, PenLine, Sparkles, ChevronRight, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { MenuFromPhoto } from './MenuFromPhoto'
import type { StepComponentProps } from './SetupWizard'

type ImportPath = 'photo' | 'csv' | 'scratch' | 'demo' | null

export function StepMenu({ onNext, progress }: StepComponentProps) {
  const [selectedPath, setSelectedPath] = useState<ImportPath>(null)
  const [isSeeding, setIsSeeding] = useState(false)
  const [seedComplete, setSeedComplete] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvParsed, setCsvParsed] = useState(false)
  const [csvItems, setCsvItems] = useState<Array<{ name: string; price: string; category: string }>>([])
  const [csvError, setCsvError] = useState<string | null>(null)

  const handleSeedDemo = useCallback(async () => {
    setIsSeeding(true)
    try {
      const res = await fetch('/api/setup/seed-demo', { method: 'POST' })
      if (res.ok) {
        setSeedComplete(true)
        setTimeout(() => {
          onNext({ import_method: 'demo' })
        }, 1500)
      } else {
        const data = await res.json()
        setCsvError(data.error ?? 'Failed to seed demo data')
      }
    } catch {
      setCsvError('Network error. Please try again.')
    } finally {
      setIsSeeding(false)
    }
  }, [onNext])

  const handleCsvUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvFile(file)
    setCsvError(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string
        const lines = text.split('\n').filter((line) => line.trim())
        if (lines.length < 2) {
          setCsvError('CSV file must have a header row and at least one data row')
          return
        }

        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
        const nameIdx = headers.findIndex((h) => h === 'name' || h === 'item' || h === 'item_name')
        const priceIdx = headers.findIndex((h) => h === 'price' || h === 'cost')
        const catIdx = headers.findIndex((h) => h === 'category' || h === 'cat' || h === 'section')

        if (nameIdx === -1) {
          setCsvError('CSV must have a "name" column. Expected columns: name, price, category')
          return
        }

        const items = lines.slice(1).map((line) => {
          const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
          return {
            name: cols[nameIdx] ?? '',
            price: priceIdx >= 0 ? cols[priceIdx] ?? '0' : '0',
            category: catIdx >= 0 ? cols[catIdx] ?? 'General' : 'General',
          }
        }).filter((item) => item.name)

        setCsvItems(items)
        setCsvParsed(true)
      } catch {
        setCsvError('Failed to parse CSV file')
      }
    }
    reader.readAsText(file)
  }, [])

  const handleCsvConfirm = useCallback(() => {
    onNext({ import_method: 'csv', items: csvItems })
  }, [csvItems, onNext])

  const handleBuildFromScratch = useCallback(() => {
    onNext({ import_method: 'scratch' })
  }, [onNext])

  const handlePhotoComplete = useCallback((items: Array<{ name: string; price: string; category: string }>) => {
    onNext({ import_method: 'photo', items })
  }, [onNext])

  // Show sub-views based on selected path
  if (selectedPath === 'photo') {
    return (
      <MenuFromPhoto
        onComplete={handlePhotoComplete}
        onBack={() => setSelectedPath(null)}
      />
    )
  }

  if (selectedPath === 'csv') {
    return (
      <div className="space-y-6">
        <button
          onClick={() => { setSelectedPath(null); setCsvParsed(false); setCsvItems([]); setCsvFile(null) }}
          className="text-callout text-[var(--primary)] btn-press"
        >
          &larr; Back to import options
        </button>

        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent)]">
            <FileSpreadsheet className="h-8 w-8 text-[var(--primary)]" />
          </div>
          <h1 className="text-title-2 font-semibold text-[var(--foreground)]">Upload CSV</h1>
          <p className="mt-2 text-body text-[var(--muted-foreground)]">
            Upload a CSV file with columns: name, price, category
          </p>
        </div>

        {!csvParsed ? (
          <div className="space-y-4">
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--secondary)] px-8 py-12 transition-colors hover:border-[var(--primary)]">
              <input
                type="file"
                accept=".csv,.tsv,.txt"
                className="hidden"
                onChange={handleCsvUpload}
              />
              <FileSpreadsheet className="mb-3 h-10 w-10 text-[var(--muted-foreground)]" />
              <span className="text-callout font-medium text-[var(--foreground)]">
                {csvFile ? csvFile.name : 'Choose a CSV file'}
              </span>
              <span className="mt-1 text-footnote text-[var(--muted-foreground)]">
                Supports .csv, .tsv, and .txt files
              </span>
            </label>
            {csvError && (
              <p className="text-footnote text-[var(--destructive)]">{csvError}</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-warm-sm">
              <div className="border-b border-[var(--border)] px-4 py-3">
                <span className="text-callout font-medium text-[var(--foreground)]">
                  {csvItems.length} items found
                </span>
              </div>
              <div className="max-h-80 overflow-y-auto scroll-container">
                <table className="w-full">
                  <thead className="sticky top-0 bg-[var(--card)]">
                    <tr className="border-b border-[var(--border)] text-left text-footnote text-[var(--muted-foreground)]">
                      <th className="px-4 py-2">Name</th>
                      <th className="px-4 py-2">Price</th>
                      <th className="px-4 py-2">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvItems.slice(0, 50).map((item, i) => (
                      <tr key={i} className="border-b border-[var(--border)] last:border-0">
                        <td className="px-4 py-2.5 text-callout text-[var(--foreground)]">{item.name}</td>
                        <td className="px-4 py-2.5 text-callout tabular-nums text-[var(--foreground)]">${item.price}</td>
                        <td className="px-4 py-2.5 text-footnote text-[var(--muted-foreground)]">{item.category}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                onClick={() => { setCsvParsed(false); setCsvItems([]) }}
                variant="outline"
                className="h-12 rounded-xl px-6"
              >
                Re-upload
              </Button>
              <Button
                onClick={handleCsvConfirm}
                className="h-12 rounded-xl bg-[var(--primary)] px-8 text-callout font-semibold text-white shadow-warm-md"
              >
                Import {csvItems.length} Items
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Main selection screen
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent)]">
          <UtensilsCrossed className="h-8 w-8 text-[var(--primary)]" />
        </div>
        <h1 className="text-title-1 font-semibold text-[var(--foreground)]">
          Set up your menu
        </h1>
        <p className="mt-2 text-body text-[var(--muted-foreground)]">
          Choose how you want to import your menu items.
        </p>
      </div>

      {/* Import Options */}
      <div className="grid gap-3">
        {/* Photo */}
        <button
          onClick={() => setSelectedPath('photo')}
          className="group flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-left shadow-warm-sm transition-all btn-press hover:shadow-warm-md hover:border-[var(--primary)]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent)]">
            <Camera className="h-6 w-6 text-[var(--primary)]" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-headline text-[var(--foreground)]">Upload a photo</span>
              <span className="rounded-full bg-[var(--primary)] px-2 py-0.5 text-caption-2 font-semibold text-white">AI</span>
            </div>
            <p className="mt-0.5 text-footnote text-[var(--muted-foreground)]">
              Take a photo of your paper menu. Our AI will extract all items and prices.
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-1" />
        </button>

        {/* CSV */}
        <button
          onClick={() => setSelectedPath('csv')}
          className="group flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-left shadow-warm-sm transition-all btn-press hover:shadow-warm-md hover:border-[var(--primary)]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--info-bg)]">
            <FileSpreadsheet className="h-6 w-6 text-[var(--info)]" />
          </div>
          <div className="flex-1">
            <span className="text-headline text-[var(--foreground)]">Upload CSV</span>
            <p className="mt-0.5 text-footnote text-[var(--muted-foreground)]">
              Import from a spreadsheet with columns: name, price, category.
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-1" />
        </button>

        {/* Build from scratch */}
        <button
          onClick={handleBuildFromScratch}
          className="group flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-left shadow-warm-sm transition-all btn-press hover:shadow-warm-md hover:border-[var(--primary)]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--success-bg)]">
            <PenLine className="h-6 w-6 text-[var(--success)]" />
          </div>
          <div className="flex-1">
            <span className="text-headline text-[var(--foreground)]">Build from scratch</span>
            <p className="mt-0.5 text-footnote text-[var(--muted-foreground)]">
              Open the menu builder and add items one by one.
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-1" />
        </button>

        {/* Load sample */}
        <button
          onClick={handleSeedDemo}
          disabled={isSeeding || seedComplete}
          className={cn(
            'group flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-left shadow-warm-sm transition-all btn-press hover:shadow-warm-md hover:border-[var(--primary)]',
            seedComplete && 'border-[var(--success)] bg-[var(--success-bg)]'
          )}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--warning-bg)]">
            {seedComplete ? (
              <Check className="h-6 w-6 text-[var(--success)]" />
            ) : isSeeding ? (
              <Loader2 className="h-6 w-6 animate-spin text-[var(--warning)]" />
            ) : (
              <Sparkles className="h-6 w-6 text-[var(--warning)]" />
            )}
          </div>
          <div className="flex-1">
            <span className="text-headline text-[var(--foreground)]">
              {seedComplete ? 'Demo menu loaded!' : isSeeding ? 'Loading sample menu...' : 'Load sample menu'}
            </span>
            <p className="mt-0.5 text-footnote text-[var(--muted-foreground)]">
              {seedComplete
                ? '50 items across 8 categories have been added.'
                : '50 items across 8 categories. Great for exploring the POS.'}
            </p>
          </div>
          {!isSeeding && !seedComplete && (
            <ChevronRight className="h-5 w-5 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-1" />
          )}
        </button>
      </div>

      {csvError && (
        <p className="text-center text-footnote text-[var(--destructive)]">{csvError}</p>
      )}
    </div>
  )
}
