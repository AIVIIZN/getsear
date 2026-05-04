"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Cable, Lock } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/EmptyState";
import { TerminalDiscoveryDialog } from "@/components/settings/TerminalDiscoveryDialog";
import {
  TerminalListTable,
  type RegisteredHardwareTerminal,
} from "@/components/settings/TerminalListTable";
import { WorkstationTerminalsTab } from "@/components/settings/WorkstationTerminalsTab";

const DEFAULT_PROCESSOR_LABEL = "Valor";

const PROCESSOR_LABELS: Record<string, string> = {
  valor: "Valor",
};

function ProcessorBadge({ processor }: { processor: string | null }) {
  const label = processor ? PROCESSOR_LABELS[processor] ?? processor : null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Payment processor
      </span>
      <Badge variant="outline" className="gap-1.5 px-2.5 py-0.5">
        <Lock className="h-3 w-3" />
        {label ?? DEFAULT_PROCESSOR_LABEL}
      </Badge>
      <span className="text-xs text-muted-foreground">
        (locked at onboarding)
      </span>
    </div>
  );
}

export default function TerminalsPage() {
  const [hardwareTerminals, setHardwareTerminals] = useState<
    RegisteredHardwareTerminal[]
  >([]);
  const [hardwareLoading, setHardwareLoading] = useState(true);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [processor, setProcessor] = useState<string | null>(null);

  const fetchHardwareTerminals = useCallback(async () => {
    try {
      const res = await fetch("/api/payments/terminals");
      if (!res.ok) {
        // Endpoint not yet wired in this environment is acceptable; render empty.
        setHardwareTerminals([]);
        return;
      }
      const json = await res.json();
      setHardwareTerminals(json.data ?? []);
    } catch {
      setHardwareTerminals([]);
    } finally {
      setHardwareLoading(false);
    }
  }, []);

  const fetchProcessor = useCallback(async () => {
    try {
      const res = await fetch("/api/payments/processor-binding");
      if (!res.ok) {
        // Sister build's endpoint may not be live yet; default to Valor.
        setProcessor("valor");
        return;
      }
      const json = await res.json();
      setProcessor(json.data?.processor ?? "valor");
    } catch {
      setProcessor("valor");
    }
  }, []);

  useEffect(() => {
    fetchHardwareTerminals();
    fetchProcessor();
  }, [fetchHardwareTerminals, fetchProcessor]);

  const handleScanClick = useCallback(() => {
    setDiscoverOpen(true);
  }, []);

  const handleDeviceAdded = useCallback(() => {
    fetchHardwareTerminals();
    toast.success("Terminal list refreshed");
  }, [fetchHardwareTerminals]);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Terminals
          </h1>
          <p className="text-sm text-muted-foreground">
            Card readers, printers, and other hardware connected to your POS.
          </p>
        </div>
        <ProcessorBadge processor={processor} />
      </header>

      <Tabs defaultValue="hardware" className="w-full">
        <TabsList>
          <TabsTrigger value="hardware">Payment hardware</TabsTrigger>
          <TabsTrigger value="workstations">Workstations</TabsTrigger>
        </TabsList>

        <TabsContent value="hardware" className="mt-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Payment hardware
                </h2>
                <p className="text-sm text-muted-foreground">
                  {hardwareTerminals.length}{" "}
                  device{hardwareTerminals.length !== 1 ? "s" : ""} registered
                </p>
              </div>
              <Button
                onClick={handleScanClick}
                className="h-11 gap-2 btn-press touch-target"
              >
                <Plus className="h-4 w-4" />
                Scan for devices
              </Button>
            </div>

            {hardwareLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : hardwareTerminals.length === 0 ? (
              <EmptyState
                icon={Cable}
                title="No payment hardware yet"
                description="Power on your card reader or printer, connect it to the same Wi-Fi as this terminal, then scan to detect it."
                actionLabel="Scan for devices"
                onAction={handleScanClick}
              />
            ) : (
              <TerminalListTable terminals={hardwareTerminals} />
            )}
          </div>
        </TabsContent>

        <TabsContent value="workstations" className="mt-6">
          <WorkstationTerminalsTab />
        </TabsContent>
      </Tabs>

      <TerminalDiscoveryDialog
        open={discoverOpen}
        onOpenChange={setDiscoverOpen}
        onDeviceAdded={handleDeviceAdded}
      />
    </div>
  );
}
