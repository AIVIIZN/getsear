'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Wifi,
  Cloud,
  Bluetooth,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Check,
  Printer,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  PRINTER_MODELS,
  PRINTER_MODEL_LABELS,
  PRINTER_ROLE_LABELS,
  PRINTER_ROLES,
  type ConnectionType,
  type PrinterModel,
  type PrinterRole,
  getDefaultPort,
} from '@/lib/printing/printer-interface';
import { TestPrintButton } from './TestPrintButton';
import { NetworkPrinterScanner } from './NetworkPrinterScanner';

interface AddPrinterWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: string;
  onPrinterAdded: () => void;
}

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

const STEP_TITLES: Record<WizardStep, string> = {
  1: 'Connection Type',
  2: 'Connection Details',
  3: 'Printer Model',
  4: 'Printer Role',
  5: 'Cash Drawer',
  6: 'Test & Save',
};

const connectionOptions: {
  value: ConnectionType;
  label: string;
  description: string;
  icon: typeof Wifi;
}[] = [
  {
    value: 'network',
    label: 'Network (TCP/IP)',
    description: 'Printer connected via Ethernet or WiFi on your local network',
    icon: Wifi,
  },
  {
    value: 'cloudprnt',
    label: 'Star CloudPRNT',
    description: 'Star printers with CloudPRNT — printer polls for jobs via HTTP',
    icon: Cloud,
  },
  {
    value: 'bluetooth',
    label: 'Bluetooth',
    description: 'Bluetooth-connected portable or receipt printers',
    icon: Bluetooth,
  },
];

