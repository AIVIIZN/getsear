"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock, XCircle, Loader2, RotateCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ManagerPinDialog } from "@/components/pos/ManagerPinDialog";
import { cn } from "@/lib/utils";

export interface DiscoveredDevice {
  device_class: string;
  mfg: string;
  model: string;
  identifier: string;
  supported: boolean;
  cert_status: "live" | "pending_cert" | "unsupported_until_psp_listed";
  reason_if_unsupported?: string;
}

interface TerminalDiscoveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeviceAdded: () => void;
}

type ScanState = "idle" | "awaiting_pin" | "scanning" | "results" | "error";

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

function CertStatusPill({ device }: { device: DiscoveredDevice }) {
  if (device.cert_status === "live" && device.supported) {
    return (
      <Badge variant="success" className="gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Compatible
      </Badge>
    );
  }
  if (device.cert_status === "pending_cert") {
    return (
      <Badge variant="warning" className="gap-1">
        <Clock className="h-3 w-3" />
        Pending certification
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="gap-1">
      <XCircle className="h-3 w-3" />
      Not supported
    </Badge>
  );
}

function unsupportedReason(device: DiscoveredDevice): string {
  if (device.reason_if_unsupported) return device.reason_if_unsupported;
  if (device.cert_status === "pending_cert") {
    return "This device class is supported by your processor but awaiting EMV cert. Check back soon.";
  }
  if (device.cert_status === "unsupported_until_psp_listed") {
    return "Your payment processor doesn't support this device class.";
  }
  return "This device is not currently supported.";
}

export function TerminalDiscoveryDialog({
  open,
  onOpenChange,
  onDeviceAdded,
}: TerminalDiscoveryDialogProps) {
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinPurpose, setPinPurpose] = useState<
    | { kind: "scan" }
    | { kind: "add"; device: DiscoveredDevice }
    | null
  >(null);
  const [addingIdentifier, setAddingIdentifier] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setScanState("idle");
    setDevices([]);
    setScanError(null);
    setAddingIdentifier(null);
    setPinPurpose(null);
    setPinDialogOpen(false);
  }, []);

  // Kick off the manager-PIN-gated scan when the dialog opens.
  useEffect(() => {
    if (open && scanState === "idle") {
      setPinPurpose({ kind: "scan" });
      setPinDialogOpen(true);
      setScanState("awaiting_pin");
    }
    if (!open) {
      resetState();
    }
  }, [open, scanState, resetState]);

  const runDiscovery = useCallback(async () => {
    setScanState("scanning");
    setScanError(null);
    try {
      const res = await fetch("/api/payments/terminals/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error("Manager authorization required");
        }
        throw new Error("Discovery failed");
      }
      const json = await res.json();
      setDevices(json.data ?? []);
      setScanState("results");
    } catch (e) {
      setScanError(e instanceof Error ? e.message : "Discovery failed");
      setScanState("error");
    }
  }, []);

  const addDevice = useCallback(
    async (device: DiscoveredDevice) => {
      setAddingIdentifier(device.identifier);
      try {
        const res = await fetch("/api/payments/terminals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            device_class: device.device_class,
            identifier: device.identifier,
          }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          if (json.code === "driver_not_certified") {
            toast.error("This driver is not certified for your processor yet.");
          } else {
            toast.error(json.error ?? "Failed to add device");
          }
          return;
        }
        toast.success("Device added");
        onDeviceAdded();
        // Mark the device as added by removing it from the list.
        setDevices((prev) =>
          prev.filter((d) => d.identifier !== device.identifier)
        );
      } catch {
        toast.error("Failed to add device");
      } finally {
        setAddingIdentifier(null);
      }
    },
    [onDeviceAdded]
  );

  const handlePinVerified = useCallback(() => {
    setPinDialogOpen(false);
    if (!pinPurpose) return;
    if (pinPurpose.kind === "scan") {
      runDiscovery();
    } else if (pinPurpose.kind === "add") {
      addDevice(pinPurpose.device);
    }
    setPinPurpose(null);
  }, [pinPurpose, runDiscovery, addDevice]);

  const handlePinDialogChange = useCallback(
    (next: boolean) => {
      setPinDialogOpen(next);
      if (!next && pinPurpose?.kind === "scan" && scanState === "awaiting_pin") {
        // User cancelled the manager-PIN; close the whole discovery dialog.
        onOpenChange(false);
      }
      if (!next && pinPurpose?.kind === "add") {
        setPinPurpose(null);
      }
    },
    [pinPurpose, scanState, onOpenChange]
  );

  const handleRescan = useCallback(() => {
    setPinPurpose({ kind: "scan" });
    setPinDialogOpen(true);
  }, []);

  const requestAdd = useCallback((device: DiscoveredDevice) => {
    setPinPurpose({ kind: "add", device });
    setPinDialogOpen(true);
  }, []);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Discover devices</DialogTitle>
            <DialogDescription>
              {scanState === "scanning"
                ? "Scanning your network for compatible terminals..."
                : "Compatible terminals on your network."}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-[280px] py-2">
            {(scanState === "idle" || scanState === "awaiting_pin") && (
              <div className="flex h-[260px] items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  Manager authorization required to scan.
                </p>
              </div>
            )}

            {scanState === "scanning" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Scanning Wi-Fi, USB, and Bluetooth...
                </div>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-[var(--border)] bg-card p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-5 w-24" />
                    </div>
                    <Skeleton className="h-3 w-56" />
                  </div>
                ))}
              </div>
            )}

            {scanState === "error" && (
              <div className="flex h-[260px] flex-col items-center justify-center gap-3 text-center">
                <XCircle className="h-8 w-8 text-destructive" />
                <p className="text-sm font-medium text-foreground">
                  {scanError ?? "Scan failed"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Make sure this terminal is on the venue Wi-Fi and try again.
                </p>
              </div>
            )}

            {scanState === "results" && devices.length === 0 && (
              <div className="flex h-[260px] flex-col items-center justify-center gap-3 text-center">
                <p className="text-sm font-medium text-foreground">
                  No devices found on your network.
                </p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Make sure the device is powered on and connected to the same
                  Wi-Fi as this terminal.
                </p>
              </div>
            )}

            {scanState === "results" && devices.length > 0 && (
              <ul className="space-y-3">
                {devices.map((device) => {
                  const supported = device.supported && device.cert_status === "live";
                  const isAdding = addingIdentifier === device.identifier;
                  return (
                    <li
                      key={`${device.device_class}-${device.identifier}`}
                      className="rounded-lg border border-[var(--border)] bg-card p-4 transition-shadow hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-semibold text-foreground">
                              {device.mfg} {device.model}
                            </h4>
                            <CertStatusPill device={device} />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {deviceClassLabel(device.device_class)}
                            <span className="mx-2">·</span>
                            <span className="font-mono">{device.identifier}</span>
                          </p>
                          {!supported && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {unsupportedReason(device)}
                            </p>
                          )}
                        </div>

                        {supported ? (
                          <Button
                            onClick={() => requestAdd(device)}
                            disabled={isAdding}
                            className="h-11 min-w-[88px] touch-target btn-press"
                          >
                            {isAdding ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Add"
                            )}
                          </Button>
                        ) : (
                          <TooltipProvider delay={200}>
                            <Tooltip>
                              <TooltipTrigger className="inline-flex" tabIndex={0}>
                                <span
                                  aria-disabled="true"
                                  className={cn(
                                    "inline-flex h-11 min-w-[88px] items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground",
                                    "opacity-40 cursor-not-allowed select-none"
                                  )}
                                >
                                  Add
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[260px]">
                                {unsupportedReason(device)}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleRescan}
              disabled={scanState === "scanning"}
              className="h-11 gap-2 touch-target"
            >
              <RotateCw className="h-4 w-4" />
              Rescan
            </Button>
            <Button
              onClick={() => onOpenChange(false)}
              className="h-11 touch-target btn-press"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ManagerPinDialog
        open={pinDialogOpen}
        onOpenChange={handlePinDialogChange}
        title="Manager authorization"
        description={
          pinPurpose?.kind === "add"
            ? "Confirm to register this device."
            : "Confirm to scan for devices."
        }
        onVerified={handlePinVerified}
      />
    </>
  );
}
