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
  Copy,
  Check,
  Settings2,
  Smartphone,
  User as UserIcon,
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
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

const DEFAULT_VIEW_LABELS: Record<string, string> = {
  pos: "POS",
  kds: "Kitchen Display",
  customer_display: "Customer Display",
  kiosk: "Kiosk",
};

function isOnline(lastHeartbeat: string | null): boolean {
  if (!lastHeartbeat) return false;
  const diff = Date.now() - new Date(lastHeartbeat).getTime();
  return diff < 2 * 60 * 1000; // < 2 minutes ago
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function TerminalsPage() {
  const activeLocationId = useAuthStore((s) => s.activeLocationId);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [loading, setLoading] = useState(true);

  // Register dialog state
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [registerStep, setRegisterStep] = useState<"form" | "code">("form");
  const [saving, setSaving] = useState(false);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<string>("server_station");
  const [registrationCode, setRegistrationCode] = useState("");
  const [codeExpiresAt, setCodeExpiresAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [codeCopied, setCodeCopied] = useState(false);

  // Configure sheet state
  const [configureTerminal, setConfigureTerminal] = useState<Terminal | null>(null);
  const [configName, setConfigName] = useState("");
  const [configDefaultView, setConfigDefaultView] = useState("pos");
  const [configSaving, setConfigSaving] = useState(false);

  const fetchTerminals = useCallback(async () => {
    if (!activeLocationId) return;
    try {
      const res = await fetch(
        `/api/settings/terminals?location_id=${activeLocationId}`
      );
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

  // Countdown timer for registration code
  useEffect(() => {
    if (!codeExpiresAt) {
      setCountdown(0);
      return;
    }

    function tick() {
      const remaining = Math.max(
        0,
        Math.floor((codeExpiresAt!.getTime() - Date.now()) / 1000)
      );
      setCountdown(remaining);
      if (remaining <= 0) {
        setRegistrationCode("");
        setCodeExpiresAt(null);
      }
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [codeExpiresAt]);

  // --- Register flow ---
  async function handleGenerateCode() {
    if (!formName.trim()) {
      toast.error("Terminal name is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/terminals/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location_id: activeLocationId,
          name: formName,
          terminal_type: formType,
        }),
      });

      if (!res.ok) throw new Error("Failed to generate code");
      const data = await res.json();

      setRegistrationCode(data.registration_code);
      setCodeExpiresAt(new Date(data.expires_at));
      setRegisterStep("code");
      fetchTerminals();
    } catch {
      toast.error("Failed to generate registration code");
    } finally {
      setSaving(false);
    }
  }

  function handleCloseRegisterDialog() {
    setRegisterDialogOpen(false);
    setRegisterStep("form");
    setFormName("");
    setFormType("server_station");
    setRegistrationCode("");
    setCodeExpiresAt(null);
    setCodeCopied(false);
  }

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(registrationCode);
      setCodeCopied(true);
      toast.success("Code copied to clipboard");
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      toast.error("Failed to copy code");
    }
  }

  // --- Configure flow ---
  function openConfigure(terminal: Terminal) {
    setConfigureTerminal(terminal);
    setConfigName(terminal.name);
    setConfigDefaultView(terminal.default_view ?? "pos");
  }

  async function handleSaveConfig() {
    if (!configureTerminal) return;
    if (!configName.trim()) {
      toast.error("Terminal name cannot be empty");
      return;
    }

    setConfigSaving(true);
    try {
      const res = await fetch(
        `/api/terminals/${configureTerminal.id}/configure`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: configName,
            default_view: configDefaultView,
          }),
        }
      );

      if (!res.ok) throw new Error("Failed to configure");
      toast.success("Terminal updated");
      setConfigureTerminal(null);
      fetchTerminals();
    } catch {
      toast.error("Failed to update terminal");
    } finally {
      setConfigSaving(false);
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
      toast.success(
        terminal.is_active ? "Terminal deactivated" : "Terminal activated"
      );
      fetchTerminals();
    } catch {
      toast.error("Failed to update terminal");
    }
  }

  const countdownMin = Math.floor(countdown / 60);
  const countdownSec = countdown % 60;

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
            {terminals.length} terminal{terminals.length !== 1 ? "s" : ""}{" "}
            registered
          </p>
        </div>
        <Button
          onClick={() => setRegisterDialogOpen(true)}
          className="h-11 gap-2 btn-press touch-target"
        >
          <Plus className="h-4 w-4" />
          Register New Device
        </Button>
      </div>

      {/* Terminal table */}
      {terminals.length === 0 ? (
        <EmptyState
          icon={Monitor}
          title="No terminals registered"
          description="Register your first POS terminal or iPad."
          actionLabel="Register New Device"
          onAction={() => setRegisterDialogOpen(true)}
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
                  <TableHead>Default View</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Online</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead>Current User</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {terminals.map((term) => {
                  const online = isOnline(term.last_heartbeat_at);
                  const fp = term.device_fingerprint;
                  return (
                    <TableRow key={term.id} className="even:bg-muted/20">
                      <TableCell className="pl-4 font-medium">
                        {term.name}
                      </TableCell>
                      <TableCell>
                        {TERMINAL_TYPE_LABELS[term.terminal_type] ??
                          term.terminal_type}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">
                          {DEFAULT_VIEW_LABELS[term.default_view ?? "pos"] ??
                            term.default_view}
                        </span>
                      </TableCell>
                      <TableCell>
                        {fp ? (
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Smartphone className="h-3 w-3" />
                            {fp.platform}
                            {fp.screen_width
                              ? ` (${fp.screen_width}x${fp.screen_height})`
                              : ""}
                          </span>
                        ) : term.registration_code ? (
                          <StatusBadge status="pending" />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            --
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {online ? (
                          <span className="flex items-center gap-1.5">
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--success)] opacity-75" />
                              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--success)]" />
                            </span>
                            <Wifi className="h-4 w-4 text-[var(--success)]" />
                          </span>
                        ) : (
                          <WifiOff className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        {term.last_heartbeat_at ? (
                          <span
                            className="flex items-center gap-1.5 text-xs text-muted-foreground"
                            title={formatDateTime(term.last_heartbeat_at)}
                          >
                            <Clock className="h-3 w-3" />
                            {timeAgo(term.last_heartbeat_at)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Never
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {term.current_user_id ? (
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <UserIcon className="h-3 w-3" />
                            {term.current_user_id.slice(0, 8)}...
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            --
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={term.is_active}
                          onCheckedChange={() => toggleActive(term)}
                        />
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openConfigure(term)}
                          className="h-9 w-9 touch-target"
                        >
                          <Settings2 className="h-4 w-4" />
                          <span className="sr-only">Configure</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Register Dialog */}
      <Dialog open={registerDialogOpen} onOpenChange={handleCloseRegisterDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {registerStep === "form"
                ? "Register New Device"
                : "Registration Code"}
            </DialogTitle>
            <DialogDescription>
              {registerStep === "form"
                ? "Set up a new terminal, then enter the code on the device."
                : "Enter this code on the device you want to register."}
            </DialogDescription>
          </DialogHeader>

          {registerStep === "form" ? (
            <>
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
                  <Select
                    value={formType}
                    onValueChange={(v) => v && setFormType(v)}
                  >
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
                  onClick={handleCloseRegisterDialog}
                  className="h-11 touch-target"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleGenerateCode}
                  disabled={saving}
                  className="h-11 gap-2 btn-press touch-target"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Generate Code
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="space-y-6 py-4">
              {/* Large code display */}
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2">
                  {registrationCode.split("").map((digit, i) => (
                    <div
                      key={i}
                      className="flex h-16 w-14 items-center justify-center rounded-lg border-2 border-[var(--primary)] bg-[var(--accent)] text-2xl font-bold text-[var(--primary)]"
                    >
                      {digit}
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyCode}
                  className="gap-2"
                >
                  {codeCopied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {codeCopied ? "Copied" : "Copy Code"}
                </Button>
              </div>

              {/* Countdown timer */}
              {countdown > 0 ? (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Code expires in{" "}
                    <span className="font-mono font-medium text-foreground">
                      {countdownMin}:{countdownSec.toString().padStart(2, "0")}
                    </span>
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-[var(--error)]">
                    Code expired. Close and try again.
                  </p>
                </div>
              )}

              {/* Instructions */}
              <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">On the device:</p>
                <ol className="mt-1 list-inside list-decimal space-y-1">
                  <li>
                    Open{" "}
                    <span className="font-medium text-foreground">
                      getsear.com/register
                    </span>
                  </li>
                  <li>Enter the 6-digit code above</li>
                  <li>Add to Home Screen for fullscreen app</li>
                </ol>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={handleCloseRegisterDialog}
                  className="h-11 touch-target"
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Configure Sheet */}
      <Sheet
        open={!!configureTerminal}
        onOpenChange={(open) => {
          if (!open) setConfigureTerminal(null);
        }}
      >
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Configure Terminal</SheetTitle>
            <SheetDescription>
              Update terminal settings and view device information.
            </SheetDescription>
          </SheetHeader>

          {configureTerminal && (
            <div className="space-y-6 py-6">
              {/* Editable fields */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="config-name">Name</Label>
                  <Input
                    id="config-name"
                    className="h-12"
                    value={configName}
                    onChange={(e) => setConfigName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Default View</Label>
                  <Select
                    value={configDefaultView}
                    onValueChange={(v) => v && setConfigDefaultView(v)}
                  >
                    <SelectTrigger className="h-12 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pos">POS</SelectItem>
                      <SelectItem value="kds">Kitchen Display</SelectItem>
                      <SelectItem value="customer_display">
                        Customer Display
                      </SelectItem>
                      <SelectItem value="kiosk">Kiosk</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Assigned Printer</Label>
                  <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--muted)] px-3 py-3 text-sm text-muted-foreground">
                    No printers configured
                  </div>
                </div>
              </div>

              {/* Device info (read-only) */}
              {configureTerminal.device_fingerprint && (
                <div className="space-y-3">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Device Information
                  </Label>
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-4 space-y-2">
                    <InfoRow
                      label="Platform"
                      value={configureTerminal.device_fingerprint.platform}
                    />
                    <InfoRow
                      label="Screen"
                      value={`${configureTerminal.device_fingerprint.screen_width} x ${configureTerminal.device_fingerprint.screen_height}`}
                    />
                    <InfoRow
                      label="Standalone"
                      value={
                        configureTerminal.device_fingerprint.standalone
                          ? "Yes"
                          : "No"
                      }
                    />
                    <InfoRow
                      label="User Agent"
                      value={configureTerminal.device_fingerprint.user_agent}
                      truncate
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <SheetFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfigureTerminal(null)}
              className="h-11 touch-target"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveConfig}
              disabled={configSaving}
              className="h-11 gap-2 btn-press touch-target"
            >
              {configSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function InfoRow({
  label,
  value,
  truncate,
}: {
  label: string;
  value: string;
  truncate?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
        {label}
      </span>
      <span
        className={`text-xs text-foreground text-right ${
          truncate ? "max-w-[260px] truncate" : ""
        }`}
        title={truncate ? value : undefined}
      >
        {value}
      </span>
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
