"use client";

import { Wifi, WifiOff, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";

export interface RegisteredHardwareTerminal {
  id: string;
  device_class: string;
  mfg: string;
  model: string;
  identifier: string;
  last_seen_at: string;
  status: "online" | "offline" | "error" | string;
}

interface TerminalListTableProps {
  terminals: RegisteredHardwareTerminal[];
}

function StatusPill({ status }: { status: string }) {
  if (status === "online") {
    return (
      <Badge variant="success" className="gap-1">
        <Wifi className="h-3 w-3" />
        Online
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        Error
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <WifiOff className="h-3 w-3" />
      Offline
    </Badge>
  );
}

function truncateIdentifier(identifier: string): string {
  if (identifier.length <= 22) return identifier;
  return `${identifier.slice(0, 10)}...${identifier.slice(-8)}`;
}

function formatLastSeen(iso: string): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const DEVICE_CLASS_LABELS: Record<string, string> = {
  card_reader: "Card reader",
  receipt_printer: "Receipt printer",
  kitchen_printer: "Kitchen printer",
  cash_drawer: "Cash drawer",
  barcode_scanner: "Barcode scanner",
  scale: "Scale",
  pinpad: "PIN pad",
};

function deviceClassLabel(deviceClass: string): string {
  return (
    DEVICE_CLASS_LABELS[deviceClass] ??
    deviceClass.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function TerminalListTable({ terminals }: TerminalListTableProps) {
  return (
    <Card className="shadow-warm-sm">
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="pl-4">Device</TableHead>
              <TableHead>Mfg / Model</TableHead>
              <TableHead>Identifier</TableHead>
              <TableHead>Last seen</TableHead>
              <TableHead className="pr-4">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {terminals.map((t) => (
              <TableRow key={t.id} className="even:bg-muted/20">
                <TableCell className="pl-4 font-medium">
                  {deviceClassLabel(t.device_class)}
                </TableCell>
                <TableCell>
                  <span className="text-sm">
                    {t.mfg} {t.model}
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className="font-mono text-xs text-muted-foreground"
                    title={t.identifier}
                  >
                    {truncateIdentifier(t.identifier)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">
                    {formatLastSeen(t.last_seen_at)}
                  </span>
                </TableCell>
                <TableCell className="pr-4">
                  <StatusPill status={t.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
