"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Monitor,
  Plus,
  Loader2,
  Wifi,
  WifiOff,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/stores/auth-store";
import { TERMINAL_TYPES } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import type { Terminal } from "@/types/database";

const TERMINAL_TYPE_LABELS: Record<string, string> = {
  server_station: "Server Station",
  bar: "Bar",
  host: "Host Stand",
  cashier: "Cashier",
  kds: "Kitchen Display",
  kiosk: "Kiosk",
  customer_display: "Customer Display",
  drive_thru: "Drive-Thru",
};

export default function TerminalsPage() {
  const activeLocationId = useAuthStore((s) => s.activeLocationId);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<string>("server_station");

  const fetchTerminals = useCallback(async () => {
    if (!activeLocationId) return;
    try {
      const res = await fetch(`/api/settings/terminals?location_id=${activeLocationId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setTerminals(json.data ?? []);
    } catch {
      toast.error("Failed to load terminals");
    } finally {
      setLoading(false);
    }
  }, [activeLocationId]);

  useEffect(() => {
    fetchTerminals();
  }, [fetchTerminals]);

  async function handleCreate() {
    if (!formName.trim()) {
      toast.error("Terminal name is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/settings/terminals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location_id: activeLocationId,
          name: formName,
          terminal_type: formType,
        }),
      });
      if (!res.ok) throw new Error("Failed to create");
      toast.success("Terminal registered");
      setDialogOpen(false);
      setFormName("");
      setFormType("server_station");
      fetchTerminals();
    } catch {
      toast.error("Failed to register terminal");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(terminal: Terminal) {
    try {
      const res = await fetch(`/api/settings/terminals/${terminal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !terminal.is_active }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success(terminal.is_active ? "Terminal deactivated" : "Terminal activated");
      fetchTerminals();
    } catch {
      toast.error("Failed to update terminal");
    }
  }

  if (loading) {
    return <TerminalsSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Terminals</h2>
          <p className="text-sm text-muted-foreground">
            {terminals.length} terminal{terminals.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="h-11 gap-2 btn-press touch-target"
        >
          <Plus className="h-4 w-4" />
          Register Terminal
        </Button>
      </div>

      {/* Terminal table */}
      {terminals.length === 0 ? (
        <EmptyState
          icon={Monitor}
          title="No terminals registered"
          description="Register your first POS terminal or iPad."
          actionLabel="Register Terminal"
          onAction={() => setDialogOpen(true)}
        />
      ) : (
        <Card className="shadow-warm-sm">
          <CardHeader>
            <CardTitle className="sr-only">Terminals table</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="pl-4">Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Online</TableHead>
                  <TableHead>Last Heartbeat</TableHead>
                  <TableHead className="text-right pr-4">Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {terminals.map((term) => (
                  <TableRow key={term.id} className="even:bg-muted/20">
                    <TableCell className="pl-4 font-medium">{term.name}</TableCell>
                    <TableCell>
                      {TERMINAL_TYPE_LABELS[term.terminal_type] ?? term.terminal_type}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={term.is_active ? "active" : "inactive"} />
                    </TableCell>
                    <TableCell>
                      {term.is_online ? (
                        <Wifi className="h-4 w-4 text-success" />
                      ) : (
                        <WifiOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      {term.last_heartbeat_at ? (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDateTime(term.last_heartbeat_at)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <Switch
                        checked={term.is_active}
                        onCheckedChange={() => toggleActive(term)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Register Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Register Terminal</DialogTitle>
            <DialogDescription>
              Add a new POS terminal for this location.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="term-name">Terminal Name *</Label>
              <Input
                id="term-name"
                className="h-12"
                placeholder="Bar POS 1"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Terminal Type</Label>
              <Select value={formType} onValueChange={(v) => v && setFormType(v)}>
                <SelectTrigger className="h-12 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TERMINAL_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TERMINAL_TYPE_LABELS[t] ?? t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="h-11 touch-target"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={saving}
              className="h-11 gap-2 btn-press touch-target"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Register
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TerminalsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-11 w-44" />
      </div>
      <Card className="shadow-warm-sm">
        <CardContent className="p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
