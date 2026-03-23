'use client'

import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { TipDistributionResult } from '@/lib/staff/tip-pool-calculator'

interface TipDistributionPreviewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  distributions: TipDistributionResult[]
  onCommit: () => void
  committing: boolean
}

export function TipDistributionPreview({
  open,
  onOpenChange,
  distributions,
  onCommit,
  committing,
}: TipDistributionPreviewProps) {
  const total = distributions.reduce((s, d) => s + d.netTipsCents, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tip Distribution Preview</DialogTitle>
          <DialogDescription>
            Review the calculated distribution before committing. You can adjust after committing within 2 hours.
          </DialogDescription>
        </DialogHeader>

        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Employee</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Card Tips</TableHead>
                <TableHead className="text-right">Pool Share</TableHead>
                <TableHead className="text-right">Tip-out</TableHead>
                <TableHead className="text-right font-semibold">Net Tips</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {distributions.map((d) => (
                <TableRow key={d.userId}>
                  <TableCell className="text-sm font-medium">{d.name}</TableCell>
                  <TableCell className="text-sm capitalize text-muted-foreground">{d.role}</TableCell>
                  <TableCell className="text-sm font-mono text-right">
                    ${(d.cardTipsCents / 100).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-sm font-mono text-right">
                    {d.poolShareCents > 0 ? `$${(d.poolShareCents / 100).toFixed(2)}` : '--'}
                  </TableCell>
                  <TableCell className="text-sm font-mono text-right">
                    {d.tipOutGivenCents > 0 && (
                      <span className="text-red-600">-${(d.tipOutGivenCents / 100).toFixed(2)}</span>
                    )}
                    {d.tipOutReceivedCents > 0 && (
                      <span className="text-green-600">+${(d.tipOutReceivedCents / 100).toFixed(2)}</span>
                    )}
                    {d.tipOutGivenCents === 0 && d.tipOutReceivedCents === 0 && '--'}
                  </TableCell>
                  <TableCell className="text-sm font-mono text-right font-semibold">
                    ${(d.netTipsCents / 100).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between px-2">
          <span className="text-sm text-muted-foreground">Total distributed</span>
          <span className="text-lg font-bold font-mono">${(total / 100).toFixed(2)}</span>
        </div>

        <div className="space-y-1 px-2">
          <p className="text-xs text-muted-foreground font-medium">Formula Breakdown</p>
          {distributions.slice(0, 3).map((d) => (
            <p key={d.userId} className="text-xs text-muted-foreground">
              {d.name}: {d.breakdown}
            </p>
          ))}
          {distributions.length > 3 && (
            <p className="text-xs text-muted-foreground">
              ...and {distributions.length - 3} more
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onCommit} disabled={committing}>
            {committing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Commit Distribution
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