export function AddPrinterWizard({
  open,
  onOpenChange,
  locationId,
  onPrinterAdded,
}: AddPrinterWizardProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [saving, setSaving] = useState(false);
  const [savedPrinterId, setSavedPrinterId] = useState<string | null>(null);

  // Step 1
  const [connectionType, setConnectionType] = useState<ConnectionType>('network');
  // Step 2
  const [networkMode, setNetworkMode] = useState<'scan' | 'manual'>('scan');
  const [ipAddress, setIpAddress] = useState('');
  const [port, setPort] = useState('9100');
  const [deviceName, setDeviceName] = useState('');
  // Step 3
  const [model, setModel] = useState<PrinterModel>('star_tsp143iv');
  // Step 4
  const [role, setRole] = useState<PrinterRole>('receipt');
  const [printerName, setPrinterName] = useState('');
  const [stationName, setStationName] = useState('');
  // Step 5
  const [cashDrawerEnabled, setCashDrawerEnabled] = useState(false);
  const [cashDrawerPin, setCashDrawerPin] = useState<2 | 5>(2);
  const [pulseDuration, setPulseDuration] = useState(100);

  function resetForm() {
    setStep(1);
    setConnectionType('network');
    setIpAddress('');
    setPort('9100');
    setDeviceName('');
    setModel('star_tsp143iv');
    setRole('receipt');
    setPrinterName('');
    setStationName('');
    setCashDrawerEnabled(false);
    setCashDrawerPin(2);
    setPulseDuration(100);
    setSavedPrinterId(null);
  }

  function handleClose() {
    resetForm();
    onOpenChange(false);
  }

  function handleNext() {
    // Validation per step
    if (step === 2) {
      if (connectionType === 'network' || connectionType === 'cloudprnt') {
        if (!ipAddress.trim()) {
          toast.error('IP address is required');
          return;
        }
      }
      if (connectionType === 'bluetooth') {
        if (!deviceName.trim()) {
          toast.error('Device name is required');
          return;
        }
      }
    }
    if (step === 4) {
      if (!printerName.trim()) {
        toast.error('Printer name is required');
        return;
      }
      if (role === 'kitchen' && !stationName.trim()) {
        toast.error('Station name is required for kitchen printers');
        return;
      }
    }

    if (step < 6) {
      setStep((step + 1) as WizardStep);
    }
  }

  function handleBack() {
    if (step > 1) {
      setStep((step - 1) as WizardStep);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/printing/printers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: locationId,
          name: printerName,
          model,
          connection_type: connectionType,
          ip_address: connectionType === 'bluetooth' ? null : ipAddress || null,
          port:
            connectionType === 'bluetooth'
              ? null
              : parseInt(port, 10) || getDefaultPort(model),
          role,
          station_name: stationName || null,
          cash_drawer_enabled: cashDrawerEnabled,
          cash_drawer_pin: cashDrawerPin,
          pulse_duration: pulseDuration,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: 'Failed to save' }));
        throw new Error(json.error ?? 'Failed to save printer');
      }

      const json = await res.json();
      setSavedPrinterId(json.data?.id ?? null);
      toast.success('Printer added successfully');
      onPrinterAdded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save printer');
    } finally {
      setSaving(false);
    }
  }

  // Filter models by connection type
  const filteredModels = PRINTER_MODELS.filter((m) => {
    if (connectionType === 'cloudprnt') return m.startsWith('star');
    return true;
  });

  // Auto-generate printer name if empty when reaching step 4
  function generateDefaultName() {
    if (!printerName) {
      const roleLabel = PRINTER_ROLE_LABELS[role] ?? role;
      setPrinterName(`${roleLabel} Printer`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{STEP_TITLES[step]}</DialogTitle>
          <DialogDescription>
            Step {step} of 6 — Add a new printer to your location
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-1">
          {([1, 2, 3, 4, 5, 6] as WizardStep[]).map((s) => (
            <div
              key={s}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                s <= step ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'
              )}
            />
          ))}
        </div>

        <div className="py-4 min-h-[260px]">
          {/* Step 1: Connection Type */}
          {step === 1 && (
            <div className="space-y-3">
              {connectionOptions.map((opt) => {
                const Icon = opt.icon;
                const selected = connectionType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setConnectionType(opt.value)}
                    className={cn(
                      'flex w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition-all touch-target',
                      selected
                        ? 'border-[var(--primary)] bg-[var(--primary-subtle)]'
                        : 'border-[var(--border)] bg-transparent hover:border-[var(--border-hover)] hover:bg-[var(--background-subtle)]'
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-lg',
                        selected
                          ? 'bg-[var(--primary)] text-white'
                          : 'bg-[var(--background-muted)] text-muted-foreground'
                      )}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <p
                        className={cn(
                          'font-semibold',
                          selected ? 'text-[var(--primary)]' : 'text-foreground'
                        )}
                      >
                        {opt.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {opt.description}
                      </p>
                    </div>
                    {selected && (
                      <Check className="h-5 w-5 text-[var(--primary)] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 2: Connection Details */}
          {step === 2 && (
            <div className="space-y-5">
              {(connectionType === 'network' || connectionType === 'cloudprnt') && (
                <>
                  {connectionType === 'network' && (
                    <div className="space-y-4">
                      {/* Scan vs Manual toggle */}
                      <div className="flex items-center rounded-xl bg-[var(--background-muted)] p-0.5">
                        <button
                          type="button"
                          onClick={() => setNetworkMode('scan')}
                          className={cn(
                            'flex-1 rounded-[10px] px-3 py-2 text-sm font-medium transition-all touch-target',
                            networkMode === 'scan'
                              ? 'bg-[var(--background)] text-foreground shadow-sm'
                              : 'text-muted-foreground'
                          )}
                        >
                          Scan Network
                        </button>
                        <button
                          type="button"
                          onClick={() => setNetworkMode('manual')}
                          className={cn(
                            'flex-1 rounded-[10px] px-3 py-2 text-sm font-medium transition-all touch-target',
                            networkMode === 'manual'
                              ? 'bg-[var(--background)] text-foreground shadow-sm'
                              : 'text-muted-foreground'
                          )}
                        >
                          Manual Entry
                        </button>
                      </div>

                      {networkMode === 'scan' ? (
                        <NetworkPrinterScanner
                          onSelect={(ip, selectedPort) => {
                            setIpAddress(ip);
                            setPort(String(selectedPort));
                            setNetworkMode('manual');
                            toast.success(`Selected ${ip}`);
                          }}
                        />
                      ) : (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="ip-address">IP Address *</Label>
                            <Input
                              id="ip-address"
                              className="h-12 font-mono"
                              placeholder="192.168.1.100"
                              value={ipAddress}
                              onChange={(e) => setIpAddress(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="port">Port</Label>
                            <Input
                              id="port"
                              className="h-12 font-mono"
                              placeholder="9100"
                              value={port}
                              onChange={(e) => setPort(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                              Default: 9100. Change only if your printer uses a
                              different port.
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {connectionType === 'cloudprnt' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="ip-address">IP Address *</Label>
                        <Input
                          id="ip-address"
                          className="h-12 font-mono"
                          placeholder="192.168.1.100"
                          value={ipAddress}
                          onChange={(e) => setIpAddress(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="port">Port</Label>
                        <Input
                          id="port"
                          className="h-12 font-mono"
                          placeholder="9100"
                          value={port}
                          onChange={(e) => setPort(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Default: 9100. Change only if your printer uses a
                          different port.
                        </p>
                      </div>
                    </>
                  )}
                </>
              )}

              {connectionType === 'bluetooth' && (
                <div className="space-y-2">
                  <Label htmlFor="device-name">Device Name *</Label>
                  <Input
                    id="device-name"
                    className="h-12"
                    placeholder="Star mPOP"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    The Bluetooth name as shown in your device settings.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Printer Model */}
          {step === 3 && (
            <div className="space-y-2">
              <Label>Printer Model</Label>
              <Select
                value={model}
                onValueChange={(v) => setModel(v as PrinterModel)}
              >
                <SelectTrigger className="h-12 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {filteredModels.map((m) => (
                    <SelectItem key={m} value={m}>
                      {PRINTER_MODEL_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--background-subtle)] p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-2">
                  {PRINTER_MODEL_LABELS[model]}
                </p>
                <p>{getModelDescription(model)}</p>
              </div>
            </div>
          )}

          {/* Step 4: Role + Name */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="printer-name">Printer Name *</Label>
                <Input
                  id="printer-name"
                  className="h-12"
                  placeholder="Front Receipt Printer"
                  value={printerName}
                  onChange={(e) => setPrinterName(e.target.value)}
                  onFocus={generateDefaultName}
                />
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <div className="grid grid-cols-3 gap-2">
                  {PRINTER_ROLES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 text-center transition-all touch-target',
                        r === role
                          ? 'border-[var(--primary)] bg-[var(--primary-subtle)]'
                          : 'border-[var(--border)] hover:border-[var(--border-hover)]'
                      )}
                    >
                      <Printer
                        className={cn(
                          'h-5 w-5',
                          r === role
                            ? 'text-[var(--primary)]'
                            : 'text-muted-foreground'
                        )}
                      />
                      <span
                        className={cn(
                          'text-xs font-medium',
                          r === role
                            ? 'text-[var(--primary)]'
                            : 'text-muted-foreground'
                        )}
                      >
                        {PRINTER_ROLE_LABELS[r]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {(role === 'kitchen' || role === 'bar' || role === 'expo') && (
                <div className="space-y-2">
                  <Label htmlFor="station-name">
                    Station Name {role === 'kitchen' ? '*' : ''}
                  </Label>
                  <Input
                    id="station-name"
                    className="h-12"
                    placeholder="Hot Line"
                    value={stationName}
                    onChange={(e) => setStationName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Matches a KDS station name for ticket routing.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Cash Drawer */}
          {step === 5 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label htmlFor="cash-drawer-enable" className="text-base">
                    Cash Drawer
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Enable if a cash drawer is connected to this printer via
                    RJ-11 cable.
                  </p>
                </div>
                <Switch
                  id="cash-drawer-enable"
                  checked={cashDrawerEnabled}
                  onCheckedChange={setCashDrawerEnabled}
                />
              </div>

              {cashDrawerEnabled && (
                <div className="space-y-5 rounded-lg border border-[var(--border)] bg-[var(--background-subtle)] p-4">
                  <div className="space-y-2">
                    <Label>Kick Pin</Label>
                    <div className="flex gap-3">
                      {([2, 5] as const).map((pin) => (
                        <button
                          key={pin}
                          type="button"
                          onClick={() => setCashDrawerPin(pin)}
                          className={cn(
                            'flex-1 rounded-lg border-2 py-3 text-center font-medium transition-all touch-target',
                            cashDrawerPin === pin
                              ? 'border-[var(--primary)] bg-[var(--primary-subtle)] text-[var(--primary)]'
                              : 'border-[var(--border)] text-muted-foreground hover:border-[var(--border-hover)]'
                          )}
                        >
                          Pin {pin}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Most cash drawers use Pin 2. Try Pin 5 if Pin 2 does not
                      work.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pulse-duration">
                      Pulse Duration: {pulseDuration}ms
                    </Label>
                    <input
                      id="pulse-duration"
                      type="range"
                      min={100}
                      max={800}
                      step={100}
                      value={pulseDuration}
                      onChange={(e) =>
                        setPulseDuration(parseInt(e.target.value, 10))
                      }
                      className="w-full accent-[var(--primary)]"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>100ms</span>
                      <span>800ms</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 6: Test & Save */}
          {step === 6 && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="rounded-lg border border-[var(--border)] bg-[var(--background-subtle)] p-4 space-y-2">
                <SummaryRow label="Name" value={printerName} />
                <SummaryRow
                  label="Model"
                  value={PRINTER_MODEL_LABELS[model]}
                />
                <SummaryRow
                  label="Connection"
                  value={
                    connectionType === 'bluetooth'
                      ? `Bluetooth (${deviceName})`
                      : `${connectionType === 'cloudprnt' ? 'CloudPRNT' : 'Network'} ${ipAddress}:${port}`
                  }
                />
                <SummaryRow
                  label="Role"
                  value={PRINTER_ROLE_LABELS[role]}
                />
                {stationName && (
                  <SummaryRow label="Station" value={stationName} />
                )}
                <SummaryRow
                  label="Cash Drawer"
                  value={
                    cashDrawerEnabled
                      ? `Enabled (Pin ${cashDrawerPin}, ${pulseDuration}ms)`
                      : 'Disabled'
                  }
                />
              </div>

              {/* Save + Test */}
              {!savedPrinterId ? (
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full h-12 gap-2 btn-press touch-target"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Save Printer
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[var(--success)]">
                    <Check className="h-5 w-5" />
                    <span className="font-medium">Printer saved successfully</span>
                  </div>
                  <TestPrintButton
                    printerId={savedPrinterId}
                    className="w-full h-12"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {step > 1 && step < 6 && (
            <Button
              variant="outline"
              onClick={handleBack}
              className="h-11 gap-2 touch-target"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          )}

          {step === 6 ? (
            <Button
              variant="outline"
              onClick={handleClose}
              className="h-11 touch-target"
            >
              Done
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              className="h-11 gap-2 btn-press touch-target"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function getModelDescription(model: PrinterModel): string {
  const descriptions: Record<PrinterModel, string> = {
    star_tsp143iv:
      'High-speed thermal receipt printer with USB-C, Ethernet, WiFi. Supports CloudPRNT. Most popular for counter service.',
    star_tsp143iii:
      'Reliable thermal receipt printer. USB + Ethernet. Previous generation, still widely deployed.',
    star_mc_print3:
      'Compact 3-inch thermal printer. USB-C, Ethernet, Bluetooth. Ideal for tight counter spaces.',
    star_mpop:
      'All-in-one mobile POS station with built-in cash drawer and tablet stand. Bluetooth.',
    star_sm_l200:
      'Portable Bluetooth receipt printer. Battery-powered, 2-inch paper. For tableside or delivery.',
    epson_tm_t88vii:
      'Industry-standard high-speed thermal printer. USB + Ethernet. Paper-saving features.',
    epson_tm_82ii:
      'Compact top-loading thermal printer. USB + Ethernet. Easy paper replacement.',
  };
  return descriptions[model];
}
