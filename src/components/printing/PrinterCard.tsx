'use client';

import { Clock, Edit2, Trash2, Wifi, Bluetooth, Cloud, Usb } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PrinterStatusBadge } from './PrinterStatusBadge';
import { TestPrintButton } from './TestPrintButton';
import {
  PRINTER_MODEL_LABELS,
  PRINTER_ROLE_LABELS,
  type PrinterConfig,
  type ConnectionType,
} from '@/lib/printing/printer-interface';
import { cn } from '@/lib/utils';

interface PrinterCardProps {
  printer: PrinterConfig;
  onEdit: (printer: PrinterConfig) => void;
  onDelete: (printer: PrinterConfig) => void;
}

const connectionIcons: Record<ConnectionType, typeof Wifi> = {
  network: Wifi,
  cloudprnt: Cloud,
  bluetooth: Bluetooth,
  usb: Usb,
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function PrinterCard({ printer, onEdit, onDelete }: PrinterCardProps) {
  const ConnectionIcon = connectionIcons[printer.connection_type];
  const modelLabel = PRINTER_MODEL_LABELS[printer.model] ?? printer.model;
  const roleLabel = PRINTER_ROLE_LABELS[printer.role] ?? printer.role;

  return (
    <Card
      className={cn(
        'shadow-warm-sm transition-shadow hover:shadow-warm-md',
        !printer.is_active && 'opacity-60'
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Info */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Name + Status */}
            <div className="flex items-center gap-3">
              <h3 className="text-base font-semibold text-foreground truncate">
                {printer.name}
              </h3>
              <PrinterStatusBadge status={printer.status as 'online' | 'offline' | 'error'} />
            </div>

            {/* Model + Role */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground/80">{modelLabel}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary-subtle)] px-2.5 py-0.5 text-xs font-medium text-[var(--primary)]">
                {roleLabel}
              </span>
              {printer.station_name && (
                <span className="text-xs text-muted-foreground">
                  Station: {printer.station_name}
                </span>
              )}
            </div>

            {/* Connection info */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ConnectionIcon className="h-3.5 w-3.5" />
                {printer.ip_address
                  ? `${printer.ip_address}:${printer.port}`
                  : printer.connection_type}
              </span>

              {printer.cash_drawer.enabled && (
                <span className="inline-flex items-center gap-1 text-xs">
                  Cash drawer (Pin {printer.cash_drawer.pin})
                </span>
              )}

              {printer.last_print_at && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Last print: {timeAgo(printer.last_print_at)}
                </span>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(printer)}
                className="h-9 w-9 touch-target"
                title="Edit printer"
              >
                <Edit2 className="h-4 w-4" />
                <span className="sr-only">Edit</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(printer)}
                className="h-9 w-9 touch-target text-muted-foreground hover:text-[var(--error)]"
                title="Delete printer"
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete</span>
              </Button>
            </div>
            <TestPrintButton printerId={printer.id} size="sm" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
