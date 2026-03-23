'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Printer, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { PrinterCard } from './PrinterCard';
import { AddPrinterWizard } from './AddPrinterWizard';
import { ReceiptConfigForm } from './ReceiptConfigForm';
import { useAuthStore } from '@/stores/auth-store';
import type { PrinterConfig } from '@/lib/printing/printer-interface';

export function PrinterConfigPage() {
  const activeLocationId = useAuthStore((s) => s.activeLocationId);
  const [printers, setPrinters] = useState<PrinterConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<PrinterConfig | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Edit state — reuses the wizard by closing and reopening
  const [editTarget, setEditTarget] = useState<PrinterConfig | null>(null);

  const fetchPrinters = useCallback(async () => {
    if (!activeLocationId) return;
    try {
      const res = await fetch(
        `/api/printing/printers?location_id=${encodeURIComponent(activeLocationId)}`
      );
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();

      // Transform DB rows to PrinterConfig shape
      const data = (json.data ?? []).map(mapDbToPrinterConfig);
      setPrinters(data);
    } catch {
      toast.error('Failed to load printers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeLocationId]);

  useEffect(() => {
    fetchPrinters();
  }, [fetchPrinters]);

  function handleRefresh() {
    setRefreshing(true);
    fetchPrinters();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/printing/printers/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success(`${deleteTarget.name} deleted`);
      setDeleteTarget(null);
      fetchPrinters();
    } catch {
      toast.error('Failed to delete printer');
    } finally {
      setDeleting(false);
    }
  }

  function handleEdit(printer: PrinterConfig) {
    setEditTarget(printer);
    // For now, open an edit dialog. Full edit form is a future enhancement.
    // In V4 Phase 5, we allow inline editing of key fields.
    toast.info(
      `Editing ${printer.name} — use the API or recreate the printer for now.`
    );
  }

  if (!activeLocationId) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Select a location to manage printers.
      </div>
    );
  }

  if (loading) {
    return <PrintersSkeleton />;
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="printers" className="space-y-6">
        <TabsList className="bg-[var(--background-muted)]">
          <TabsTrigger value="printers" className="touch-target">
            Printers
          </TabsTrigger>
          <TabsTrigger value="receipts" className="touch-target">
            Receipt Layout
          </TabsTrigger>
        </TabsList>

        {/* Printers Tab */}
        <TabsContent value="printers" className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Printers</h2>
              <p className="text-sm text-muted-foreground">
                {printers.length} printer{printers.length !== 1 ? 's' : ''}{' '}
                configured
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                disabled={refreshing}
                className="h-11 w-11 touch-target"
                title="Refresh printer status"
              >
                <RefreshCw
                  className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
                />
                <span className="sr-only">Refresh</span>
              </Button>
              <Button
                onClick={() => setWizardOpen(true)}
                className="h-11 gap-2 btn-press touch-target"
              >
                <Plus className="h-4 w-4" />
                Add Printer
              </Button>
            </div>
          </div>

          {/* Printer List */}
          {printers.length === 0 ? (
            <EmptyState
              icon={Printer}
              title="No printers configured"
              description="Add your first receipt or kitchen printer to start printing orders."
              actionLabel="Add Printer"
              onAction={() => setWizardOpen(true)}
            />
          ) : (
            <div className="grid gap-4">
              {printers.map((printer) => (
                <PrinterCard
                  key={printer.id}
                  printer={printer}
                  onEdit={handleEdit}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Receipt Layout Tab */}
        <TabsContent value="receipts">
          <ReceiptConfigForm locationId={activeLocationId} />
        </TabsContent>
      </Tabs>

      {/* Add Printer Wizard */}
      <AddPrinterWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        locationId={activeLocationId}
        onPrinterAdded={fetchPrinters}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Printer</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>
              ? This will also remove any routing rules that reference this
              printer. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="h-11 touch-target"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="h-11 gap-2 touch-target"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete Printer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Map database row to typed PrinterConfig */
function mapDbToPrinterConfig(row: Record<string, unknown>): PrinterConfig {
  return {
    id: row.id as string,
    org_id: row.org_id as string,
    location_id: row.location_id as string,
    name: row.name as string,
    model: row.model as PrinterConfig['model'],
    connection_type: row.connection_type as PrinterConfig['connection_type'],
    ip_address: (row.ip_address as string) ?? null,
    port: (row.port as number) ?? null,
    role: row.role as PrinterConfig['role'],
    station_name: (row.station_name as string) ?? null,
    cash_drawer: {
      enabled: row.cash_drawer_enabled as boolean,
      pin: (row.cash_drawer_pin as 2 | 5) ?? 2,
      pulseDuration: (row.pulse_duration as number) ?? 100,
    },
    is_active: row.is_active as boolean,
    status: (row.status as 'online' | 'offline' | 'error') ?? 'offline',
    last_print_at: (row.last_print_at as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function PrintersSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-11 w-36" />
      </div>
      <div className="grid gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="shadow-warm-sm">
            <CardContent className="p-5">
              <div className="space-y-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-3 w-40" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
