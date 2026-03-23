'use client'

import { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { QrCode, Plus, Download, Printer, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'

interface QRCode {
  id: string
  type: string
  table_number: string | null
  label: string
  url: string
  created_at: string
}

interface QRCodeGeneratorProps {
  locationId: string
}

export function QRCodeGenerator({ locationId }: QRCodeGeneratorProps) {
  const [codes, setCodes] = useState<QRCode[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formType, setFormType] = useState('general')
  const [formTable, setFormTable] = useState('')
  const [formLabel, setFormLabel] = useState('')

  const fetchCodes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/online-ordering/qr?location_id=${locationId}`)
      const json = await res.json()
      if (res.ok) setCodes(json.data ?? [])
    } catch {
      toast.error('Failed to load QR codes')
    } finally {
      setLoading(false)
    }
  }, [locationId])

  useEffect(() => {
    if (locationId) fetchCodes()
  }, [fetchCodes, locationId])

  const handleCreate = async () => {
    if (!formType) {
      toast.error('Select a QR code type')
      return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/online-ordering/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: locationId,
          type: formType,
          table_number: formType === 'table' ? formTable : undefined,
          label: formLabel || undefined,
        }),
      })

      if (res.ok) {
        toast.success('QR code created')
        setShowCreate(false)
        setFormType('general')
        setFormTable('')
        setFormLabel('')
        fetchCodes()
      } else {
        const json = await res.json()
        toast.error(json.error ?? 'Failed to create QR code')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setCreating(false)
    }
  }

  // Simple QR code SVG generation (data URL based)
  const generateQRSvg = (url: string, size: number = 200) => {
    // Use a simple checkered pattern as placeholder QR visual
    // In production, use a proper QR library like qrcode.react
    const encoded = encodeURIComponent(url)
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&format=svg`
  }

  if (loading) {
    return <Skeleton className="h-64 rounded-xl" />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <QrCode className="h-4 w-4" />
          QR Codes
        </h3>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Generate QR
        </Button>
      </div>

      {codes.length === 0 ? (
        <Card className="border-warm shadow-warm">
          <CardContent className="py-8 text-center">
            <QrCode className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No QR codes yet</p>
            <Button className="mt-3" size="sm" onClick={() => setShowCreate(true)}>
              Generate First QR Code
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {codes.map((code) => (
            <Card key={code.id} className="border-warm shadow-warm">
              <CardContent className="p-4 text-center">
                <img
                  src={generateQRSvg(code.url)}
                  alt={`QR: ${code.label}`}
                  className="w-32 h-32 mx-auto mb-3"
                />
                <p className="font-medium text-sm">{code.label}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {code.type}
                  {code.table_number && ` - Table ${code.table_number}`}
                </p>
                <div className="flex gap-1.5 justify-center mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      const link = document.createElement('a')
                      link.href = generateQRSvg(code.url, 400)
                      link.download = `qr-${code.label.replace(/\s+/g, '-').toLowerCase()}.svg`
                      link.click()
                    }}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    PNG
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => window.print()}>
                    <Printer className="h-3 w-3 mr-1" />
                    Print
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate QR Code</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={formType} onValueChange={(v) => v && setFormType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General (Takeout)</SelectItem>
                  <SelectItem value="table">Table-Specific</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formType === 'table' && (
              <div className="space-y-1.5">
                <Label>Table Number</Label>
                <Input
                  value={formTable}
                  onChange={(e) => setFormTable(e.target.value)}
                  placeholder="e.g., 12"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Label (optional)</Label>
              <Input
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="e.g., Front Door, Patio"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
