'use client'

import { useState, useCallback, useRef } from 'react'
import {
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  File,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { parseMenuCSV, type ParsedRow, type ParseResult } from '@/lib/menu/csv-parser'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImportExportDialogProps {
  isOpen: boolean
  onClose: () => void
  orgId: string
  locationId: string
  onImportComplete: () => void
  categoryFilter?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImportExportDialog({
  isOpen,
  onClose,
  orgId,
  locationId,
  onImportComplete,
  categoryFilter,
}: ImportExportDialogProps) {
  const [activeTab, setActiveTab] = useState<string>('export')

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[700px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5" />
            Import / Export Menu
          </DialogTitle>
          <DialogDescription>
            Export your menu to CSV or import items from a spreadsheet.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full">
            <TabsTrigger value="export" className="flex-1">
              <Download className="size-4 mr-1.5" />
              Export
            </TabsTrigger>
            <TabsTrigger value="import" className="flex-1">
              <Upload className="size-4 mr-1.5" />
              Import
            </TabsTrigger>
            <TabsTrigger value="template" className="flex-1">
              <File className="size-4 mr-1.5" />
              Template
            </TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="flex-1 pt-4">
            <ExportTab
              orgId={orgId}
              locationId={locationId}
              categoryFilter={categoryFilter}
            />
          </TabsContent>

          <TabsContent value="import" className="flex-1 pt-4 overflow-hidden flex flex-col">
            <ImportTab
              orgId={orgId}
              locationId={locationId}
              onImportComplete={onImportComplete}
            />
          </TabsContent>

          <TabsContent value="template" className="flex-1 pt-4">
            <TemplateTab />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Export Tab
// ---------------------------------------------------------------------------

function ExportTab({
  orgId,
  locationId,
  categoryFilter,
}: {
  orgId: string
  locationId: string
  categoryFilter?: string
}) {
  const [activeOnly, setActiveOnly] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = useCallback(async () => {
    setIsExporting(true)
    try {
      const params = new URLSearchParams({
        org_id: orgId,
        location_id: locationId,
      })
      if (activeOnly) params.set('active_only', 'true')
      if (categoryFilter) params.set('category_id', categoryFilter)

      const res = await fetch(`/api/menu/items/export?${params}`)
      if (!res.ok) throw new Error('Export failed')

      const csvText = await res.text()
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `menu-export-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setIsExporting(false)
    }
  }, [orgId, locationId, activeOnly, categoryFilter])

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Export your menu items as a CSV file. You can open it in Excel, Google Sheets, or any
          spreadsheet application.
        </p>

        <div className="flex items-center justify-between">
          <Label className="text-sm">Active items only</Label>
          <button
            type="button"
            onClick={() => setActiveOnly(!activeOnly)}
            className="touch-target flex items-center"
          >
            <Switch checked={activeOnly} />
          </button>
        </div>

        {categoryFilter && (
          <p className="text-xs text-muted-foreground">
            Filtered to current category selection
          </p>
        )}
      </div>

      <Button
        onClick={handleExport}
        disabled={isExporting}
        className="w-full btn-press"
        size="lg"
      >
        <Download className="size-4 mr-2" />
        {isExporting ? 'Exporting...' : 'Download CSV'}
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Import Tab
// ---------------------------------------------------------------------------

function ImportTab({
  orgId,
  locationId,
  onImportComplete,
}: {
  orgId: string
  locationId: string
  onImportComplete: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [editedRows, setEditedRows] = useState<Map<number, ParsedRow>>(new Map())
  const [skipErrors, setSkipErrors] = useState(false)
  const [createCategories, setCreateCategories] = useState(true)
  const [updateExisting, setUpdateExisting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const processFile = useCallback((file: globalThis.File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (text) {
        const result = parseMenuCSV(text)
        setParseResult(result)
        setEditedRows(new Map())
        setImportResult(null)
      }
    }
    reader.readAsText(file)
  }, [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) processFile(file)
    },
    [processFile]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
        processFile(file)
      }
    },
    [processFile]
  )

  const handleImport = useCallback(async () => {
    if (!parseResult) return

    const rowsToImport = parseResult.all.filter((row) => {
      if (row.status === 'error' && !skipErrors) return false
      if (row.status === 'error') return false // Always skip true errors
      return true
    })

    if (rowsToImport.length === 0) return

    setIsImporting(true)
    try {
      const res = await fetch('/api/menu/items/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          location_id: locationId,
          rows: rowsToImport,
          create_categories: createCategories,
          update_existing: updateExisting,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setImportResult({
          imported: data.imported ?? rowsToImport.length,
          skipped: data.skipped ?? 0,
        })
        onImportComplete()
      }
    } finally {
      setIsImporting(false)
    }
  }, [parseResult, skipErrors, orgId, locationId, createCategories, updateExisting, onImportComplete])

  const importableCount = parseResult
    ? parseResult.all.filter((r) => r.status !== 'error').length
    : 0

  if (importResult) {
    return (
      <div className="flex flex-col items-center py-8 text-center space-y-4">
        <div className="rounded-full bg-success/10 p-4">
          <CheckCircle2 className="size-8 text-success" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">Import Complete</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {importResult.imported} item{importResult.imported !== 1 ? 's' : ''} imported successfully.
            {importResult.skipped > 0 && (
              <> {importResult.skipped} skipped.</>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setParseResult(null)
            setImportResult(null)
          }}
          className="btn-press"
        >
          Import More
        </Button>
      </div>
    )
  }

  if (!parseResult) {
    return (
      <div className="space-y-4">
        <div
          className={cn(
            'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer',
            isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-foreground/20'
          )}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          <Upload className="size-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground">
            Drop a CSV file here or click to browse
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Supports .csv files
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    )
  }

  return (
    <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
      {/* Stats */}
      <div className="flex items-center gap-3 text-xs">
        <Badge variant="secondary" className="gap-1">
          {parseResult.totalRows} rows
        </Badge>
        <Badge variant="secondary" className="gap-1 text-success border-success/20">
          <CheckCircle2 className="size-3" />
          {parseResult.validCount} valid
        </Badge>
        {parseResult.errorCount > 0 && (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="size-3" />
            {parseResult.errorCount} errors
          </Badge>
        )}
        {parseResult.warningCount > 0 && (
          <Badge variant="secondary" className="gap-1 text-amber-600 border-amber-200">
            <AlertTriangle className="size-3" />
            {parseResult.warningCount} warnings
          </Badge>
        )}
      </div>

      {/* Preview table */}
      <ScrollArea className="flex-1 max-h-[300px] border border-border rounded-lg">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium w-8">#</th>
              <th className="px-2 py-1.5 text-left font-medium w-8">Status</th>
              <th className="px-2 py-1.5 text-left font-medium">Name</th>
              <th className="px-2 py-1.5 text-left font-medium">Category</th>
              <th className="px-2 py-1.5 text-right font-medium">Price</th>
              <th className="px-2 py-1.5 text-left font-medium">Issues</th>
            </tr>
          </thead>
          <tbody>
            {parseResult.all.map((row) => {
              const edited = editedRows.get(row.rowNumber)
              const displayRow = edited ?? row
              return (
                <tr
                  key={row.rowNumber}
                  className={cn(
                    'border-t border-border/50',
                    row.status === 'error' && 'bg-destructive/5',
                    row.status === 'warning' && 'bg-amber-50'
                  )}
                >
                  <td className="px-2 py-1.5 text-muted-foreground tabular-nums">
                    {row.rowNumber}
                  </td>
                  <td className="px-2 py-1.5">
                    {row.status === 'valid' && <CheckCircle2 className="size-3.5 text-success" />}
                    {row.status === 'warning' && <AlertTriangle className="size-3.5 text-amber-500" />}
                    {row.status === 'error' && <XCircle className="size-3.5 text-destructive" />}
                  </td>
                  <td className="px-2 py-1.5 font-medium text-foreground max-w-[150px] truncate">
                    {displayRow.name || <span className="text-muted-foreground italic">missing</span>}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground max-w-[100px] truncate">
                    {displayRow.category || '-'}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-foreground">
                    {displayRow.price ? `$${displayRow.price}` : '-'}
                  </td>
                  <td className="px-2 py-1.5 max-w-[200px]">
                    {row.errors.length > 0 && (
                      <span className="text-destructive">{row.errors[0]}</span>
                    )}
                    {row.errors.length === 0 && row.warnings.length > 0 && (
                      <span className="text-amber-600">{row.warnings[0]}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </ScrollArea>

      {/* Options */}
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between py-1">
          <Label className="text-xs">Create new categories if missing</Label>
          <button
            type="button"
            onClick={() => setCreateCategories(!createCategories)}
            className="touch-target flex items-center"
          >
            <Switch checked={createCategories} />
          </button>
        </div>
        <div className="flex items-center justify-between py-1">
          <Label className="text-xs">Update existing items by PLU/Name match</Label>
          <button
            type="button"
            onClick={() => setUpdateExisting(!updateExisting)}
            className="touch-target flex items-center"
          >
            <Switch checked={updateExisting} />
          </button>
        </div>
      </div>

      {/* Import button */}
      <div className="flex items-center gap-2 pt-2 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setParseResult(null)
            setEditedRows(new Map())
          }}
          className="btn-press"
        >
          Clear
        </Button>
        <div className="flex-1" />
        <Button
          onClick={handleImport}
          disabled={importableCount === 0 || isImporting}
          className="btn-press"
        >
          {isImporting ? (
            <Loader2 className="size-4 mr-1 animate-spin" />
          ) : (
            <Upload className="size-4 mr-1" />
          )}
          {isImporting
            ? 'Importing...'
            : `Import ${importableCount} item${importableCount !== 1 ? 's' : ''}`}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Template Tab
// ---------------------------------------------------------------------------

function TemplateTab() {
  const handleDownload = useCallback(() => {
    // Generate template inline to avoid server round-trip
    const headers = [
      'Name', 'Short Name', 'Category', 'Price', 'Cost', 'Tax Class',
      'PLU', 'Barcode', 'Description', 'Allergens', 'Dietary Tags',
      'Prep Station', 'Course', 'Active', '86d',
    ].join(',')

    const example = [
      'Grilled Salmon', 'GRL SALMN', 'Entrees', '24.99', '8.50', 'Taxable',
      '1001', '', 'Fresh Atlantic salmon with lemon herb butter',
      'fish; milk', 'gluten_free', 'grill', 'entree', 'Yes', 'No',
    ].join(',')

    const csv = [headers, example].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sear-menu-import-template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          Download a blank CSV template with all column headers and one example row.
          Fill it in with your menu data and import on the Import tab.
        </p>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-foreground">Column reference:</p>
          <div className="grid grid-cols-3 gap-1 text-[11px] text-muted-foreground">
            <span><b className="text-foreground">Name</b> (required)</span>
            <span><b className="text-foreground">Price</b> (required)</span>
            <span><b className="text-foreground">Category</b></span>
            <span><b className="text-foreground">Short Name</b> (KDS)</span>
            <span><b className="text-foreground">Cost</b></span>
            <span><b className="text-foreground">Tax Class</b></span>
            <span><b className="text-foreground">PLU</b></span>
            <span><b className="text-foreground">Barcode</b></span>
            <span><b className="text-foreground">Description</b></span>
            <span><b className="text-foreground">Allergens</b> (semicolons)</span>
            <span><b className="text-foreground">Dietary Tags</b></span>
            <span><b className="text-foreground">Prep Station</b></span>
            <span><b className="text-foreground">Course</b></span>
            <span><b className="text-foreground">Active</b> (Yes/No)</span>
            <span><b className="text-foreground">86&apos;d</b> (Yes/No)</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-foreground">Allergen codes:</p>
          <p className="text-[11px] text-muted-foreground">
            celery, gluten, crustaceans, eggs, fish, lupin, milk, molluscs, mustard,
            tree_nuts, peanuts, sesame, soy, sulphites, coconut, shellfish, corn, latex_fruits
          </p>
        </div>
      </div>

      <Button onClick={handleDownload} className="w-full btn-press" size="lg">
        <Download className="size-4 mr-2" />
        Download Template
      </Button>
    </div>
  )
}
